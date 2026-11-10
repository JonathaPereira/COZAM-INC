import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';

export const auditRouter = Router();

auditRouter.get('/audit', authenticate, requirePermission('audit.view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type.trim() : '';
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const actorId = typeof req.query.actor_id === 'string' ? req.query.actor_id.trim() : '';
    const invoiceId = typeof req.query.invoice_id === 'string' ? req.query.invoice_id.trim() : '';
    const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
    const offset = (page - 1) * pageSize;

    const where: string[] = ['1=1'];
    const params: any[] = [];

    if (entityType) {
      params.push(entityType);
      where.push(`a.entity_type = $${params.length}`);
    }
    if (action) {
      params.push(action);
      where.push(`a.action = $${params.length}`);
    }
    if (actorId) {
      params.push(actorId);
      where.push(`a.actor_id = $${params.length}`);
    }
    if (invoiceId) {
      params.push(invoiceId);
      where.push(`a.invoice_id = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      where.push(`a.occurred_at >= $${params.length}::timestamptz`);
    }
    if (dateTo) {
      params.push(dateTo);
      where.push(`a.occurred_at <= ($${params.length}::date + interval '1 day')`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(a.summary ilike $${params.length} or a.actor_name ilike $${params.length} or a.reason ilike $${params.length})`);
    }

    const whereClause = where.join(' and ');

    const countRes = await pool.query(
      `select count(*)::int as total from public.audit_logs a where ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    params.push(pageSize, offset);
    const listRes = await pool.query(
      `select * from public.audit_logs a
        where ${whereClause}
        order by a.occurred_at desc
        limit $${params.length - 1} offset $${params.length}`,
      params
    );

    res.json({
      data: listRes.rows,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});
