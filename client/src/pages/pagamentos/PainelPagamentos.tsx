import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  Search,
  Filter,
  DollarSign,
  Receipt,
  FileText,
  Printer,
  Download,
  Eye,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api.js';
import type { InvoiceRow, Paginated, Supplier, Modality } from '@cozam/shared';
import { formatBRL, formatDateBR, formatDateTimeBR } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { ModalityBadge } from '../../components/ui/Badges.js';
import { DocumentActions } from '../../components/ui/DocumentViewerModal.js';
import { DeleteConfirmModal } from '../../components/ui/DeleteConfirmModal.js';
import { EditInvoiceModal } from '../../components/notas/EditInvoiceModal.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function PainelPagamentos() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [modality, setModality] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [activeTab, setActiveTab] = useState<'TODAS' | 'AGUARDANDO' | 'PARCIAIS' | 'PAGAS'>('TODAS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  const { data: municipalitiesData } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => api.get<{ municipalities: string[] }>('/invoices/municipalities'),
  });

  const getStatusFilter = () => {
    if (activeTab === 'AGUARDANDO') return 'AGUARDANDO_PAGAMENTO';
    if (activeTab === 'PARCIAIS') return 'PARCIALMENTE_PAGA';
    if (activeTab === 'PAGAS') return 'TOTALMENTE_PAGA';
    return '';
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pagamentos-queue', search, supplierId, modality, municipality, activeTab, dateFrom, dateTo, page],
    queryFn: () =>
      api.get<Paginated<InvoiceRow> & { summary: { amount: number; total_paid: number; balance: number } }>(
        '/invoices',
        {
          queue: 1, // apenas encaminhadas e pendentes de atendimento
          search,
          supplier_id: supplierId,
          modality,
          municipality,
          status: getStatusFilter(),
          date_from: dateFrom,
          date_to: dateTo,
          page,
          pageSize: 20,
        }
      ),
  });

  const handleDeleteInvoice = async (reason: string) => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/invoices/${deleteTarget.id}`, { data: { reason } });
      toast.success(`Nota Fiscal nº ${deleteTarget.invoice_number} excluída da fila de pagamentos com sucesso.`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir NF.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            Fila de Documentos para Pagamento
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Notas Fiscais encaminhadas pelo setor de Compras prontas para liquidação financeira
          </p>
        </div>
      </div>

      {/* Cartões de Resumo da Fila */}
      {data?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total na Fila de Pagamentos</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {formatBRL(data.summary.amount)}
            </p>
          </div>
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase">Total Já Liquidado</span>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
              {formatBRL(data.summary.total_paid)}
            </p>
          </div>
          <div className="p-4 bg-orange-50/50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800/60 shadow-2xs">
            <span className="text-xs font-semibold text-orange-800 dark:text-orange-300 uppercase">Saldo Devedor a Pagar</span>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1 tabular-nums">
              {formatBRL(data.summary.balance)}
            </p>
          </div>
        </div>
      )}

      {/* Guias Rápidas por Situação */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          { key: 'TODAS', label: 'Todas na Fila' },
          { key: 'AGUARDANDO', label: 'Aguardando Pagamento' },
          { key: 'PARCIAIS', label: 'Parcialmente Pagas' },
          { key: 'PAGAS', label: 'Totalmente Quitadas' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key as any);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-emerald-700 dark:border-emerald-400 text-emerald-900 dark:text-emerald-300 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtros de Pesquisa (sem obrigar número de OF) */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
            Pesquisar por NF, Processo, Fornecedor ou Município
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite o número da NF, processo, fornecedor ou município..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Fornecedor</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos os fornecedores</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Município</label>
          <select
            value={municipality}
            onChange={(e) => {
              setMunicipality(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos os municípios</option>
            {Array.from(
              new Set([
                'Santana do Mundaú',
                'Branquinha',
                'União dos Palmares',
                'Carneiros',
                ...(municipalitiesData?.municipalities || []),
              ])
            )
              .sort((a, b) => a.localeCompare(b, 'pt-BR'))
              .map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Modalidade</label>
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todas</option>
            <option value="FUMIP">FUMIP</option>
            <option value="COMPRA_COMPARTILHADA">Compra Compartilhada</option>
          </select>
        </div>
      </div>

      {/* Lista da Fila de Pagamentos */}
      <Card className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
                <th className="py-3 px-4 font-semibold">Nº NF</th>
                <th className="py-3 px-4 font-semibold">Emissão</th>
                <th className="py-3 px-4 font-semibold">Fornecedor</th>
                <th className="py-3 px-4 font-semibold">Modalidade</th>
                <th className="py-3 px-4 font-semibold text-right">Valor da NF</th>
                <th className="py-3 px-4 font-semibold text-right">Total Pago</th>
                <th className="py-3 px-4 font-semibold text-right">Saldo Devedor</th>
                <th className="py-3 px-4 font-semibold text-center">Situação</th>
                <th className="py-3 px-4 font-semibold text-center">OF (PDF)</th>
                <th className="py-3 px-4 font-semibold text-center">NF (PDF)</th>
                <th className="py-3 px-4 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.data && data.data.length > 0 ? (
                data.data.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      <Link to={`/notas/${inv.id}`} className="hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline">
                        {inv.invoice_number}
                      </Link>
                      {inv.municipality && (
                        <span className="block mt-0.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-400">
                          📍 {inv.municipality}
                        </span>
                      )}
                      {inv.notes && (
                        <span className="block text-2xs text-amber-700 dark:text-amber-400 italic truncate max-w-[140px]" title={inv.notes}>
                          "{inv.notes}"
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDateBR(inv.issue_date)}</td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{inv.supplier_name}</td>
                    <td className="py-3 px-4"><ModalityBadge modality={inv.modality} /></td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatBRL(inv.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatBRL(inv.total_paid)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-orange-700 dark:text-orange-400 tabular-nums">
                      {formatBRL(inv.balance)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={inv.status} />
                    </td>

                    {/* Botões diretos da OF (PDF) para Pagamentos: Ver, Baixar, Imprimir */}
                    <td className="py-3 px-4 text-center">
                      <DocumentActions
                        documentId={inv.of_document_id}
                        fileName={`OF_${inv.of_number || 'documento'}.pdf`}
                        kindName="Ordem de Fornecimento"
                        compact
                      />
                    </td>

                    {/* Botões diretos da NF (PDF) para Pagamentos: Ver, Baixar, Imprimir */}
                    <td className="py-3 px-4 text-center">
                      <DocumentActions
                        documentId={inv.nf_document_id}
                        fileName={`NF_${inv.invoice_number}.pdf`}
                        kindName="Nota Fiscal"
                        compact
                      />
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/notas/${inv.id}`}>
                          <Button variant="primary" size="sm">
                            Pagar / Abrir
                          </Button>
                        </Link>
                        {profile?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            icon={<Pencil className="w-3.5 h-3.5" />}
                            onClick={() => setEditingInvoice(inv)}
                            title="Editar dados da NF"
                          />
                        )}
                        {profile?.role === 'admin' && (inv.total_paid === 0 || !inv.total_paid) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => setDeleteTarget(inv)}
                            title="Excluir NF da fila de pagamentos"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Nenhuma Nota Fiscal aguardando pagamento na fila.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteInvoice}
        title="Excluir Nota Fiscal da Fila de Pagamentos"
        itemIdentifier={`NF nº ${deleteTarget?.invoice_number} · ${deleteTarget?.supplier_name}`}
        description="Tem certeza que deseja excluir esta Nota Fiscal enviada para pagamento? Esta operação removerá a nota e os documentos associados da base e da fila de pagamentos. Todos os dados serão registrados na auditoria."
        confirmButtonText="Sim, excluir NF"
      />

      <EditInvoiceModal
        isOpen={Boolean(editingInvoice)}
        onClose={() => setEditingInvoice(null)}
        onSuccess={refetch}
        invoice={editingInvoice}
      />
    </div>
  );
}

