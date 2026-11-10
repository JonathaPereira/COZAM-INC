import { Router } from 'express';
import { z } from 'zod';
import { can } from '@cozam/shared';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { uploadDocument } from '../services/storage.js';
import { AppError } from '../middleware/errors.js';

export const invoicesRouter = Router();

const createInvoiceSchema = z.object({
  supply_order_id: z.string().uuid('ID da Ordem de Fornecimento inválido.'),
  invoice_number: z.string().trim().min(1, 'Número da Nota Fiscal é obrigatório.'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de emissão inválida.'),
  amount: z.coerce.number().positive('O valor da Nota Fiscal deve ser maior que zero.'),
  modality: z.enum(['FUMIP', 'COMPRA_COMPARTILHADA'], {
    errorMap: () => ({ message: 'Selecione a modalidade: FUMIP ou Compra Compartilhada.' }),
  }),
  municipality: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  forward: z.union([z.boolean(), z.string()]).optional(),
});

const updateInvoiceSchema = z.object({
  supply_order_id: z.string().uuid().optional(),
  invoice_number: z.string().trim().min(1).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.coerce.number().positive().optional(),
  modality: z.enum(['FUMIP', 'COMPRA_COMPARTILHADA']).optional(),
  municipality: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional(),
});

const createHistoricalSchema = z.object({
  supplier_id: z.string().uuid('ID do fornecedor inválido.'),
  invoice_number: z.string().trim().min(1, 'Número da Nota Fiscal é obrigatório.'),
  reported_status: z.enum(['SEM_INFORMACAO', 'PENDENTE', 'PARCIALMENTE_PAGA', 'PAGA']),
  informed_by: z.string().trim().min(1, 'Informe quem forneceu a informação.'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  amount: z.coerce.number().positive().optional().nullable(),
  modality: z.enum(['FUMIP', 'COMPRA_COMPARTILHADA']).optional().nullable(),
  supply_order_id: z.string().uuid().optional().nullable(),
  municipality: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  known_paid_amount: z.coerce.number().min(0).optional().nullable(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  historical_notes: z.string().trim().optional().nullable(),
});

// Lista de municípios oficiais e cadastrados
invoicesRouter.get('/invoices/municipalities', authenticate, async (_req, res, next) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `select distinct municipality from public.invoices
        where municipality is not null and trim(municipality) <> ''
        order by municipality asc`
    );

    const defaultMunicipalities = [
      'Santana do Mundaú',
      'Branquinha',
      'União dos Palmares',
      'Carneiros',
    ];

    const dbMunicipalities = result.rows.map((r: { municipality: string }) => r.municipality.trim());
    const all = Array.from(new Set([...defaultMunicipalities, ...dbMunicipalities])).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );

    res.json({ municipalities: all });
  } catch (err) {
    next(err);
  }
});

