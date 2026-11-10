import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Eye,
  Calendar,
  Building2,
  DollarSign,
  Clock,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import type { InvoiceRow, Paginated, Supplier, Modality } from '@cozam/shared';
import { formatBRL, formatDateBR } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { ModalityBadge, ForwardBadge } from '../../components/ui/Badges.js';
import { DocumentActions } from '../../components/ui/DocumentViewerModal.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function NotasFiscaisList() {
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [modality, setModality] = useState('');
  const [status, setStatus] = useState('');
  const [forwardStatus, setForwardStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const { can } = useAuth();
  const canWrite = can('invoices.write');

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['invoices-list', search, supplierId, modality, status, forwardStatus, dateFrom, dateTo, page],
    queryFn: () =>
      api.get<Paginated<InvoiceRow> & { summary: { amount: number; total_paid: number; balance: number } }>(
        '/invoices',
        {
          search,
          supplier_id: supplierId,
          modality,
          status,
          forward_status: forwardStatus,
          date_from: dateFrom,
          date_to: dateTo,
          page,
          pageSize: 20,
        }
      ),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            Notas Fiscais Cadastradas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visão completa de Compras: controle documental, modalidades e encaminhamento
          </p>
        </div>

        {canWrite && (
          <Link to="/lancamento">
            <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
              Nova Nota Fiscal
            </Button>
          </Link>
        )}
      </div>

      {/* Barra de Totais do Filtro Atual */}
      {data?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Faturado nesta consulta</span>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatBRL(data.summary.amount)}</p>
          </div>
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
            <span className="text-2xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase">Total Pago</span>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatBRL(data.summary.total_paid)}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Saldo Devedor</span>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-400 tabular-nums">{formatBRL(data.summary.balance)}</p>
          </div>
        </div>
      )}

      {/* Filtros Avançados */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Pesquisa</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nº da NF, fornecedor, processo..."
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Fornecedor</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
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
        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Situação</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todas</option>
            <option value="AGUARDANDO_PAGAMENTO">Aguardando</option>
            <option value="PARCIALMENTE_PAGA">Parcial</option>
            <option value="TOTALMENTE_PAGA">Totalmente Paga</option>
            <option value="NAO_VERIFICADA">Não Verificada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Tramitação</label>
          <select
            value={forwardStatus}
            onChange={(e) => setForwardStatus(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todas</option>
            <option value="RASCUNHO">Não encaminhada</option>
            <option value="ENCAMINHADA">Encaminhada</option>
            <option value="EM_ATENDIMENTO">Em atendimento</option>
          </select>
        </div>
      </div>

      {/* Tabela de NFs */}
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
                <th className="py-3 px-4 font-semibold">Nº NF</th>
                <th className="py-3 px-4 font-semibold">Fornecedor</th>
                <th className="py-3 px-4 font-semibold">Emissão</th>
                <th className="py-3 px-4 font-semibold">Modalidade</th>
                <th className="py-3 px-4 font-semibold">Processo / OF</th>
                <th className="py-3 px-4 font-semibold text-right">Valor da NF</th>
                <th className="py-3 px-4 font-semibold text-right">Total Pago</th>
                <th className="py-3 px-4 font-semibold text-right">Saldo Devedor</th>
                <th className="py-3 px-4 font-semibold text-center">Tramitação</th>
                <th className="py-3 px-4 font-semibold text-center">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.data && data.data.length > 0 ? (
                data.data.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{inv.invoice_number}</td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{inv.supplier_name}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDateBR(inv.issue_date)}</td>
                    <td className="py-3 px-4"><ModalityBadge modality={inv.modality} /></td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <span className="block font-medium">{inv.process_number || '—'}</span>
                      <span className="text-2xs text-slate-400">OF: {inv.of_number || '—'}</span>
                    </td>
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
                      <ForwardBadge forwardStatus={inv.forward_status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/notas/${inv.id}`}>
                        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>
                          Abrir
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    Nenhuma Nota Fiscal encontrada com os filtros selecionados.
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
