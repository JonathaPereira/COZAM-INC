import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import {
  FileSpreadsheet,
  Plus,
  UploadCloud,
  Search,
  Building,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { NovoContratoModal } from '../../components/contracts/NovoContratoModal.js';
import { ImportarContratoModal } from '../../components/contracts/ImportarContratoModal.js';

interface ContractRow {
  id: string;
  contract_number: string;
  year: number;
  supplier_id: string;
  supplier_name: string;
  supplier_cnpj?: string;
  object: string;
  legal_framework: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  requested_amount: number;
  remaining_amount: number;
  computed_status: string;
  days_to_expire: number | null;
  items_count?: number;
}

export function ContratosListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState('');
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { data: contracts = [], isLoading } = useQuery<ContractRow[]>({
    queryKey: ['contracts', search, supplierId, status],
    queryFn: () => api.get('/contracts', { search, supplier_id: supplierId, status }),
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get('/suppliers'),
  });

  const getStatusBadge = (st: string, days: number | null) => {
    if (st === 'VENCIDO' || (days !== null && days <= 0)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
          <AlertCircle className="w-3.5 h-3.5" /> Vencido
        </span>
      );
    }
    if (st === 'PROXIMO_VENCIMENTO' || (days !== null && days <= 30)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
          <Clock className="w-3.5 h-3.5" /> Vence em {days} dias
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
        <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
      </span>
    );
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Gestão de Contratos e Saldos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Controle de vigência, prorrogações, itens adjudicados e saldos contratuais disponíveis para emissão de Ordens.
          </p>
        </div>
        {can('contracts.write') && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-xs"
            >
              <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Importar em PDF
            </button>
            <button
              onClick={() => setIsNovoModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Novo Contrato
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por contrato, fornecedor ou objeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos os Fornecedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas as Situações</option>
            <option value="ATIVO">Ativos</option>
            <option value="PROXIMO_VENCIMENTO">Próximos do Vencimento (&lt; 30 dias)</option>
            <option value="VENCIDO">Vencidos</option>
            <option value="SUSPENSO">Suspensos</option>
            <option value="ENCERRADO">Encerrados</option>
          </select>
        </div>
      </div>

      {/* Lista de Contratos */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Carregando contratos e saldos...</div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Nenhum contrato cadastrado ou correspondente aos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Contrato</th>
                  <th className="px-6 py-4">Fornecedor</th>
                  <th className="px-6 py-4">Vigência</th>
                  <th className="px-6 py-4 text-right">Valor Total</th>
                  <th className="px-6 py-4">Execução do Saldo</th>
                  <th className="px-6 py-4 text-right">Saldo Disponível</th>
                  <th className="px-6 py-4">Situação</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {contracts.map((c) => {
                  const percentUsed =
                    c.total_amount > 0 ? Math.min(100, Math.round((c.requested_amount / c.total_amount) * 100)) : 0;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/contratos/${c.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">
                          Contrato nº {c.contract_number}/{c.year}
                        </div>
                        <div className="text-xs text-slate-400 line-clamp-1 max-w-xs mt-0.5">{c.object}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {c.supplier_name}
                        </div>
                        {c.supplier_cnpj && <div className="text-xs text-slate-400">{c.supplier_cnpj}</div>}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Até {new Date(c.end_date).toLocaleDateString('pt-BR')}
                        </div>
                        {c.days_to_expire !== null && (
                          <div
                            className={`text-2xs font-semibold mt-0.5 ${
                              c.days_to_expire <= 0
                                ? 'text-rose-500'
                                : c.days_to_expire <= 30
                                ? 'text-amber-500'
                                : 'text-slate-400'
                            }`}
                          >
                            {c.days_to_expire <= 0
                              ? 'Expirado'
                              : `${c.days_to_expire} dias restantes`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(c.total_amount)}
                      </td>
                      <td className="px-6 py-4 w-44">
                        <div className="flex justify-between text-2xs font-medium text-slate-500 mb-1">
                          <span>{percentUsed}% Solicitado</span>
                          <span>{formatCurrency(c.requested_amount)}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percentUsed >= 90
                                ? 'bg-rose-500'
                                : percentUsed >= 70
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(c.remaining_amount)}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(c.computed_status, c.days_to_expire)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                          Ver Detalhes <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      <NovoContratoModal isOpen={isNovoModalOpen} onClose={() => setIsNovoModalOpen(false)} />
      <ImportarContratoModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </div>
  );
}