// Verificação de duplicidade
invoicesRouter.get('/invoices/check-duplicate', authenticate, async (req, res, next) => {
  try {
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const invoiceNumber = typeof req.query.invoice_number === 'string' ? req.query.invoice_number.trim() : '';

    if (!supplierId || !invoiceNumber) {
      res.json({ exists: false });
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      `select * from public.v_invoices
        where supplier_id = $1
          and upper(trim(invoice_number)) = upper(trim($2))
          and cancelled_at is null
        limit 1`,
      [supplierId, invoiceNumber]
    );

    if (result.rowCount === 0) {
      res.json({ exists: false });
    } else {
      const row = result.rows[0];
      res.json({
        exists: true,
        invoice: {
          ...row,
          amount: row.amount !== null ? Number(row.amount) : null,
          total_paid: Number(row.total_paid || 0),
          balance: row.balance !== null ? Number(row.balance) : null,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

// Listagem de NFs
invoicesRouter.get('/invoices', authenticate, async (req, res, next) => {
  try {
    const pool = getPool();
    const user = req.user!;
    const isPagamentos = user.role === 'pagamentos';

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const processId = typeof req.query.process_id === 'string' ? req.query.process_id.trim() : '';
    const supplyOrderId = typeof req.query.supply_order_id === 'string' ? req.query.supply_order_id.trim() : '';
    const municipality = typeof req.query.municipality === 'string' ? req.query.municipality.trim() : '';
    const modality = typeof req.query.modality === 'string' ? req.query.modality.trim() : '';
    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const forwardStatus = typeof req.query.forward_status === 'string' ? req.query.forward_status.trim() : '';
    const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';
    const queue = req.query.queue === '1' || req.query.queue === 'true';
    const historical = req.query.historical;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'issue_date_desc';

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = ['1=1'];
    const params: any[] = [];

    // Regra de visibilidade para Pagamentos
    if (isPagamentos) {
      where.push(`(i.forward_status <> 'RASCUNHO' or i.is_historical = true)`);
    }

    if (queue) {
      // Fila do painel de Pagamentos: somente encaminhadas ou em atendimento
      where.push(`(i.forward_status in ('ENCAMINHADA', 'EM_ATENDIMENTO') or (i.is_historical = true and i.status <> 'TOTALMENTE_PAGA'))`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(i.invoice_number ilike $${params.length} or s.name ilike $${params.length} or ap.process_number ilike $${params.length})`
      );
    }
    if (supplierId) {
      params.push(supplierId);
      where.push(`i.supplier_id = $${params.length}`);
    }
    if (processId) {
      params.push(processId);
      where.push(`i.process_id = $${params.length}`);
    }
    if (supplyOrderId) {
      params.push(supplyOrderId);
      where.push(`i.supply_order_id = $${params.length}`);
    }
    if (municipality) {
      params.push(`%${municipality}%`);
      where.push(`i.municipality ilike $${params.length}`);
    }
    if (modality) {
      params.push(modality);
      where.push(`i.modality = $${params.length}`);
    }
    if (statusParam) {
      const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        params.push(statuses);
        where.push(`i.status = any($${params.length}::public.invoice_status[])`);
      }
    }
    if (forwardStatus) {
      params.push(forwardStatus);
      where.push(`i.forward_status = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      where.push(`i.issue_date >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      where.push(`i.issue_date <= $${params.length}`);
    }
    if (historical === 'true' || historical === '1') {
      where.push(`i.is_historical = true`);
    } else if (historical === 'false' || historical === '0') {
      where.push(`i.is_historical = false`);
    }

    let orderBy = 'i.issue_date desc nulls last, i.created_at desc';
    if (sort === 'issue_date_asc') orderBy = 'i.issue_date asc nulls first, i.created_at asc';
    if (sort === 'amount_desc') orderBy = 'i.amount desc nulls last';
    if (sort === 'balance_desc') orderBy = 'balance desc nulls last';
    if (sort === 'forwarded_desc') orderBy = 'i.forwarded_at desc nulls last';

    const whereClause = where.join(' and ');

    const countRes = await pool.query(
      `select count(*)::int as total,
              coalesce(sum(case when i.verified and i.status <> 'CANCELADA' then i.amount else 0 end), 0) as total_amount,
              coalesce(sum(case when i.status <> 'CANCELADA' then i.total_paid else 0 end), 0) as total_paid
         from public.v_invoices i
         join public.suppliers s on s.id = i.supplier_id
         left join public.administrative_processes ap on ap.id = i.process_id
        where ${whereClause}`,
      params
    );

    const total = countRes.rows[0]?.total || 0;
    const totalAmount = Number(countRes.rows[0]?.total_amount || 0);
    const totalPaid = Number(countRes.rows[0]?.total_paid || 0);
    const totalBalance = totalAmount - totalPaid;

    params.push(pageSize, offset);
    const listRes = await pool.query(
      `select i.*
         from public.v_invoices i
         join public.suppliers s on s.id = i.supplier_id
         left join public.administrative_processes ap on ap.id = i.process_id
        where ${whereClause}
        order by ${orderBy}
        limit $${params.length - 1} offset $${params.length}`,
      params
    );

    res.json({
      data: listRes.rows.map((r) => ({
        ...r,
        amount: r.amount !== null ? Number(r.amount) : null,
        total_paid: Number(r.total_paid || 0),
        balance: r.balance !== null ? Number(r.balance) : null,
      })),
      total,
      page,
      pageSize,
      summary: {
        amount: totalAmount,
        total_paid: totalPaid,
        balance: totalBalance,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Detalhes da NF
invoicesRouter.get('/invoices/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const user = req.user!;

    const invRes = await pool.query('select * from public.v_invoices where id = $1', [id]);
    if (invRes.rowCount === 0) {
      throw new AppError('Nota Fiscal não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
    }

    const invoice = invRes.rows[0];
    if (user.role === 'pagamentos' && invoice.forward_status === 'RASCUNHO' && !invoice.is_historical) {
      throw new AppError('Esta Nota Fiscal ainda não foi encaminhada para o setor de Pagamentos.', {
        code: 'ACESSO_NEGADO',
        status: 403,
      });
    }

    const payRes = await pool.query(
      `select * from public.v_payments where invoice_id = $1 order by payment_date asc nulls last, created_at asc`,
      [id]
    );

    const docRes = await pool.query(
      `select d.*, ub.full_name as uploaded_by_name
         from public.documents d
         left join public.profiles ub on ub.id = d.uploaded_by
        where d.invoice_id = $1
           or (d.supply_order_id = $2 and d.kind = 'OF')
           or d.payment_id in (select p.id from public.payments p where p.invoice_id = $1)
        order by d.kind asc, d.version desc`,
      [id, invoice.supply_order_id]
    );

    const histRes = await pool.query(
      `select hs.*, cb.full_name as created_by_name
         from public.historical_statuses hs
         left join public.profiles cb on cb.id = hs.created_by
        where hs.invoice_id = $1
        order by hs.created_at desc`,
      [id]
    );

    const auditRes = await pool.query(
      `select * from public.audit_logs
        where invoice_id = $1 or (entity_type = 'invoices' and entity_id = $1)
        order by occurred_at desc
        limit 100`,
      [id]
    );

    res.json({
      invoice: {
        ...invoice,
        amount: invoice.amount !== null ? Number(invoice.amount) : null,
        total_paid: Number(invoice.total_paid || 0),
        balance: invoice.balance !== null ? Number(invoice.balance) : null,
      },
      payments: payRes.rows.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      documents: docRes.rows,
      historical: histRes.rows.map((h) => ({
        ...h,
        known_paid_amount: h.known_paid_amount !== null ? Number(h.known_paid_amount) : null,
      })),
      audit: auditRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// Cadastro de NF regular
invoicesRouter.post(
  '/invoices',
  authenticate,
  requirePermission('invoices.write'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const data = createInvoiceSchema.parse(req.body);
      const file = req.file;
      const shouldForward = data.forward === true || data.forward === 'true';

      if (!file) {
        throw new AppError('O arquivo PDF da Nota Fiscal é obrigatório no cadastro.', {
          code: 'ARQUIVO_OBRIGATORIO',
          status: 400,
        });
      }
      if (file.mimetype !== 'application/pdf') {
        throw new AppError('O arquivo da Nota Fiscal deve ser um PDF.', {
          code: 'FORMATO_INVALIDO',
          status: 400,
        });
      }

      const result = await runInTransaction(
        { actorId: req.user!.id, requestId: req.requestId },
        async (client) => {
          // Busca a OF para obter o supplier_id e process_id
          const ofRes = await client.query('select * from public.supply_orders where id = $1', [data.supply_order_id]);
          if (ofRes.rowCount === 0) {
            throw new AppError('Ordem de Fornecimento não encontrada.', { code: 'OF_INEXISTENTE', status: 404 });
          }
          const ofRow = ofRes.rows[0];

          // Insere a NF inicialmente em RASCUNHO
          const ins = await client.query(
            `insert into public.invoices (
               supply_order_id, process_id, supplier_id, invoice_number, issue_date,
               amount, modality, municipality, notes, is_historical, verified, forward_status
             ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, true, 'RASCUNHO')
             returning *`,
            [
              data.supply_order_id,
              ofRow.process_id,
              ofRow.supplier_id,
              data.invoice_number,
              data.issue_date,
              data.amount,
              data.modality,
              data.municipality || null,
              data.notes || null,
            ]
          );
          const invoice = ins.rows[0];

          // Upload do PDF da NF
          const uploadRes = await uploadDocument(file.buffer, 'NF', file.originalname, file.mimetype);
          await client.query(
            `insert into public.documents (kind, invoice_id, storage_path, file_name, mime_type, size_bytes, sha256)
             values ('NF', $1, $2, $3, $4, $5, $6)`,
            [invoice.id, uploadRes.storagePath, file.originalname, file.mimetype, uploadRes.sizeBytes, uploadRes.sha256]
          );

          // Se requested encaminhamento imediato
          if (shouldForward) {
            if (!can(req.user, 'invoices.forward')) {
              throw new AppError('Você não tem permissão para encaminhar esta Nota Fiscal.', {
                code: 'ACESSO_NEGADO',
                status: 403,
              });
            }
            const fwd = await client.query(
              `update public.invoices
                  set forward_status = 'ENCAMINHADA',
                      forwarded_at = now(),
                      forwarded_by = $1
                where id = $2
                returning *`,
              [req.user!.id, invoice.id]
            );
            return fwd.rows[0];
          }

          return invoice;
        }
      );

      res.status(201).json({
        ...result,
        amount: Number(result.amount),
        total_paid: Number(result.total_paid || 0),
        balance: Number(result.amount) - Number(result.total_paid || 0),
      });
    } catch (err) {
      next(err);
    }
  }
);

// Encaminhar NF para Pagamentos
invoicesRouter.post('/invoices/:id/forward', authenticate, requirePermission('invoices.forward'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.invoices where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Nota Fiscal não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
        }
        if (cur.rows[0].forward_status !== 'RASCUNHO') {
          throw new AppError('Esta Nota Fiscal já foi encaminhada anteriormente.', {
            code: 'JA_ENCAMINHADA',
            status: 422,
          });
        }

        const upd = await client.query(
          `update public.invoices
              set forward_status = 'ENCAMINHADA',
                  forwarded_at = now(),
                  forwarded_by = $1
            where id = $2
            returning *`,
          [req.user!.id, id]
        );
        return upd.rows[0];
      }
    );

    res.json({
      ...result,
      amount: result.amount !== null ? Number(result.amount) : null,
      total_paid: Number(result.total_paid || 0),
      balance: result.amount !== null ? Number(result.amount) - Number(result.total_paid || 0) : null,
    });
  } catch (err) {
    next(err);
  }
});

// Iniciar atendimento pelo setor de Pagamentos
invoicesRouter.post('/invoices/:id/attend', authenticate, requirePermission('payments.register'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.invoices where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Nota Fiscal não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
        }
        const upd = await client.query(
          `update public.invoices
              set forward_status = 'EM_ATENDIMENTO',
                  attended_at = coalesce(attended_at, now()),
                  attended_by = coalesce(attended_by, $1)
            where id = $2
            returning *`,
          [req.user!.id, id]
        );
        return upd.rows[0];
      }
    );

    res.json({
      ...result,
      amount: result.amount !== null ? Number(result.amount) : null,
      total_paid: Number(result.total_paid || 0),
      balance: result.amount !== null ? Number(result.amount) - Number(result.total_paid || 0) : null,
    });
  } catch (err) {
    next(err);
  }
});

// Alteração de NF
invoicesRouter.patch('/invoices/:id', authenticate, requirePermission('invoices.write'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateInvoiceSchema.parse(req.body);

    const result = await runInTransaction(
      { actorId: req.user!.id, reason: data.reason || null, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.invoices where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Nota Fiscal não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
        }
        const row = cur.rows[0];
        if (row.forward_status !== 'RASCUNHO' && !data.reason) {
          throw new AppError('Informe a justificativa da alteração para Notas Fiscais já encaminhadas.', {
            code: 'JUSTIFICATIVA_OBRIGATORIA',
            status: 422,
          });
        }

        const upd = await client.query(
          `update public.invoices
              set supply_order_id = coalesce($1, supply_order_id),
                  invoice_number = coalesce($2, invoice_number),
                  issue_date = coalesce($3, issue_date),
                  amount = coalesce($4, amount),
                  modality = coalesce($5, modality),
                  municipality = coalesce($6, municipality),
                  notes = coalesce($7, notes)
            where id = $8
            returning *`,
          [
            data.supply_order_id ?? null,
            data.invoice_number ?? null,
            data.issue_date ?? null,
            data.amount ?? null,
            data.modality ?? null,
            data.municipality ?? null,
            data.notes ?? null,
            id,
          ]
        );
        return upd.rows[0];
      }
    );

    res.json({
      ...result,
      amount: result.amount !== null ? Number(result.amount) : null,
      total_paid: Number(result.total_paid || 0),
      balance: result.amount !== null ? Number(result.amount) - Number(result.total_paid || 0) : null,
    });
  } catch (err) {
    next(err);
  }
});

// Cancelamento de NF
invoicesRouter.post('/invoices/:id/cancel', authenticate, requirePermission('invoices.cancel'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    if (!reason) {
      throw new AppError('Informe a justificativa do cancelamento da Nota Fiscal.', {
        code: 'JUSTIFICATIVA_OBRIGATORIA',
        status: 422,
      });
    }

    const result = await runInTransaction(
      { actorId: req.user!.id, reason, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.invoices where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Nota Fiscal não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
        }

        const upd = await client.query(
          `update public.invoices
              set cancelled_at = now(),
                  cancelled_by = $1,
                  cancel_reason = $2
            where id = $3
            returning *`,
          [req.user!.id, reason, id]
        );
        return upd.rows[0];
      }
    );

    res.json({
      ...result,
      amount: result.amount !== null ? Number(result.amount) : null,
      total_paid: Number(result.total_paid || 0),
      balance: 0,
    });
  } catch (err) {
    next(err);
  }
});

// Substituição do PDF da NF
invoicesRouter.post(
  '/invoices/:id/document',
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
        throw new AppError('O documento da Nota Fiscal deve ser um arquivo PDF.', {
          code: 'FORMATO_INVALIDO',
          status: 400,
        });
      }

      const result = await runInTransaction(
        { actorId: req.user!.id, reason: reason || null, requestId: req.requestId },
        async (client) => {
          const invRes = await client.query('select * from public.invoices where id = $1', [id]);
          if (invRes.rowCount === 0) {
            throw new AppError('Nota Fiscal não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
          }

          const currentDoc = await client.query(
            `select * from public.documents where invoice_id = $1 and kind = 'NF' and is_current = true`,
            [id]
          );

          let nextVersion = 1;
          if (currentDoc.rowCount > 0) {
            if (!can(req.user, 'documents.replace')) {
              throw new AppError('Você não tem permissão para substituir documentos.', {
                code: 'ACESSO_NEGADO',
                status: 403,
              });
            }
            if (!reason) {
              throw new AppError('Justificativa é obrigatória ao substituir o documento da Nota Fiscal.', {
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

          const uploadRes = await uploadDocument(file.buffer, 'NF', file.originalname, file.mimetype);
          const ins = await client.query(
            `insert into public.documents (kind, invoice_id, storage_path, file_name, mime_type, size_bytes, sha256, version, is_current)
             values ('NF', $1, $2, $3, $4, $5, $6, $7, true)
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

// Cadastro de pendência histórica
invoicesRouter.post(
  '/invoices/historical',
  authenticate,
  requirePermission('historical.write'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const data = createHistoricalSchema.parse(req.body);
      const file = req.file;

      if (data.reported_status === 'SEM_INFORMACAO') {
        // Sem informação: não pode ter pagamento conhecido
        if (data.known_paid_amount && data.known_paid_amount > 0) {
          throw new AppError('Notas sem informação não podem ter pagamentos registrados.', {
            code: 'INFORMACAO_CONTRADITORIA',
            status: 422,
          });
        }
      } else {
        // Verificada: valor da NF é obrigatório
        if (!data.amount || data.amount <= 0) {
          throw new AppError('Para notas verificadas (pendentes ou pagas), informe o valor da Nota Fiscal.', {
            code: 'VALOR_OBRIGATORIO',
            status: 422,
          });
        }
      }

      if (data.reported_status === 'PARCIALMENTE_PAGA') {
        if (!data.known_paid_amount || data.known_paid_amount <= 0 || data.known_paid_amount >= (data.amount || 0)) {
          throw new AppError('Para notas parcialmente pagas, o valor pago deve ser maior que zero e menor que o total da NF.', {
            code: 'VALOR_PAGO_INVALIDO',
            status: 422,
          });
        }
      }

      if (data.reported_status === 'PAGA') {
        if (!data.known_paid_amount || data.known_paid_amount !== data.amount) {
          throw new AppError('Para confirmar como totalmente paga, o valor pago deve ser exatamente igual ao valor da NF.', {
            code: 'VALOR_PAGO_DIVERGENTE',
            status: 422,
          });
        }
      }

      const isVerified = data.reported_status !== 'SEM_INFORMACAO';

      const result = await runInTransaction(
        { actorId: req.user!.id, requestId: req.requestId },
        async (client) => {
          let processId: string | null = null;
          if (data.supply_order_id) {
            const ofRes = await client.query('select process_id from public.supply_orders where id = $1', [data.supply_order_id]);
            if (ofRes.rowCount > 0) processId = ofRes.rows[0].process_id;
          }

          const insInv = await client.query(
            `insert into public.invoices (
               supplier_id, invoice_number, issue_date, amount, modality,
               supply_order_id, process_id, municipality, notes, is_historical, verified,
               historical_source, forward_status
             ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, 'ENCAMINHADA')
             returning *`,
            [
              data.supplier_id,
              data.invoice_number,
              data.issue_date || null,
              data.amount || null,
              data.modality || null,
              data.supply_order_id || null,
              processId,
              data.municipality || null,
              data.notes || null,
              isVerified,
              data.informed_by,
            ]
          );
          const invoice = insInv.rows[0];

          // Registro do levantamento histórico
          await client.query(
            `insert into public.historical_statuses (
               invoice_id, reported_status, known_paid_amount, informed_by, notes
             ) values ($1, $2, $3, $4, $5)`,
            [
              invoice.id,
              data.reported_status,
              data.known_paid_amount || null,
              data.informed_by,
              data.historical_notes || null,
            ]
          );

          // Se houver pagamento conhecido informado
          if (data.known_paid_amount && data.known_paid_amount > 0) {
            await client.query(
              `insert into public.payments (
                 invoice_id, amount, payment_date, is_historical, informed_by, notes, status
               ) values ($1, $2, $3, true, $4, $5, 'VALIDO')`,
              [
                invoice.id,
                data.known_paid_amount,
                data.payment_date || null,
                data.informed_by,
                data.historical_notes || 'Pagamento histórico confirmado no levantamento de pendências.',
              ]
            );
          }

          // PDF opcional
          if (file) {
            const uploadRes = await uploadDocument(file.buffer, 'NF', file.originalname, file.mimetype);
            await client.query(
              `insert into public.documents (kind, invoice_id, storage_path, file_name, mime_type, size_bytes, sha256)
               values ('NF', $1, $2, $3, $4, $5, $6)`,
              [invoice.id, uploadRes.storagePath, file.originalname, file.mimetype, uploadRes.sizeBytes, uploadRes.sha256]
            );
          }

          // Retorna a NF com total pago atualizado
          const cur = await client.query('select * from public.v_invoices where id = $1', [invoice.id]);
          return cur.rows[0];
        }
      );

      res.status(201).json({
        ...result,
        amount: result.amount !== null ? Number(result.amount) : null,
        total_paid: Number(result.total_paid || 0),
        balance: result.balance !== null ? Number(result.balance) : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Atualização de pendência histórica para NF existente
invoicesRouter.post(
  '/invoices/:id/historical',
  authenticate,
  requirePermission('historical.write'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const schema = z.object({
        reported_status: z.enum(['SEM_INFORMACAO', 'PENDENTE', 'PARCIALMENTE_PAGA', 'PAGA']),
        informed_by: z.string().trim().min(1, 'Informe quem forneceu a informação.'),
        amount: z.coerce.number().positive().optional().nullable(),
        known_paid_amount: z.coerce.number().min(0).optional().nullable(),
        payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        notes: z.string().trim().optional().nullable(),
      });
      const data = schema.parse(req.body);

      const result = await runInTransaction(
        { actorId: req.user!.id, requestId: req.requestId },
        async (client) => {
          const invRes = await client.query('select * from public.invoices where id = $1', [id]);
          if (invRes.rowCount === 0) {
            throw new AppError('Nota Fiscal não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
          }
          const invoice = invRes.rows[0];

          // Se a nota estava não verificada e agora há dados:
          const willVerify = data.reported_status !== 'SEM_INFORMACAO';
          const newAmount = data.amount ?? invoice.amount;

          if (willVerify && (!newAmount || newAmount <= 0)) {
            throw new AppError('Para verificar a NF, é obrigatório informar o valor da Nota Fiscal.', {
              code: 'VALOR_OBRIGATORIO',
              status: 422,
            });
          }

          await client.query(
            `insert into public.historical_statuses (invoice_id, reported_status, known_paid_amount, informed_by, notes)
             values ($1, $2, $3, $4, $5)`,
            [id, data.reported_status, data.known_paid_amount || null, data.informed_by, data.notes || null]
          );

          if (willVerify && !invoice.verified) {
            await client.query(
              `update public.invoices
                  set verified = true,
                      amount = coalesce($1, amount),
                      historical_source = $2
                where id = $3`,
              [newAmount, data.informed_by, id]
            );
          } else if (data.amount && data.amount !== invoice.amount) {
            await client.query(`update public.invoices set amount = $1 where id = $2`, [data.amount, id]);
          }

          // Se houver valor pago adicional
          if (data.known_paid_amount && data.known_paid_amount > 0) {
            await client.query(
              `insert into public.payments (invoice_id, amount, payment_date, is_historical, informed_by, notes, status)
               values ($1, $2, $3, true, $4, $5, 'VALIDO')`,
              [
                id,
                data.known_paid_amount,
                data.payment_date || null,
                data.informed_by,
                data.notes || 'Pagamento histórico confirmado.',
              ]
            );
          }

          const cur = await client.query('select * from public.v_invoices where id = $1', [id]);
          return cur.rows[0];
        }
      );

      res.json({
        ...result,
        amount: result.amount !== null ? Number(result.amount) : null,
        total_paid: Number(result.total_paid || 0),
        balance: result.balance !== null ? Number(result.balance) : null,
      });
    } catch (err) {
      next(err);
    }
  }
);
