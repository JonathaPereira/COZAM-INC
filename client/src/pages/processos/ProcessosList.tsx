import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Plus, Search, Filter, ChevronRight, Eye } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { ProcessRow, Paginated } from '@cozam/shared';
import { formatBRL, formatDateBR, PROCESS_STATUS_LABELS } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { useAuth } from '../../contexts/AuthContext.js';

export function ProcessosList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { can } = useAuth();
  const canWrite = can('processes.write');

  const { data, isLoading } = useQuery({
    queryKey: ['processes', search, status, page],
    queryFn: () =>
      api.get<Paginated<ProcessRow>>('/processes', {
        search,
        status,
        page,
        pageSize: 15,
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            Processos Administrativos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cadastro geral de processos do consórcio, controle de OFs e NFs vinculadas
          </p>
        </div>

        {canWrite && (
          <Link to="/lancamento">
            <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
              Novo Lançamento
            </Button>
          </Link>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por número do processo ou descrição..."
            className="w-full bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-xs py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-full sm:w-auto"
        >
          <option value="">Todas as situações</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="CONCLUIDO">Concluído</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {/* Lista / Tabela */}
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-2xs">
                <th className="py-3 px-4 font-semibold">Número do Processo</th>
                <th className="py-3 px-4 font-semibold">Data Cadastro</th>
                <th className="py-3 px-4 font-semibold">Objeto / Descrição</th>
                <th className="py-3 px-4 font-semibold">Fornecedores</th>
                <th className="py-3 px-4 font-semibold text-center">OFs</th>
                <th className="py-3 px-4 font-semibold text-center">NFs</th>
                <th className="py-3 px-4 font-semibold text-right">Total Faturado</th>
                <th className="py-3 px-4 font-semibold text-right">Total Pago</th>
                <th className="py-3 px-4 font-semibold text-center">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.data && data.data.length > 0 ? (
                data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{p.process_number}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{formatDateBR(p.registered_at)}</td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs" title={p.description}>
                      <div className="truncate">{p.description}</div>
                      {p.municipalities && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-400">
                          📍 {p.municipalities}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.supplier_names && p.supplier_names.length > 0
                        ? p.supplier_names.join(', ')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {p.supply_orders_count}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {p.invoices_count}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800 tabular-nums">
                      {formatBRL(p.invoices_total)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      {formatBRL(p.paid_total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-2xs font-semibold ${
                          p.status === 'CONCLUIDO'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'CANCELADO'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {PROCESS_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/processos/${p.id}`}>
                        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>
                          Ver
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Nenhum processo administrativo encontrado.
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
