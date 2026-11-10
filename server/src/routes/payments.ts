import { Router } from 'express';
import { z } from 'zod';
import { can } from '@cozam/shared';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { uploadDocument } from '../services/storage.js';
import { AppError } from '../middleware/errors.js';

export const paymentsRouter = Router();

const createPaymentSchema = z.object({
  amount: z.coerce.number().positive('O valor do pagamento deve ser maior que zero.'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do pagamento inválida.'),
  notes: z.string().trim().optional().nullable(),
  client_request_id: z.string().uuid().optional(),
});

const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().optional().nullable(),
  reason: z.string().trim().min(1, 'A justificativa da correção do pagamento é obrigatória.'),
});

const cancelPaymentSchema = z.object({
  reason: z.string().trim().min(1, 'A justificativa do cancelamento do pagamento é obrigatória.'),
});

// Listagem de pagamentos
paymentsRouter.get('/payments', authenticate, requirePermission('payments.view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const invoiceId = typeof req.query.invoice_id === 'string' ? req.query.invoice_id.trim() : '';
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const modality = typeof req.query.modality === 'string' ? req.query.modality.trim() : '';
    const processId = typeof req.query.process_id === 'string' ? req.query.process_id.trim() : '';
    const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = ['1=1'];
    const params: any[] = [];

    if (invoiceId) {
      params.push(invoiceId);
      where.push(`p.invoice_id = $${params.length}`);
    }
    if (supplierId) {
      params.push(supplierId);
      where.push(`p.supplier_id = $${params.length}`);
    }
    if (modality) {
      params.push(modality);
      where.push(`p.modality = $${params.length}`);
    }
    if (processId) {
      params.push(processId);
      where.push(`p.process_id = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      where.push(`p.payment_date >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      where.push(`p.payment_date <= $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`p.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(p.invoice_number ilike $${params.length} or p.supplier_name ilike $${params.length} or p.process_number ilike $${params.length})`);
    }

    const whereClause = where.join(' and ');

    const countRes = await pool.query(
      `select count(*)::int as total,
              coalesce(sum(case when p.status = 'VALIDO' then p.amount else 0 end), 0) as total_amount
         from public.v_payments p
        where ${whereClause}`,
      params
    );

    const total = countRes.rows[0]?.total || 0;
    const totalAmount = Number(countRes.rows[0]?.total_amount || 0);

    params.push(pageSize, offset);
    const listRes = await pool.query(
      `select * from public.v_payments p
        where ${whereClause}
        order by p.payment_date desc nulls last, p.created_at desc
        limit $${params.length - 1} offset $${params.length}`,
      params
    );

    res.json({
      data: listRes.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
      total,
      page,
      pageSize,
      summary: {
        total: totalAmount,
        count: total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Registro de pagamento para uma NF
paymentsRouter.post(
  '/invoices/:id/payments',
  authenticate,
  requirePermission('payments.register'),
  upload.single('receipt'),
  async (req, res, next) => {
    try {
      const { id: invoiceId } = req.params;
      const data = createPaymentSchema.parse(req.body);
      const receipt = req.file;

      if (receipt) {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowed.includes(receipt.mimetype)) {
          throw new AppError('Comprovante deve ser em formato PDF, JPEG ou PNG.', {
            code: 'FORMATO_INVALIDO',
            status: 400,
          });
        }
      }

      // Idempotência
      if (data.client_request_id) {
        const pool = getPool();
        const existing = await pool.query('select * from public.v_payments where client_request_id = $1', [
          data.client_request_id,
        ]);
        if (existing.rowCount > 0) {
          const invRes = await pool.query('select * from public.v_invoices where id = $1', [invoiceId]);
          res.json({
            payment: { ...existing.rows[0], amount: Number(existing.rows[0].amount) },
            invoice: {
              ...invRes.rows[0],
              amount: Number(invRes.rows[0].amount),
              total_paid: Number(invRes.rows[0].total_paid || 0),
              balance: Number(invRes.rows[0].balance || 0),
            },
          });
          return;
        }
      }

      const result = await runInTransaction(
        { actorId: req.user!.id, requestId: req.requestId },
        async (client) => {
          const insPay = await client.query(
            `insert into public.payments (
               invoice_id, amount, payment_date, notes, client_request_id, created_by, status
             ) values ($1, $2, $3, $4, $5, $6, 'VALIDO')
             returning *`,
            [
              invoiceId,
              data.amount,
              data.payment_date,
              data.notes || null,
              data.client_request_id || null,
              req.user!.id,
            ]
          );
          const payment = insPay.rows[0];

          if (receipt) {
            const uploadRes = await uploadDocument(receipt.buffer, 'COMPROVANTE', receipt.originalname, receipt.mimetype);
            await client.query(
              `insert into public.documents (kind, payment_id, storage_path, file_name, mime_type, size_bytes, sha256)
               values ('COMPROVANTE', $1, $2, $3, $4, $5, $6)`,
              [payment.id, uploadRes.storagePath, receipt.originalname, receipt.mimetype, uploadRes.sizeBytes, uploadRes.sha256]
            );
          }

          const payView = await client.query('select * from public.v_payments where id = $1', [payment.id]);
          const invView = await client.query('select * from public.v_invoices where id = $1', [invoiceId]);

          return {
            payment: payView.rows[0],
            invoice: invView.rows[0],
          };
        }
      );

      res.status(201).json({
        payment: {
          ...result.payment,
          amount: Number(result.payment.amount),
        },
        invoice: {
          ...result.invoice,
          amount: Number(result.invoice.amount),
          total_paid: Number(result.invoice.total_paid || 0),
          balance: Number(result.invoice.balance || 0),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Correção de pagamento (com justificativa obrigatória)
paymentsRouter.patch('/payments/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updatePaymentSchema.parse(req.body);
    const user = req.user!;

    const result = await runInTransaction(
      { actorId: user.id, reason: data.reason, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.payments where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Pagamento não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }
        const payment = cur.rows[0];

        // Somente o autor do registro ou usuário com payments.manage_any pode alterar
        const isOwner = payment.created_by === user.id;
        const canManageAny = can(user, 'payments.manage_any');
        if (!isOwner && !canManageAny) {
          throw new AppError('Você só pode corrigir pagamentos que você mesmo registrou.', {
            code: 'ACESSO_NEGADO',
            status: 403,
          });
        }

        const upd = await client.query(
          `update public.payments
              set amount = coalesce($1, amount),
                  payment_date = coalesce($2, payment_date),
                  notes = coalesce($3, notes)
            where id = $4
            returning *`,
          [data.amount ?? null, data.payment_date ?? null, data.notes ?? null, id]
        );

        const payView = await client.query('select * from public.v_payments where id = $1', [id]);
        const invView = await client.query('select * from public.v_invoices where id = $1', [payment.invoice_id]);

        return {
          payment: payView.rows[0],
          invoice: invView.rows[0],
        };
      }
    );

    res.json({
      payment: {
        ...result.payment,
        amount: Number(result.payment.amount),
      },
      invoice: {
        ...result.invoice,
        amount: Number(result.invoice.amount),
        total_paid: Number(result.invoice.total_paid || 0),
        balance: Number(result.invoice.balance || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Cancelamento de pagamento (com justificativa obrigatória)
paymentsRouter.post('/payments/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = cancelPaymentSchema.parse(req.body);
    const user = req.user!;

    const result = await runInTransaction(
      { actorId: user.id, reason: data.reason, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.payments where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Pagamento não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }
        const payment = cur.rows[0];

        const isOwner = payment.created_by === user.id;
        const canManageAny = can(user, 'payments.manage_any');
        if (!isOwner && !canManageAny) {
          throw new AppError('Você só pode cancelar pagamentos que você mesmo registrou.', {
            code: 'ACESSO_NEGADO',
            status: 403,
          });
        }

        const upd = await client.query(
          `update public.payments
              set status = 'CANCELADO',
                  cancelled_at = now(),
                  cancelled_by = $1,
                  cancel_reason = $2
            where id = $3
            returning *`,
          [user.id, data.reason, id]
        );

        const payView = await client.query('select * from public.v_payments where id = $1', [id]);
        const invView = await client.query('select * from public.v_invoices where id = $1', [payment.invoice_id]);

        return {
          payment: payView.rows[0],
          invoice: invView.rows[0],
        };
      }
    );

    res.json({
      payment: {
        ...result.payment,
        amount: Number(result.payment.amount),
      },
      invoice: {
        ...result.invoice,
        amount: Number(result.invoice.amount),
        total_paid: Number(result.invoice.total_paid || 0),
        balance: Number(result.invoice.balance || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});
