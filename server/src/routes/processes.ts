import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { runInTransaction } from '../db/transaction.js';
import { AppError } from '../middleware/errors.js';

export const processesRouter = Router();

const createProcessSchema = z.object({
  process_number: z.string().trim().min(1, 'Número do processo administrativo é obrigatório.'),
  registered_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de cadastro deve ser AAAA-MM-DD.').optional(),
  description: z.string().trim().min(1, 'Descrição ou objeto do processo é obrigatório.'),
  notes: z.string().trim().optional().nullable(),
});

const updateProcessSchema = z.object({
  process_number: z.string().trim().min(1).optional(),
  registered_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(['EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO']).optional(),
  reason: z.string().trim().optional(),
});

processesRouter.get('/processes', authenticate, requirePermission('processes.view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = ['1=1'];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(ap.process_number ilike $${params.length} or ap.description ilike $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`ap.status = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      where.push(`ap.registered_at >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      where.push(`ap.registered_at <= $${params.length}`);
    }
    if (supplierId) {
      params.push(supplierId);
      where.push(`exists (select 1 from public.supply_orders so where so.process_id = ap.id and so.supplier_id = $${params.length})`);
    }

    const whereClause = where.join(' and ');

    const countRes = await pool.query(
      `select count(*)::int as total from public.v_processes ap where ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    params.push(pageSize, offset);
    const listRes = await pool.query(
      `select * from public.v_processes ap
        where ${whereClause}
        order by ap.registered_at desc, ap.created_at desc
        limit $${params.length - 1} offset $${params.length}`,
      params
    );

    res.json({
      data: listRes.rows.map((r) => ({
        ...r,
        invoices_total: Number(r.invoices_total || 0),
        paid_total: Number(r.paid_total || 0),
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

processesRouter.get('/processes/:id', authenticate, requirePermission('processes.view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const procRes = await pool.query('select * from public.v_processes where id = $1', [id]);
    if (procRes.rowCount === 0) {
      throw new AppError('Processo administrativo não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
    }

    const ofsRes = await pool.query(
      `select so.*, s.name as supplier_name,
              cb.full_name as created_by_name,
              (select count(*)::int from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null) as invoices_count,
              (select coalesce(sum(i.amount), 0) from public.invoices i where i.supply_order_id = so.id and i.cancelled_at is null and i.verified) as invoices_total,
              (select to_jsonb(d.*) from public.documents d where d.supply_order_id = so.id and d.kind = 'OF' and d.is_current) as document
         from public.supply_orders so
         join public.suppliers s on s.id = so.supplier_id
         left join public.profiles cb on cb.id = so.created_by
        where so.process_id = $1
        order by so.issue_date desc, so.created_at desc`,
      [id]
    );

    const invsRes = await pool.query(
      `select * from public.v_invoices where process_id = $1 order by issue_date desc nulls last, created_at desc`,
      [id]
    );

    const auditRes = await pool.query(
      `select * from public.audit_logs
        where (entity_type = 'administrative_processes' and entity_id = $1)
           or invoice_id in (select id from public.invoices where process_id = $1)
        order by occurred_at desc
        limit 50`,
      [id]
    );

    res.json({
      process: {
        ...procRes.rows[0],
        invoices_total: Number(procRes.rows[0].invoices_total || 0),
        paid_total: Number(procRes.rows[0].paid_total || 0),
      },
      supply_orders: ofsRes.rows.map((r) => ({
        ...r,
        total_value: r.total_value !== null ? Number(r.total_value) : null,
        invoices_total: Number(r.invoices_total || 0),
      })),
      invoices: invsRes.rows.map((r) => ({
        ...r,
        amount: r.amount !== null ? Number(r.amount) : null,
        total_paid: Number(r.total_paid || 0),
        balance: r.balance !== null ? Number(r.balance) : null,
      })),
      audit: auditRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

processesRouter.post('/processes', authenticate, requirePermission('processes.write'), async (req, res, next) => {
  try {
    const data = createProcessSchema.parse(req.body);
    const result = await runInTransaction(
      { actorId: req.user!.id, requestId: req.requestId },
      async (client) => {
        const ins = await client.query(
          `insert into public.administrative_processes (process_number, registered_at, description, notes)
           values ($1, coalesce($2, current_date), $3, $4)
           returning *`,
          [data.process_number, data.registered_at || null, data.description, data.notes || null]
        );
        return ins.rows[0];
      }
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

processesRouter.patch('/processes/:id', authenticate, requirePermission('processes.write'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateProcessSchema.parse(req.body);

    const result = await runInTransaction(
      { actorId: req.user!.id, reason: data.reason || null, requestId: req.requestId },
      async (client) => {
        const cur = await client.query('select * from public.administrative_processes where id = $1', [id]);
        if (cur.rowCount === 0) {
          throw new AppError('Processo administrativo não encontrado.', { code: 'NAO_ENCONTRADO', status: 404 });
        }
        const upd = await client.query(
          `update public.administrative_processes
              set process_number = coalesce($1, process_number),
                  registered_at = coalesce($2, registered_at),
                  description = coalesce($3, description),
                  notes = coalesce($4, notes),
                  status = coalesce($5, status)
            where id = $6
            returning *`,
          [
            data.process_number ?? null,
            data.registered_at ?? null,
            data.description ?? null,
            data.notes ?? null,
            data.status ?? null,
            id,
          ]
        );
        return upd.rows[0];
      }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});
