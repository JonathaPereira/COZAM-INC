import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { uploadDocument } from '../services/storage.js';
import {
  reserveContractItems,
  releaseReservedContractItems,
  revertDeliveredContractItems,
} from '../services/contract-balance.js';
import { AppError } from '../middleware/errors.js';

export const supplyOrdersRouter = Router();

const createSupplyOrderSchema = z.object({
  process_id: z.string().uuid('ID do processo inválido.').optional().nullable(),
  contract_id: z.string().uuid('ID do contrato inválido.').optional().nullable(),
  destination_id: z.string().uuid('ID do destinatário inválido.').optional().nullable(),
  supplier_id: z.string().uuid('ID do fornecedor inválido.'),
  of_number: z.string().trim().optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de emissão inválida.'),
  total_value: z.coerce.number().min(0, 'Valor total não pode ser negativo.').optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  municipality: z.string().trim().optional().nullable(),
  items: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return val;
    }, z.array(z.object({
      contract_item_id: z.string().uuid(),
      quantity: z.coerce.number().positive('Quantidade deve ser positiva.'),
    })))
    .optional(),
});

const updateSupplyOrderSchema = z.object({
  process_id: z.string().uuid().optional(),
  contract_id: z.string().uuid().optional().nullable(),
  destination_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional(),
  of_number: z.string().trim().min(1).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  total_value: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  municipality: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional(),
});

