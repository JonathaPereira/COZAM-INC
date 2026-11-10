import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', authenticate, requirePermission('dashboard.view'), async (req, res, next) => {
  try {
    const pool = getPool();
    const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const modality = typeof req.query.modality === 'string' ? req.query.modality.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const processId = typeof req.query.process_id === 'string' ? req.query.process_id.trim() : '';

    const invWhere: string[] = ['1=1'];
    const invParams: any[] = [];

    if (supplierId) {
      invParams.push(supplierId);
      invWhere.push(`i.supplier_id = $${invParams.length}`);
    }
    if (modality) {
      invParams.push(modality);
      invWhere.push(`i.modality = $${invParams.length}`);
    }
    if (status) {
      invParams.push(status);
      invWhere.push(`i.status = $${invParams.length}`);
    }
    if (processId) {
      invParams.push(processId);
      invWhere.push(`i.process_id = $${invParams.length}`);
    }
    if (dateFrom) {
      invParams.push(dateFrom);
      invWhere.push(`i.issue_date >= $${invParams.length}`);
    }
    if (dateTo) {
      invParams.push(dateTo);
      invWhere.push(`i.issue_date <= $${invParams.length}`);
    }

    const invWhereClause = invWhere.join(' and ');

    // Contadores
    const countsRes = await pool.query(
      `select
         (select count(*)::int from public.administrative_processes) as processes,
         count(*)::int as invoices,
         count(*) filter (where i.status = 'AGUARDANDO_PAGAMENTO')::int as aguardando,
         count(*) filter (where i.status = 'PARCIALMENTE_PAGA')::int as parciais,
         count(*) filter (where i.status = 'TOTALMENTE_PAGA')::int as pagas,
         count(*) filter (where i.status = 'NAO_VERIFICADA')::int as nao_verificadas,
         count(*) filter (where i.status = 'CANCELADA')::int as canceladas,
         count(*) filter (where i.forward_status in ('ENCAMINHADA', 'EM_ATENDIMENTO') and i.status <> 'TOTALMENTE_PAGA')::int as fila_pagamentos,
         count(*) filter (where i.forward_status = 'RASCUNHO')::int as rascunhos,

         -- Totais confirmados (verificadas e não canceladas)
         coalesce(sum(case when i.verified and i.status <> 'CANCELADA' then i.amount else 0 end), 0) as registered,
         coalesce(sum(case when i.status <> 'CANCELADA' then i.total_paid else 0 end), 0) as paid,

         -- Valores históricos não verificados (exibidos estritamente em separado)
         coalesce(sum(case when not i.verified and i.status <> 'CANCELADA' then coalesce(i.amount, 0) else 0 end), 0) as unverified_known_amount
       from public.invoices i
      where ${invWhereClause}`,
      invParams
    );

    const countsRow = countsRes.rows[0];
    const registered = Number(countsRow.registered || 0);
    const paid = Number(countsRow.paid || 0);
    const balance = registered - paid;

    // Evolução mensal dos pagamentos (últimos 12 meses)
    const monthlyRes = await pool.query(
      `select to_char(p.payment_date, 'YYYY-MM') as month,
              coalesce(sum(p.amount), 0) as paid,
              count(*)::int as count
         from public.payments p
         join public.invoices i on i.id = p.invoice_id
        where p.status = 'VALIDO' and p.payment_date is not null
          and p.payment_date >= current_date - interval '12 months'
          ${supplierId ? 'and i.supplier_id = $' + (invParams.indexOf(supplierId) + 1) : ''}
          ${modality ? 'and i.modality = $' + (invParams.indexOf(modality) + 1) : ''}
        group by 1
        order by 1 asc`,
      invParams
    );

    // Distribuição por fornecedor
    const bySupplierRes = await pool.query(
      `select s.id as supplier_id, s.name,
              coalesce(sum(case when i.verified and i.status <> 'CANCELADA' then i.amount else 0 end), 0) as amount,
              coalesce(sum(case when i.status <> 'CANCELADA' then i.total_paid else 0 end), 0) as paid,
              count(i.id)::int as count
         from public.suppliers s
         left join public.invoices i on i.supplier_id = s.id and ${invWhereClause.replace(/\bi\./g, 'i.')}
        where s.active = true
        group by s.id, s.name, s.display_order
        order by s.display_order asc, s.name asc`,
      invParams
    );

    // Distribuição por modalidade
    const byModalityRes = await pool.query(
      `select i.modality,
              coalesce(sum(case when i.verified and i.status <> 'CANCELADA' then i.amount else 0 end), 0) as amount,
              coalesce(sum(case when i.status <> 'CANCELADA' then i.total_paid else 0 end), 0) as paid,
              count(i.id)::int as count
         from public.invoices i
        where i.modality is not null and i.status <> 'CANCELADA'
          and ${invWhereClause}
        group by i.modality`,
      invParams
    );

    // Pagamentos recentes
    const recentRes = await pool.query(
      `select * from public.v_payments
        where status = 'VALIDO'
        order by payment_date desc nulls last, created_at desc
        limit 8`
    );

    res.json({
      counts: {
        processes: countsRow.processes,
        invoices: countsRow.invoices,
        aguardando: countsRow.aguardando,
        parciais: countsRow.parciais,
        pagas: countsRow.pagas,
        nao_verificadas: countsRow.nao_verificadas,
        canceladas: countsRow.canceladas,
        fila_pagamentos: countsRow.fila_pagamentos,
        rascunhos: countsRow.rascunhos,
      },
      totals: {
        registered,
        paid,
        balance,
        unverified_count: countsRow.nao_verificadas,
        unverified_known_amount: Number(countsRow.unverified_known_amount || 0),
      },
      monthly: monthlyRes.rows.map((r) => ({
        month: r.month,
        paid: Number(r.paid),
        count: r.count,
      })),
      by_supplier: bySupplierRes.rows.map((r) => {
        const amt = Number(r.amount);
        const pd = Number(r.paid);
        return {
          supplier_id: r.supplier_id,
          name: r.name,
          amount: amt,
          paid: pd,
          balance: amt - pd,
          count: r.count,
        };
      }),
      by_modality: byModalityRes.rows.map((r) => {
        const amt = Number(r.amount);
        const pd = Number(r.paid);
        return {
          modality: r.modality,
          amount: amt,
          paid: pd,
          balance: amt - pd,
          count: r.count,
        };
      }),
      recent_payments: recentRes.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
    });
  } catch (err) {
    next(err);
  }
});
