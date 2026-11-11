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
    const municipality = typeof req.query.municipality === 'string' ? req.query.municipality.trim() : '';
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
    if (municipality) {
      params.push(`%${municipality}%`);
      where.push(`exists (select 1 from public.invoices i where i.supply_order_id = so.id and i.municipality ilike $${params.length})`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(so.of_number ilike $${params.length} or ap.process_number ilike $${params.length} or s.name ilike $${params.length} or exists (select 1 from public.invoices i where i.supply_order_id = so.id and i.municipality ilike $${params.length}))`
      );
    }

    const result = await pool.query(
      `select so.*, s.name as supplier_name, ap.process_number,
              cb.full_name as created_by_name,
              (select count(*)::int from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null) as invoices_count,
              (select coalesce(sum(i.amount), 0) from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null and i.verified) as invoices_total,
              (select string_agg(distinct i.municipality, ', ') from public.invoices i where i.supply_order_id = so.id and i.municipality is not null and trim(i.municipality) <> '') as municipalities,
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
  async (req, res, next) => {
    try {
      // 1. Apenas o perfil administrador pode editar
      if (req.user?.role !== 'admin') {
        throw new AppError('Apenas o Administrador possui permissão para editar dados de Ordens de Fornecimento.', {
          code: 'ACESSO_NEGADO',
          status: 403,
        });
      }

      const { id } = req.params;
      const data = updateSupplyOrderSchema.parse(req.body);
      const reason = data.reason?.trim() || 'Edição de dados pelo Administrador';

      const result = await runInTransaction(
        { actorId: req.user!.id, reason, requestId: req.requestId },
        async (client) => {
          const cur = await client.query('select * from public.supply_orders where id = $1', [id]);
          if (cur.rowCount === 0) {
            throw new AppError('Ordem de Fornecimento não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
          }
          const oldData = cur.rows[0];

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

          // Registra na auditoria
          await client.query(
            `insert into public.audit_logs (
              actor_id, actor_name, actor_role, action, entity_type, entity_id,
              summary, reason, old_data, new_data
            ) values ($1, $2, $3, 'OF_ALTERADA', 'supply_orders', $4, $5, $6, $7, $8)`,
            [
              req.user!.id,
              req.user!.full_name || 'Administrador',
              req.user!.role,
              id,
              `Alteração de dados da Ordem de Fornecimento nº ${upd.rows[0].of_number}`,
              reason,
              JSON.stringify(oldData),
              JSON.stringify(upd.rows[0]),
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

// Exclusão Administrativa de Ordem de Fornecimento + Notas Fiscais vinculadas (apenas admin e sem pagamentos efetivados)
supplyOrdersRouter.delete('/supply-orders/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // 1. Apenas o perfil administrador pode excluir
    if (req.user?.role !== 'admin') {
      throw new AppError('Apenas o Administrador possui permissão para excluir Ordens de Fornecimento.', {
        code: 'ACESSO_NEGADO',
        status: 403,
      });
    }

    // 2. Busca dados da OF
    const ofRes = await pool.query('select * from public.supply_orders where id = $1', [id]);
    if (ofRes.rowCount === 0) {
      throw new AppError('Ordem de Fornecimento não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
    }
    const order = ofRes.rows[0];

    // 3. Valida se existem Notas Fiscais com pagamentos válidos efetivados
    const payCheck = await pool.query(
      `select count(*)::int as count from public.payments p
       join public.invoices i on i.id = p.invoice_id
       where i.supply_order_id = $1 and p.status = 'VALIDO'`,
      [id]
    );
    if ((payCheck.rows[0]?.count || 0) > 0) {
      throw new AppError(
        'Esta Ordem de Fornecimento possui Notas Fiscais com pagamentos já confirmados/efetivados e não pode ser excluída. Cancele/estorne os pagamentos antes de excluir.',
        { code: 'REGRA_VIOLADA', status: 400 }
      );
    }

    // 4. Busca dados das notas fiscais vinculadas para registro detalhado na auditoria
    const invRes = await pool.query(
      `select * from public.v_invoices where supply_order_id = $1`,
      [id]
    );
    const linkedInvoices = invRes.rows;

    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim()
      : 'Ordem de Fornecimento e notas vinculadas excluídas pelo Administrador.';

    await runInTransaction(
      { actorId: req.user.id, reason, requestId: req.requestId },
      async (client) => {
        // Remove documentos vinculados aos pagamentos das NFs desta OF
        await client.query(
          `delete from public.documents
            where payment_id in (
              select p.id from public.payments p
              join public.invoices i on i.id = p.invoice_id
              where i.supply_order_id = $1
            )`,
          [id]
        );

        // Remove pagamentos das NFs desta OF
        await client.query(
          `delete from public.payments
            where invoice_id in (select id from public.invoices where supply_order_id = $1)`,
          [id]
        );

        // Remove históricos de pendências das NFs desta OF
        await client.query(
          `delete from public.historical_statuses
            where invoice_id in (select id from public.invoices where supply_order_id = $1)`,
          [id]
        );

        // Remove documentos vinculados às NFs desta OF
        await client.query(
          `delete from public.documents
            where invoice_id in (select id from public.invoices where supply_order_id = $1)`,
          [id]
        );

        // Remove as NFs vinculadas a esta OF
        await client.query('delete from public.invoices where supply_order_id = $1', [id]);

        // Remove documentos vinculados à própria OF (PDF da OF)
        await client.query('delete from public.documents where supply_order_id = $1', [id]);

        // Exclui a OF
        await client.query('delete from public.supply_orders where id = $1', [id]);

        // Registra logs de auditoria para cada NF excluída em conjunto
        for (const inv of linkedInvoices) {
          await client.query(
            `insert into public.audit_logs (
              actor_id, actor_name, actor_role, action, entity_type, entity_id,
              summary, reason, old_data
            ) values ($1, $2, $3, 'NF_EXCLUIDA', 'invoices', $4, $5, $6, $7)`,
            [
              req.user!.id,
              req.user!.full_name || 'Administrador',
              req.user!.role,
              inv.id,
              `Exclusão da NF nº ${inv.invoice_number} junto à OF nº ${order.of_number}`,
              reason,
              JSON.stringify(inv),
            ]
          );
        }

        // Registra log formal de auditoria da OF
        await client.query(
          `insert into public.audit_logs (
            actor_id, actor_name, actor_role, action, entity_type, entity_id,
            summary, reason, old_data
          ) values ($1, $2, $3, 'OF_EXCLUIDA', 'supply_orders', $4, $5, $6, $7)`,
          [
            req.user!.id,
            req.user!.full_name || 'Administrador',
            req.user!.role,
            id,
            `Exclusão da Ordem de Fornecimento nº ${order.of_number}${linkedInvoices.length > 0 ? ` e de ${linkedInvoices.length} nota(s) vinculada(s)` : ''}`,
            reason,
            JSON.stringify(order),
          ]
        );
      }
    );

    const message = linkedInvoices.length > 0
      ? `Ordem de Fornecimento nº ${order.of_number} e ${linkedInvoices.length} nota(s) fiscal(is) vinculada(s) excluída(s) com sucesso.`
      : `Ordem de Fornecimento nº ${order.of_number} excluída com sucesso.`;

    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
});

