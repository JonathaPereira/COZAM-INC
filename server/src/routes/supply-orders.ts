import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { uploadDocument } from '../services/storage.js';
import { AppError } from '../middleware/errors.js';

export const supplyOrdersRouter = Router();

const createSupplyOrderSchema = z.object({
  process_id: z.string().uuid('ID do processo inválido.'),
  supplier_id: z.string().uuid('ID do fornecedor inválido.'),
  of_number: z.string().trim().min(1, 'Número da Ordem de Fornecimento é obrigatório.'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de emissão inválida.'),
  total_value: z.coerce.number().min(0, 'Valor total não pode ser negativo.').optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const updateSupplyOrderSchema = z.object({
  process_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  of_number: z.string().trim().min(1).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  total_value: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional(),
});

supplyOrdersRouter.get('/supply-orders', authenticate, requirePermission('processes.view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const processId = typeof req.query.process_id === 'string' ? req.query.process_id.trim() : '';
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where: string[] = ['1=1'];
    const params: any[] = [];

    if (processId) {
      params.push(processId);
      where.push(`so.process_id = $${params.length}`);
    }
    if (supplierId) {
      params.push(supplierId);
      where.push(`so.supplier_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(so.of_number ilike $${params.length} or ap.process_number ilike $${params.length} or s.name ilike $${params.length})`);
    }

    const result = await pool.query(
      `select so.*, s.name as supplier_name, ap.process_number,
              cb.full_name as created_by_name,
              (select count(*)::int from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null) as invoices_count,
              (select coalesce(sum(i.amount), 0) from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null and i.verified) as invoices_total,
              (select to_jsonb(d.*) from public.documents d where d.supply_order_id = so.id and d.kind = 'OF' and d.is_current) as document
         from public.supply_orders so
         join public.suppliers s on s.id = so.supplier_id
         join public.administrative_processes ap on ap.id = so.process_id
         left join public.profiles cb on cb.id = so.created_by
        where ${where.join(' and ')}
        order by so.issue_date desc, so.created_at desc`,
      params
    );

    res.json(
      result.rows.map((r) => ({
        ...r,
        total_value: r.total_value !== null ? Number(r.total_value) : null,
        invoices_total: Number(r.invoices_total || 0),
      }))
    );
  } catch (err) {
    next(err);
  }
});

supplyOrdersRouter.get('/supply-orders/:id', authenticate, requirePermission('processes.view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const ofRes = await pool.query(
      `select so.*, s.name as supplier_name, ap.process_number,
              cb.full_name as created_by_name,
              (select count(*)::int from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null) as invoices_count,
              (select coalesce(sum(i.amount), 0) from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null and i.verified) as invoices_total
         from public.supply_orders so
         join public.suppliers s on s.id = so.supplier_id
         join public.administrative_processes ap on ap.id = so.process_id
         left join public.profiles cb on cb.id = so.created_by
        where so.id = $1`,
      [id]
    );

    if (ofRes.rowCount === 0) {
      throw new AppError('Ordem de Fornecimento não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
    }

    const docsRes = await pool.query(
      `select d.*, ub.full_name as uploaded_by_name
         from public.documents d
         left join public.profiles ub on ub.id = d.uploaded_by
        where d.supply_order_id = $1
        order by d.version desc`,
      [id]
    );

    const invsRes = await pool.query(
      `select * from public.v_invoices where supply_order_id = $1 order by issue_date desc nulls last, created_at desc`,
      [id]
    );

    res.json({
      supply_order: {
        ...ofRes.rows[0],
        total_value: ofRes.rows[0].total_value !== null ? Number(ofRes.rows[0].total_value) : null,
        invoices_total: Number(ofRes.rows[0].invoices_total || 0),
      },
      documents: docsRes.rows,
      invoices: invsRes.rows.map((r) => ({
        ...r,
        amount: r.amount !== null ? Number(r.amount) : null,
        total_paid: Number(r.total_paid || 0),
        balance: r.balance !== null ? Number(r.balance) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

supplyOrdersRouter.post(
  '/supply-orders',
  authenticate,
  requirePermission('supply_orders.write'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const data = createSupplyOrderSchema.parse(req.body);
      const file = req.file;

      if (file && file.mimetype !== 'application/pdf') {
        throw new AppError('O arquivo da Ordem de Fornecimento deve ser um PDF.', {
          code: 'FORMATO_INVALIDO',
          status: 400,
        });
      }

      const result = await runInTransaction(
        { actorId: req.user!.id, requestId: req.requestId },
        async (client) => {
          const ins = await client.query(
            `insert into public.supply_orders (process_id, supplier_id, of_number, issue_date, total_value, notes)
             values ($1, $2, $3, $4, $5, $6)
             returning *`,
            [
              data.process_id,
              data.supplier_id,
              data.of_number,
              data.issue_date,
              data.total_value ?? null,
              data.notes || null,
            ]
          );
          const supplyOrder = ins.rows[0];

          if (file) {
            const uploadRes = await uploadDocument(file.buffer, 'OF', file.originalname, file.mimetype);
            await client.query(
              `insert into public.documents (kind, supply_order_id, storage_path, file_name, mime_type, size_bytes, sha256)
               values ('OF', $1, $2, $3, $4, $5, $6)`,
              [
                supplyOrder.id,
                uploadRes.storagePath,
                file.originalname,
                file.mimetype,
                uploadRes.sizeBytes,
                uploadRes.sha256,
              ]
            );
          }

          return supplyOrder;
        }
      );

      res.status(201).json({
        ...result,
        total_value: result.total_value !== null ? Number(result.total_value) : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

supplyOrdersRouter.patch(
  '/supply-orders/:id',
  authenticate,
  requirePermission('supply_orders.write'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = updateSupplyOrderSchema.parse(req.body);

      const result = await runInTransaction(
        { actorId: req.user!.id, reason: data.reason || null, requestId: req.requestId },
        async (client) => {
          const cur = await client.query('select * from public.supply_orders where id = $1', [id]);
          if (cur.rowCount === 0) {
            throw new AppError('Ordem de Fornecimento não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
          }

          const upd = await client.query(
            `update public.supply_orders
                set process_id = coalesce($1, process_id),
                    supplier_id = coalesce($2, supplier_id),
                    of_number = coalesce($3, of_number),
                    issue_date = coalesce($4, issue_date),
                    total_value = case when $5::boolean then $6::numeric else total_value end,
                    notes = coalesce($7, notes)
              where id = $8
              returning *`,
            [
              data.process_id ?? null,
              data.supplier_id ?? null,
              data.of_number ?? null,
              data.issue_date ?? null,
              data.total_value !== undefined,
              data.total_value ?? null,
              data.notes ?? null,
              id,
            ]
          );
          return upd.rows[0];
        }
      );

      res.json({
        ...result,
        total_value: result.total_value !== null ? Number(result.total_value) : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Substituição ou envio do PDF da OF
supplyOrdersRouter.post(
  '/supply-orders/:id/document',
  authenticate,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const file = req.file;
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

      if (!file) {
        throw new AppError('Arquivo não enviado.', { code: 'ARQUIVO_OBRIGATORIO', status: 400 });
      }
      if (file.mimetype !== 'application/pdf') {
        throw new AppError('O documento da OF deve ser um arquivo PDF.', { code: 'FORMATO_INVALIDO', status: 400 });
      }

      const result = await runInTransaction(
        { actorId: req.user!.id, reason: reason || null, requestId: req.requestId },
        async (client) => {
          const ofRes = await client.query('select * from public.supply_orders where id = $1', [id]);
          if (ofRes.rowCount === 0) {
            throw new AppError('Ordem de Fornecimento não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
          }

          const currentDoc = await client.query(
            `select * from public.documents where supply_order_id = $1 and kind = 'OF' and is_current = true`,
            [id]
          );

          let nextVersion = 1;
          if (currentDoc.rowCount > 0) {
            if (!reason) {
              throw new AppError('Justificativa é obrigatória ao substituir o documento da OF.', {
                code: 'JUSTIFICATIVA_OBRIGATORIA',
                status: 422,
              });
            }
            nextVersion = currentDoc.rows[0].version + 1;
            await client.query(
              `update public.documents
                  set is_current = false,
                      replaced_at = now(),
                      replaced_by = $1,
                      replace_reason = $2
                where id = $3`,
              [req.user!.id, reason, currentDoc.rows[0].id]
            );
          }

          const uploadRes = await uploadDocument(file.buffer, 'OF', file.originalname, file.mimetype);
          const ins = await client.query(
            `insert into public.documents (kind, supply_order_id, storage_path, file_name, mime_type, size_bytes, sha256, version, is_current)
             values ('OF', $1, $2, $3, $4, $5, $6, $7, true)
             returning *`,
            [id, uploadRes.storagePath, file.originalname, file.mimetype, uploadRes.sizeBytes, uploadRes.sha256, nextVersion]
          );
          return ins.rows[0];
        }
      );

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);