const cancelSupplyOrderSchema = z.object({
  reason: z.string().trim().min(1, 'Justificativa do cancelamento é obrigatória.'),
  items_delivered: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return val;
    }, z.array(z.object({
      contract_item_id: z.string().uuid(),
      delivered_quantity: z.coerce.number().min(0),
    })))
    .optional(),
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
      where.push(`(so.municipality ilike $${params.length} or exists (select 1 from public.invoices i where i.supply_order_id = so.id and i.municipality ilike $${params.length}))`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(so.of_number ilike $${params.length} or ap.process_number ilike $${params.length} or s.name ilike $${params.length} or so.municipality ilike $${params.length} or exists (select 1 from public.invoices i where i.supply_order_id = so.id and i.municipality ilike $${params.length}))`
      );
    }

    const result = await pool.query(
      `select so.*, s.name as supplier_name, ap.process_number,
              c.contract_number, d.name as destination_name,
              cb.full_name as created_by_name,
              (select count(*)::int from public.supply_order_items soi where soi.supply_order_id = so.id) as items_count,
              (select count(*)::int from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null) as invoices_count,
              (select coalesce(sum(i.amount), 0) from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null and i.verified) as invoices_total,
              (select string_agg(distinct i.municipality, ', ') from public.invoices i where i.supply_order_id = so.id and i.municipality is not null and trim(i.municipality) <> '') as municipalities,
              (select to_jsonb(doc.*) from public.documents doc where doc.supply_order_id = so.id and doc.kind = 'OF' and doc.is_current) as document
         from public.supply_orders so
         join public.suppliers s on s.id = so.supplier_id
         join public.administrative_processes ap on ap.id = so.process_id
         left join public.contracts c on c.id = so.contract_id
         left join public.destinations d on d.id = so.destination_id
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
        items_count: Number(r.items_count || 0),
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
      `select so.*, s.name as supplier_name, s.cnpj as supplier_cnpj, s.legal_name as supplier_legal_name,
              ap.process_number,
              c.contract_number, c.object as contract_object, c.legal_framework as contract_legal_framework,
              c.signing_date as contract_signing_date, c.start_date as contract_start_date, c.end_date as contract_end_date,
              d.name as destination_name, d.city as destination_city,
              cb.full_name as created_by_name,
              (select count(*)::int from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null) as invoices_count,
              (select coalesce(sum(i.amount), 0) from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null and i.verified) as invoices_total
         from public.supply_orders so
         join public.suppliers s on s.id = so.supplier_id
         join public.administrative_processes ap on ap.id = so.process_id
         left join public.contracts c on c.id = so.contract_id
         left join public.destinations d on d.id = so.destination_id
         left join public.profiles cb on cb.id = so.created_by
        where so.id = $1`,
      [id]
    );

    if (ofRes.rowCount === 0) {
      throw new AppError('Ordem de Fornecimento não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
    }

    const itemsRes = await pool.query(
      `select soi.*, ci.item_code, ci.description, ci.unit, ci.category
         from public.supply_order_items soi
         join public.contract_items ci on ci.id = soi.contract_item_id
        where soi.supply_order_id = $1
        order by ci.item_code asc`,
      [id]
    );

    const movementsRes = await pool.query(
      `select m.*, ci.item_code, ci.description
         from public.contract_item_movements m
         join public.contract_items ci on ci.id = m.contract_item_id
        where m.supply_order_id = $1
        order by m.created_at asc`,
      [id]
    );

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
      items: itemsRes.rows.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total_price: Number(it.total_price),
        delivered_quantity: Number(it.delivered_quantity || 0),
      })),
      movements: movementsRes.rows.map((m) => ({
        ...m,
        quantity: Number(m.quantity),
        unit_price: Number(m.unit_price),
        total_amount: Number(m.total_amount),
      })),
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
          let processId = data.process_id;
          const contractId = data.contract_id;
          const destinationId = data.destination_id;
          let ofNumber = data.of_number?.trim();
          let calculatedTotal = data.total_value ?? null;
          const orderStatus = data.items && data.items.length > 0 ? 'AGUARDANDO_ASSINATURA' : 'CONFIRMADA';

          if (contractId) {
            const cRes = await client.query('select procurement_id from public.contracts where id = $1', [contractId]);
            if (cRes.rowCount > 0 && !processId) {
              const procId = cRes.rows[0].procurement_id;
              if (procId) {
                const apRes = await client.query('select id from public.administrative_processes where id = $1', [procId]);
                if (apRes.rowCount > 0) processId = procId;
              }
            }
          }

          if (!processId) {
            const defaultProc = await client.query('select id from public.administrative_processes order by created_at desc limit 1');
            if (defaultProc.rowCount > 0) {
              processId = defaultProc.rows[0].id;
            } else {
              const newProc = await client.query(
                `insert into public.administrative_processes (process_number, description, created_by) values ('PROC-GERAL/2026', 'Processo Geral de Compras', $1) returning id`,
                [req.user!.id]
              );
              processId = newProc.rows[0].id;
            }
          }

          const year = new Date(data.issue_date).getFullYear();
          if (!ofNumber || ofNumber === 'AUTO') {
            const countRes = await client.query(
              'select count(*)::int as total from public.supply_orders where extract(year from issue_date) = $1',
              [year]
            );
            const nextSeq = (countRes.rows[0].total + 1).toString().padStart(3, '0');
            ofNumber = `OF ${nextSeq}/${year}`;
          }

          const trackingCode = crypto.randomUUID();

          // Se itens foram enviados com contrato:
          const itemRowsToInsert: any[] = [];
          if (contractId && data.items && data.items.length > 0) {
            let total = 0;
            for (const it of data.items) {
              const itRes = await client.query(
                'select unit_price from public.contract_items where id = $1 and contract_id = $2',
                [it.contract_item_id, contractId]
              );
              if (itRes.rowCount === 0) {
                throw new AppError(`Item contratual não encontrado para este contrato.`, { code: 'ITEM_NAO_ENCONTRADO', status: 404 });
              }
              const unitPrice = Number(itRes.rows[0].unit_price);
              const lineTotal = Math.round(it.quantity * unitPrice * 100) / 100;
              total += lineTotal;
              itemRowsToInsert.push({
                contract_item_id: it.contract_item_id,
                quantity: it.quantity,
                unit_price: unitPrice,
                total_price: lineTotal,
              });
            }
            calculatedTotal = total;
          }

          const ins = await client.query(
            `insert into public.supply_orders 
             (process_id, contract_id, destination_id, supplier_id, of_number, issue_date, total_value, notes, municipality, status, tracking_code, created_by)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             returning *`,
            [
              processId,
              contractId || null,
              destinationId || null,
              data.supplier_id,
              ofNumber,
              data.issue_date,
              calculatedTotal,
              data.notes || null,
              data.municipality || null,
              orderStatus,
              trackingCode,
              req.user!.id,
            ]
          );
          const supplyOrder = ins.rows[0];

          // Grava os itens da OF e reserva o saldo
          if (contractId && itemRowsToInsert.length > 0) {
            for (const item of itemRowsToInsert) {
              await client.query(
                `insert into public.supply_order_items (supply_order_id, contract_item_id, quantity, unit_price, total_price)
                 values ($1, $2, $3, $4, $5)`,
                [supplyOrder.id, item.contract_item_id, item.quantity, item.unit_price, item.total_price]
              );
            }

            await reserveContractItems(
              client,
              contractId,
              data.items!,
              supplyOrder.id,
              req.user!.id,
              data.issue_date
            );
          }

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
                    notes = coalesce($7, notes),
                    municipality = case when $8::boolean then $9::text else municipality end
              where id = $10
              returning *`,
            [
              data.process_id ?? null,
              data.supplier_id ?? null,
              data.of_number ?? null,
              data.issue_date ?? null,
              data.total_value !== undefined,
              data.total_value ?? null,
              data.notes ?? null,
              data.municipality !== undefined,
              data.municipality ?? null,
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

// Cancelamento de Ordem de Fornecimento com liberação ou estorno de saldo
supplyOrdersRouter.post(
  '/supply-orders/:id/cancel',
  authenticate,
  requirePermission('supply_orders.write'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = cancelSupplyOrderSchema.parse(req.body);

      const result = await runInTransaction(
        { actorId: req.user!.id, requestId: req.requestId },
        async (client) => {
          const ofRes = await client.query('select * from public.supply_orders where id = $1 for update', [id]);
          if (ofRes.rowCount === 0) {
            throw new AppError('Ordem de Fornecimento não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
          }

          const order = ofRes.rows[0];
          if (order.status === 'CANCELADA') {
            throw new AppError('Esta Ordem de Fornecimento já está cancelada.', { code: 'ORDEM_JA_CANCELADA', status: 400 });
          }

          // Se estiver aguardando assinatura, libera as reservas
          if (order.status === 'AGUARDANDO_ASSINATURA') {
            if (order.contract_id) {
              await releaseReservedContractItems(client, id, data.reason, req.user!.id);
            }
          } else if (order.status === 'CONFIRMADA' || order.status === 'PARCIALMENTE_ATENDIDA') {
            // Se confirmada, estorna apenas as quantidades não fornecidas
            if (order.contract_id) {
              const soItems = await client.query(
                'select * from public.supply_order_items where supply_order_id = $1',
                [id]
              );

              const itemsToRevert: { contract_item_id: string; quantity: number }[] = [];
              for (const it of soItems.rows) {
                let delivered = 0;
                if (data.items_delivered) {
                  const match = data.items_delivered.find((d) => d.contract_item_id === it.contract_item_id);
                  if (match) delivered = match.delivered_quantity;
                }
                const notDelivered = Number(it.quantity) - delivered;
                if (notDelivered > 0) {
                  itemsToRevert.push({
                    contract_item_id: it.contract_item_id,
                    quantity: notDelivered,
                  });
                }
                if (data.items_delivered) {
                  await client.query(
                    'update public.supply_order_items set delivered_quantity = $1 where id = $2',
                    [delivered, it.id]
                  );
                }
              }

              if (itemsToRevert.length > 0) {
                await revertDeliveredContractItems(client, id, itemsToRevert, data.reason, req.user!.id);
              }
            }
          }

          await client.query(
            `update public.supply_orders 
                set status = 'CANCELADA', notes = coalesce(notes || E'\\n', '') || 'Cancelamento: ' || $1, updated_at = now()
              where id = $2`,
            [data.reason, id]
          );

          await client.query(
            `insert into public.audit_logs (
              actor_id, actor_name, actor_role, action, entity_type, entity_id,
              summary, reason, old_data
            ) values ($1, $2, $3, 'OF_CANCELADA', 'supply_orders', $4, $5, $6, $7)`,
            [
              req.user!.id,
              req.user!.full_name || 'Usuário',
              req.user!.role,
              id,
              `Cancelamento da OF nº ${order.of_number}`,
              data.reason,
              JSON.stringify(order),
            ]
          );

          const updatedOf = await client.query('select * from public.supply_orders where id = $1', [id]);
          return updatedOf.rows[0];
        }
      );

      res.json({
        success: true,
        supply_order: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