export function HistoricoPagamentos() {
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [modality, setModality] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payments-history', search, supplierId, modality, dateFrom, dateTo, page],
    queryFn: () =>
      api.get<Paginated<any> & { summary: { total: number; count: number } }>('/payments', {
        search,
        supplier_id: supplierId,
        modality,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        pageSize: 25,
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
          Histórico Completo de Pagamentos
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Registros financeiros de todas as liquidações realizadas no sistema
        </p>
      </div>

      {data?.summary && (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Pago no Período</span>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {formatBRL(data.summary.total)}
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {data.summary.count} pagamento(s) localizado(s)
          </span>
        </div>
      )}

      {/* Tabela de Pagamentos */}
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
                <th className="py-3 px-4 font-semibold">Data do Pagto</th>
                <th className="py-3 px-4 font-semibold">Nº NF</th>
                <th className="py-3 px-4 font-semibold">Fornecedor</th>
                <th className="py-3 px-4 font-semibold">Modalidade</th>
                <th className="py-3 px-4 font-semibold text-right">Valor Pago</th>
                <th className="py-3 px-4 font-semibold">Registrado Por</th>
                <th className="py-3 px-4 font-semibold">Data/Hora Registro</th>
                <th className="py-3 px-4 font-semibold text-center">Comprovante</th>
                <th className="py-3 px-4 font-semibold text-center">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.data && data.data.length > 0 ? (
                data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{formatDateBR(p.payment_date)}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{p.invoice_number}</span>
                      {p.municipality && (
                        <span className="block mt-0.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-400">
                          📍 {p.municipality}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{p.supplier_name}</td>
                    <td className="py-3 px-4"><ModalityBadge modality={p.modality} /></td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">
                        {formatBRL(p.amount)}
                      </div>
                      {p.tax_amount && p.tax_amount > 0 ? (
                        <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Líq: {formatBRL(p.net_amount)} <span className="text-amber-600 dark:text-amber-400">(IRRF: {formatBRL(p.tax_amount)})</span>
                        </div>
                      ) : p.is_tax_exempt ? (
                        <div className="text-2xs text-slate-400">Sem retenção</div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{p.created_by_name || '—'}</td>
                    <td className="py-3 px-4 text-2xs text-slate-500 dark:text-slate-400">{formatDateTimeBR(p.created_at)}</td>
                    <td className="py-3 px-4 text-center">
                      {p.receipt_document_id ? (
                        <DocumentActions
                          documentId={p.receipt_document_id}
                          fileName={`Comprovante_${p.id.slice(0, 8)}.pdf`}
                          kindName="Comprovante"
                          compact
                        />
                      ) : (
                        <span className="text-2xs text-slate-400 italic">Sem anexo</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold ${
                          p.status === 'VALIDO'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/notas/${p.invoice_id}`}>
                        <Button variant="ghost" size="sm">Ver NF</Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Nenhum pagamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
