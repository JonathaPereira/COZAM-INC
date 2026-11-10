import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  FileText,
  Receipt,
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Clock,
  Plus,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import type { ProcessRow, SupplyOrderRow, InvoiceRow, AuditLogRow } from '@cozam/shared';
import { formatBRL, formatDateBR, formatDateTimeBR, PROCESS_STATUS_LABELS } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { ModalityBadge } from '../../components/ui/Badges.js';
import { DocumentActions } from '../../components/ui/DocumentViewerModal.js';

export function ProcessoDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['process-detail', id],
    queryFn: () =>
      api.get<{
        process: ProcessRow;
        supply_orders: SupplyOrderRow[];
        invoices: InvoiceRow[];
        audit: AuditLogRow[];
      }>(`/processes/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading || !data) {
    return <div className="text-center py-12 text-xs text-slate-500">Carregando processo...</div>;
  }

  const { process, supply_orders, invoices, audit } = data;

  return (
    <div className="space-y-6">
      {/* Botão de retorno e cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/processos">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Processos
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
                Processo nº {process.process_number}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {PROCESS_STATUS_LABELS[process.status]}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Cadastrado em {formatDateBR(process.registered_at)}</p>
          </div>
        </div>

        <Link to="/lancamento">
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
            Nova OF ou NF
          </Button>
        </Link>
      </div>

      {/* Cartão de Objeto / Descrição */}
      <Card title="Objeto do Processo Administrativo">
        <p className="text-sm text-slate-800 leading-relaxed">{process.description}</p>
        {process.notes && (
          <p className="text-xs text-slate-500 mt-2 italic border-t border-slate-100 pt-2">
            Observações: {process.notes}
          </p>
        )}
      </Card>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Faturado</span>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatBRL(process.invoices_total)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-800 uppercase">Total Pago</span>
          <p className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatBRL(process.paid_total)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Saldo Devedor</span>
          <p className="text-xl font-bold text-orange-700 mt-1 tabular-nums">
            {formatBRL(process.invoices_total - process.paid_total)}
          </p>
        </div>
      </div>

      {/* Ordens de Fornecimento deste processo */}
      <Card
        title={`Ordens de Fornecimento Vinculadas (${supply_orders.length})`}
        subtitle="Um mesmo processo administrativo pode conter OFs para fornecedores diferentes"
      >
        <div className="space-y-3">
          {supply_orders.map((ofItem) => (
            <div
              key={ofItem.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">OF nº {ofItem.of_number}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    {ofItem.supplier_name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Emissão: {formatDateBR(ofItem.issue_date)} · Valor previsto: {formatBRL(ofItem.total_value)} · {ofItem.invoices_count} NFs vinculadas
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <DocumentActions
                  documentId={ofItem.document?.id}
                  fileName={ofItem.document?.file_name}
                  kindName="Ordem de Fornecimento"
                />
                <Link to={`/ordens/${ofItem.id}`}>
                  <Button variant="outline" size="sm">
                    Detalhes da OF
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Notas Fiscais deste processo */}
      <Card title={`Notas Fiscais deste Processo (${invoices.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-2xs">
                <th className="pb-2 font-semibold">Nº NF</th>
                <th className="pb-2 font-semibold">Fornecedor</th>
                <th className="pb-2 font-semibold">Emissão</th>
                <th className="pb-2 font-semibold">Modalidade</th>
                <th className="pb-2 font-semibold text-right">Valor da NF</th>
                <th className="pb-2 font-semibold text-right">Total Pago</th>
                <th className="pb-2 font-semibold text-right">Saldo</th>
                <th className="pb-2 font-semibold text-center">Situação</th>
                <th className="pb-2 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 font-bold text-slate-900">{inv.invoice_number}</td>
                  <td className="py-2.5 text-slate-700">{inv.supplier_name}</td>
                  <td className="py-2.5 text-slate-600">{formatDateBR(inv.issue_date)}</td>
                  <td className="py-2.5"><ModalityBadge modality={inv.modality} /></td>
                  <td className="py-2.5 text-right font-medium text-slate-900 tabular-nums">
                    {formatBRL(inv.amount)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-emerald-700 tabular-nums">
                    {formatBRL(inv.total_paid)}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-orange-700 tabular-nums">
                    {formatBRL(inv.balance)}
                  </td>
                  <td className="py-2.5 text-center"><StatusBadge status={inv.status} /></td>
                  <td className="py-2.5 text-right">
                    <Link to={`/notas/${inv.id}`}>
                      <Button variant="ghost" size="sm">Ver NF</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trilha de Auditoria deste processo */}
      <Card title="Trilha de Auditoria do Processo" subtitle="Histórico imutável de todas as movimentações">
        <div className="space-y-3">
          {audit.map((a) => (
            <div key={a.id} className="text-xs p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{a.action} — {a.summary}</p>
                {a.reason && <p className="text-slate-600 italic mt-0.5">Motivo: "{a.reason}"</p>}
                <p className="text-2xs text-slate-400 mt-1">Por {a.actor_name || 'Sistema'} ({a.actor_role})</p>
              </div>
              <span className="text-2xs text-slate-400 shrink-0">{formatDateTimeBR(a.occurred_at)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
