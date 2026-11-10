import { Router } from 'express';
import { REPORT_LABELS, type ReportType, type ReportResult } from '@cozam/shared';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { getPool } from '../db/pool.js';
import { AppError } from '../middleware/errors.js';

export const reportsRouter = Router();

reportsRouter.get('/reports/:type', authenticate, requirePermission('reports.view'), async (req, res, next) => {
  try {
    const type = req.params.type as ReportType;
    if (!REPORT_LABELS[type]) {
      throw new AppError(`Tipo de relatório inválido: ${type}`, { code: 'RELATORIO_INVALIDO', status: 400 });
    }

    const pool = getPool();
    const user = req.user!;
    const supplierId = typeof req.query.supplier_id === 'string' ? req.query.supplier_id.trim() : '';
    const modality = typeof req.query.modality === 'string' ? req.query.modality.trim() : '';
    const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';
    const processId = typeof req.query.process_id === 'string' ? req.query.process_id.trim() : '';
    const invoiceId = typeof req.query.invoice_id === 'string' ? req.query.invoice_id.trim() : '';

    const filtersApplied: { label: string; value: string }[] = [];
    if (supplierId) {
      const s = await pool.query('select name from public.suppliers where id = $1', [supplierId]);
      if (s.rowCount > 0) filtersApplied.push({ label: 'Fornecedor', value: s.rows[0].name });
    }
    if (modality) filtersApplied.push({ label: 'Modalidade', value: modality });
    if (dateFrom) filtersApplied.push({ label: 'A partir de', value: dateFrom });
    if (dateTo) filtersApplied.push({ label: 'Até', value: dateTo });

    let result: ReportResult;

    if (type.startsWith('notas')) {
      const statusFilterMap: Record<string, string | null> = {
        notas: null,
        notas_aguardando: 'AGUARDANDO_PAGAMENTO',
        notas_parciais: 'PARCIALMENTE_PAGA',
        notas_pagas: 'TOTALMENTE_PAGA',
        notas_nao_verificadas: 'NAO_VERIFICADA',
      };
      const fixedStatus = statusFilterMap[type];

      const where: string[] = ['1=1'];
      const params: any[] = [];

      if (fixedStatus) {
        params.push(fixedStatus);
        where.push(`i.status = $${params.length}`);
      }
      if (supplierId) {
        params.push(supplierId);
        where.push(`i.supplier_id = $${params.length}`);
      }
      if (modality) {
        params.push(modality);
        where.push(`i.modality = $${params.length}`);
      }
      if (processId) {
        params.push(processId);
        where.push(`i.process_id = $${params.length}`);
      }
      if (dateFrom) {
        params.push(dateFrom);
        where.push(`i.issue_date >= $${params.length}`);
      }
      if (dateTo) {
        params.push(dateTo);
        where.push(`i.issue_date <= $${params.length}`);
      }

      const q = await pool.query(
        `select i.invoice_number, i.issue_date, s.name as supplier_name,
                i.modality, i.status, i.amount, i.total_paid,
                case when i.amount is null then null else i.amount - i.total_paid end as balance,
                ap.process_number, i.notes
           from public.invoices i
           join public.suppliers s on s.id = i.supplier_id
           left join public.administrative_processes ap on ap.id = i.process_id
          where ${where.join(' and ')}
          order by i.issue_date desc nulls last, i.created_at desc`,
        params
      );

      let totalAmount = 0;
      let totalPaid = 0;
      let totalBalance = 0;
      const rows = q.rows.map((r) => {
        const amt = r.amount !== null ? Number(r.amount) : null;
        const pd = Number(r.total_paid || 0);
        const bal = r.balance !== null ? Number(r.balance) : null;
        if (r.status !== 'CANCELADA' && amt !== null) {
          totalAmount += amt;
          totalPaid += pd;
          totalBalance += bal || 0;
        }
        return {
          invoice_number: r.invoice_number,
          issue_date: r.issue_date,
          supplier_name: r.supplier_name,
          modality: r.modality || '—',
          status: r.status,
          amount: amt,
          total_paid: pd,
          balance: bal,
          process_number: r.process_number || '—',
          notes: r.notes || '',
        };
      });

      result = {
        type,
        title: REPORT_LABELS[type],
        generated_at: new Date().toISOString(),
        generated_by: user.full_name,
        filters_applied: filtersApplied,
        columns: [
          { key: 'invoice_number', label: 'Nº da NF', type: 'text' },
          { key: 'supplier_name', label: 'Fornecedor', type: 'text' },
          { key: 'issue_date', label: 'Emissão', type: 'date' },
          { key: 'modality', label: 'Modalidade', type: 'text' },
          { key: 'process_number', label: 'Processo', type: 'text' },
          { key: 'amount', label: 'Valor da NF', type: 'money' },
          { key: 'total_paid', label: 'Total Pago', type: 'money' },
          { key: 'balance', label: 'Saldo Devedor', type: 'money' },
          { key: 'status', label: 'Situação', type: 'text' },
        ],
        rows,
        totals: {
          amount: totalAmount,
          total_paid: totalPaid,
          balance: totalBalance,
          count: rows.length,
        },
      };
    } else if (type === 'pagamentos_periodo') {
      const where: string[] = ["p.status = 'VALIDO'"];
      const params: any[] = [];
      if (dateFrom) {
        params.push(dateFrom);
        where.push(`p.payment_date >= $${params.length}`);
      }
      if (dateTo) {
        params.push(dateTo);
        where.push(`p.payment_date <= $${params.length}`);
      }
      if (supplierId) {
        params.push(supplierId);
        where.push(`i.supplier_id = $${params.length}`);
      }
      if (modality) {
        params.push(modality);
        where.push(`i.modality = $${params.length}`);
      }

      const q = await pool.query(
        `select p.id, p.payment_date, p.amount, i.invoice_number, s.name as supplier_name,
                i.modality, ap.process_number, cb.full_name as registered_by, p.notes
           from public.payments p
           join public.invoices i on i.id = p.invoice_id
           join public.suppliers s on s.id = i.supplier_id
           left join public.administrative_processes ap on ap.id = i.process_id
           left join public.profiles cb on cb.id = p.created_by
          where ${where.join(' and ')}
          order by p.payment_date desc nulls last, p.created_at desc`,
        params
      );

      let totalPaid = 0;
      const rows = q.rows.map((r) => {
        const amt = Number(r.amount);
        totalPaid += amt;
        return {
          payment_date: r.payment_date,
          invoice_number: r.invoice_number,
          supplier_name: r.supplier_name,
          modality: r.modality || '—',
          process_number: r.process_number || '—',
          amount: amt,
          registered_by: r.registered_by || '—',
          notes: r.notes || '',
        };
      });

      result = {
        type,
        title: REPORT_LABELS[type],
        generated_at: new Date().toISOString(),
        generated_by: user.full_name,
        filters_applied: filtersApplied,
        columns: [
          { key: 'payment_date', label: 'Data do Pagamento', type: 'date' },
          { key: 'invoice_number', label: 'Nº da NF', type: 'text' },
          { key: 'supplier_name', label: 'Fornecedor', type: 'text' },
          { key: 'modality', label: 'Modalidade', type: 'text' },
          { key: 'process_number', label: 'Processo', type: 'text' },
          { key: 'amount', label: 'Valor Pago', type: 'money' },
          { key: 'registered_by', label: 'Registrado por', type: 'text' },
        ],
        rows,
        totals: {
          amount: totalPaid,
          count: rows.length,
        },
      };
    } else if (type === 'pagamentos_fornecedor' || type === 'saldo_fornecedor') {
      const q = await pool.query(
        `select s.id as supplier_id, s.name as supplier_name,
                count(i.id) filter (where i.status <> 'CANCELADA')::int as invoices_count,
                coalesce(sum(case when i.verified and i.status <> 'CANCELADA' then i.amount else 0 end), 0) as total_amount,
                coalesce(sum(case when i.status <> 'CANCELADA' then i.total_paid else 0 end), 0) as total_paid
           from public.suppliers s
           left join public.invoices i on i.supplier_id = s.id
          where s.active = true
          group by s.id, s.name, s.display_order
          order by s.display_order asc, s.name asc`
      );

      let totalAmt = 0;
      let totalPaid = 0;
      let totalBal = 0;
      const rows = q.rows.map((r) => {
        const amt = Number(r.total_amount);
        const pd = Number(r.total_paid);
        const bal = amt - pd;
        totalAmt += amt;
        totalPaid += pd;
        totalBal += bal;
        return {
          supplier_name: r.supplier_name,
          invoices_count: r.invoices_count,
          total_amount: amt,
          total_paid: pd,
          balance: bal,
        };
      });

      result = {
        type,
        title: REPORT_LABELS[type],
        generated_at: new Date().toISOString(),
        generated_by: user.full_name,
        filters_applied: filtersApplied,
        columns: [
          { key: 'supplier_name', label: 'Fornecedor', type: 'text' },
          { key: 'invoices_count', label: 'Qtd. Notas', type: 'number' },
          { key: 'total_amount', label: 'Total Faturado', type: 'money' },
          { key: 'total_paid', label: 'Total Pago', type: 'money' },
          { key: 'balance', label: 'Saldo Devedor', type: 'money' },
        ],
        rows,
        totals: {
          total_amount: totalAmt,
          total_paid: totalPaid,
          balance: totalBal,
          count: rows.length,
        },
      };
    } else if (type === 'pagamentos_modalidade') {
      const q = await pool.query(
        `select i.modality,
                count(i.id)::int as invoices_count,
                coalesce(sum(case when i.verified then i.amount else 0 end), 0) as total_amount,
                coalesce(sum(i.total_paid), 0) as total_paid
           from public.invoices i
          where i.modality is not null and i.status <> 'CANCELADA'
          group by i.modality`
      );

      let totalAmt = 0;
      let totalPaid = 0;
      let totalBal = 0;
      const rows = q.rows.map((r) => {
        const amt = Number(r.total_amount);
        const pd = Number(r.total_paid);
        const bal = amt - pd;
        totalAmt += amt;
        totalPaid += pd;
        totalBal += bal;
        return {
          modality: r.modality,
          invoices_count: r.invoices_count,
          total_amount: amt,
          total_paid: pd,
          balance: bal,
        };
      });

      result = {
        type,
        title: REPORT_LABELS[type],
        generated_at: new Date().toISOString(),
        generated_by: user.full_name,
        filters_applied: filtersApplied,
        columns: [
          { key: 'modality', label: 'Modalidade', type: 'text' },
          { key: 'invoices_count', label: 'Qtd. Notas', type: 'number' },
          { key: 'total_amount', label: 'Total Documentado', type: 'money' },
          { key: 'total_paid', label: 'Total Pago', type: 'money' },
          { key: 'balance', label: 'Saldo Devedor', type: 'money' },
        ],
        rows,
        totals: {
          total_amount: totalAmt,
          total_paid: totalPaid,
          balance: totalBal,
          count: rows.length,
        },
      };
    } else if (type === 'historico_nf') {
      if (!invoiceId) {
        throw new AppError('Para o relatório histórico, selecione uma Nota Fiscal.', {
          code: 'NF_NAO_SELECIONADA',
          status: 400,
        });
      }

      const invRes = await pool.query('select * from public.v_invoices where id = $1', [invoiceId]);
      if (invRes.rowCount === 0) {
        throw new AppError('Nota Fiscal não encontrada.', { code: 'NAO_ENCONTRADO', status: 404 });
      }
      const invoice = invRes.rows[0];

      const payRes = await pool.query(
        `select p.*, cb.full_name as registered_by
           from public.payments p
           left join public.profiles cb on cb.id = p.created_by
          where p.invoice_id = $1
          order by p.payment_date asc nulls last, p.created_at asc`,
        [invoiceId]
      );

      const rows = payRes.rows.map((p) => ({
        payment_date: p.payment_date,
        amount: Number(p.amount),
        status: p.status,
        registered_by: p.registered_by || '—',
        notes: p.notes || '',
        edit_reason: p.edit_reason || '',
        cancel_reason: p.cancel_reason || '',
      }));

      result = {
        type,
        title: `Histórico da Nota Fiscal nº ${invoice.invoice_number} (${invoice.supplier_name})`,
        generated_at: new Date().toISOString(),
        generated_by: user.full_name,
        filters_applied: [
          { label: 'Nota Fiscal', value: invoice.invoice_number },
          { label: 'Fornecedor', value: invoice.supplier_name },
          { label: 'Valor da NF', value: invoice.amount ? `R$ ${Number(invoice.amount).toFixed(2)}` : 'Não informado' },
          { label: 'Situação Atual', value: invoice.status },
        ],
        columns: [
          { key: 'payment_date', label: 'Data do Pagamento', type: 'date' },
          { key: 'amount', label: 'Valor Pago', type: 'money' },
          { key: 'status', label: 'Situação', type: 'text' },
          { key: 'registered_by', label: 'Registrado por', type: 'text' },
          { key: 'notes', label: 'Observação', type: 'text' },
          { key: 'cancel_reason', label: 'Justificativa de Cancelamento/Correção', type: 'text' },
        ],
        rows,
        totals: {
          amount: Number(invoice.total_paid || 0),
          balance: invoice.balance !== null ? Number(invoice.balance) : 0,
          count: rows.length,
        },
      };
    } else {
      throw new AppError('Relatório não implementado.', { code: 'NAO_IMPLEMENTADO', status: 400 });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});
