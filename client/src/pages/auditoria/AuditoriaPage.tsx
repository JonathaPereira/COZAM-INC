import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Search, Filter, Calendar, User, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { AuditLogRow, Paginated } from '@cozam/shared';
import { formatDateTimeBR, AUDIT_ACTION_LABELS } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';

export function AuditoriaPage() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', search, action, entityType, dateFrom, dateTo, page],
    queryFn: () =>
      api.get<Paginated<AuditLogRow>>('/audit', {
        search,
        action,
        entity_type: entityType,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        pageSize: 30,
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
          Trilha de Auditoria do Sistema
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Histórico imutável de todas as inclusões, alterações, encaminhamentos e pagamentos
        </p>
      </div>

      {/* Filtros */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">Pesquisar</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por resumo, responsável ou justificativa..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">Módulo / Entidade</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value="">Todos os módulos</option>
            <option value="invoices">Notas Fiscais</option>
            <option value="payments">Pagamentos</option>
            <option value="supply_orders">Ordens de Fornecimento</option>
            <option value="administrative_processes">Processos</option>
            <option value="documents">Documentos</option>
            <option value="profiles">Usuários</option>
          </select>
        </div>

        <div>
          <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">Ação</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value="">Todas as ações</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Registros */}
      <Card className="p-0">
        <div className="divide-y divide-slate-100">
          {data?.data && data.data.length > 0 ? (
            data.data.map((log) => {
              const isExpanded = expandedId === log.id;
              const hasDiff = Boolean(log.old_data || log.new_data);

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">
                            {AUDIT_ACTION_LABELS[log.action] || log.action}
                          </span>
                          <span className="text-2xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {log.entity_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 mt-0.5 font-medium">{log.summary}</p>
                        {log.reason && (
                          <p className="text-xs text-slate-600 italic mt-0.5">
                            Justificativa: "{log.reason}"
                          </p>
                        )}
                        <p className="text-2xs text-slate-400 mt-1">
                          Responsável: <span className="font-semibold text-slate-600">{log.actor_name || 'Sistema'}</span> ({log.actor_role})
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                      <span className="text-2xs text-slate-500 font-medium">
                        {formatDateTimeBR(log.occurred_at)}
                      </span>
                      {hasDiff && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="text-2xs font-semibold text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer mt-1"
                        >
                          {isExpanded ? 'Ocultar detalhes' : 'Ver alterações'}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Painel expandido com diff */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-2xs bg-slate-50 p-3 rounded-lg font-mono">
                      {log.old_data && (
                        <div>
                          <p className="font-bold text-slate-500 mb-1">DADOS ANTERIORES:</p>
                          <pre className="overflow-x-auto p-2 bg-white rounded border border-slate-200">
                            {JSON.stringify(log.old_data, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.new_data && (
                        <div>
                          <p className="font-bold text-emerald-700 mb-1">NOVOS DADOS:</p>
                          <pre className="overflow-x-auto p-2 bg-white rounded border border-emerald-200">
                            {JSON.stringify(log.new_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              Nenhum registro de auditoria encontrado.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
