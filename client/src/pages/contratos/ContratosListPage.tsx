import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../../lib/api.js';
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
  Gavel,
  DollarSign,
  TrendingUp,
  X,
  FileText,
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

interface ProcurementProcess {
  id: string;
  process_number: string;
  year: number;
  bidding_number?: string;
  modality: string;
  legal_framework: string;
  object: string;
  opening_date?: string;
  homologation_date?: string;
  status: string;
  contracts_count?: number;
  created_at: string;
}

const MODALITY_LABELS: Record<string, string> = {
  PREGAO_ELETRONICO: 'Pregão Eletrônico',
  PREGAO_PRESENCIAL: 'Pregão Presencial',
  CONCORRENCIA: 'Concorrência',
  DISPENSA: 'Dispensa de Licitação',
  INEXIGIBILIDADE: 'Inexigibilidade',
  ADESAO_ATA: 'Adesão a Ata (Carona)',
  OUTRO: 'Outro Procedimento',
};

export function ContratosListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'contratos' | 'licitacoes'>('contratos');
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState('');
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNovoProcessoModalOpen, setIsNovoProcessoModalOpen] = useState(false);

  // Estados para criação rápida de processo licitatório avulso
  const [newProcNum, setNewProcNum] = useState('');
  const [newProcYear, setNewProcYear] = useState(new Date().getFullYear());
  const [newBiddingNum, setNewBiddingNum] = useState('');
  const [newModality, setNewModality] = useState('PREGAO_ELETRONICO');
  const [newLegalFramework, setNewLegalFramework] = useState('Lei 14.133/2021');
  const [newProcObject, setNewProcObject] = useState('');

  const { data: contracts = [], isLoading: loadingContracts } = useQuery<ContractRow[]>({
    queryKey: ['contracts', search, supplierId, status],
    queryFn: () => api.get('/contracts', { search, supplier_id: supplierId, status }),
  });

  const { data: procurements = [], isLoading: loadingProcurements } = useQuery<ProcurementProcess[]>({
    queryKey: ['procurements', search],
    queryFn: () => api.get('/procurements', { search }),
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get('/suppliers'),
  });

  const createProcurementMutation = useMutation({
    mutationFn: (data: any) => api.post('/procurements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurements'] });
      setIsNovoProcessoModalOpen(false);
      setNewProcNum('');
      setNewBiddingNum('');
      setNewProcObject('');
    },
  });

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // Cálculos de consumo e saldo do fornecedor selecionado
  const supplierContracts = supplierId ? contracts.filter((c) => c.supplier_id === supplierId) : [];
  const supplierTotalContracted = supplierContracts.reduce((a, c) => a + Number(c.total_amount || 0), 0);
  const supplierTotalRequested = supplierContracts.reduce((a, c) => a + Number(c.requested_amount || 0), 0);
  const supplierRemaining = supplierContracts.reduce((a, c) => a + Number(c.remaining_amount || 0), 0);
  const supplierPercentConsumed =
    supplierTotalContracted > 0
      ? Math.min(100, Math.round((supplierTotalRequested / supplierTotalContracted) * 100))
      : 0;

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
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho Consolidado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Gestão Integrada de Contratos & Licitações
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Plataforma centralizada para gestão de processos licitatórios, contratos, amarração de saldos por item e fornecedores.
          </p>
        </div>

        {can('contracts.write') && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-xs"
            >
              <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Importar Contrato (PDF)
            </button>
            <button
              onClick={() => setIsNovoModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Novo Contrato & Processo
            </button>
          </div>
        )}
      </div>

      {/* Seletor de Abas / Visão Unificada */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('contratos')}
          className={`px-4 py-2.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'contratos'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          Contratos & Saldos ({contracts.length})
        </button>
        <button
          onClick={() => setActiveTab('licitacoes')}
          className={`px-4 py-2.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'licitacoes'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Gavel className="w-4 h-4" />
          Processos Licitatórios & Licitações ({procurements.length})
        </button>
      </div>

      {/* Painel de Destaque por Fornecedor (quando um fornecedor específico é selecionado) */}
      {selectedSupplier && (
        <div className="bg-linear-to-r from-indigo-50 to-blue-50 dark:from-slate-800/80 dark:to-indigo-950/40 p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-200/60 dark:border-indigo-900/40 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-extrabold px-2 py-0.5 rounded bg-indigo-600 text-white uppercase tracking-wider">
                  Fornecedor Selecionado
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedSupplier.name}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {selectedSupplier.legal_name && `${selectedSupplier.legal_name} · `}
                CNPJ: {selectedSupplier.cnpj || 'Não informado'}
                {selectedSupplier.city && ` · ${selectedSupplier.city}/${selectedSupplier.state || 'AL'}`}
              </p>
            </div>
            <button
              onClick={() => setSupplierId('')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-2xs"
            >
              <X className="w-3.5 h-3.5" /> Limpar Filtro de Fornecedor
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900/70 p-3.5 rounded-xl border border-indigo-100 dark:border-slate-800">
              <span className="text-2xs font-bold uppercase text-slate-400">Total Contratado com Este Fornecedor</span>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                {formatCurrency(supplierTotalContracted)}
              </p>
              <p className="text-2xs text-slate-500 mt-1">{supplierContracts.length} contrato(s) registrado(s)</p>
            </div>

            <div className="bg-white dark:bg-slate-900/70 p-3.5 rounded-xl border border-indigo-100 dark:border-slate-800">
              <span className="text-2xs font-bold uppercase text-amber-600 dark:text-amber-400">Consumo Solicitado (OFs)</span>
              <p className="text-lg font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">
                {formatCurrency(supplierTotalRequested)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${supplierPercentConsumed}%` }}
                  />
                </div>
                <span className="text-2xs font-bold text-slate-500">{supplierPercentConsumed}%</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/70 p-3.5 rounded-xl border border-indigo-100 dark:border-slate-800">
              <span className="text-2xs font-bold uppercase text-emerald-600 dark:text-emerald-400">Saldo Restante Disponível</span>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatCurrency(supplierRemaining)}
              </p>
              <p className="text-2xs text-slate-500 mt-1">Limite para novas Ordens de Fornecimento</p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros da Página */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'contratos' ? 'Buscar por contrato, fornecedor ou objeto...' : 'Buscar por processo, pregão ou objeto...'}
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
                {s.name} {s.cnpj ? `(${s.cnpj})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          {activeTab === 'contratos' ? (
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
          ) : (
            <div className="flex items-center justify-end h-full">
              {can('procurements.write') && (
                <button
                  onClick={() => setIsNovoProcessoModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo Processo Licitatório
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo da Aba 1: Contratos */}
      {activeTab === 'contratos' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          {loadingContracts ? (
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
                            <span>{percentUsed}% Consumido</span>
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
      )}

      {/* Conteúdo da Aba 2: Processos Licitatórios */}
      {activeTab === 'licitacoes' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          {loadingProcurements ? (
            <div className="p-12 text-center text-slate-500">Carregando processos licitatórios...</div>
          ) : procurements.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Nenhum processo licitatório encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Processo / Licitação</th>
                    <th className="px-6 py-4">Modalidade & Fundamento</th>
                    <th className="px-6 py-4">Objeto da Licitação</th>
                    <th className="px-6 py-4">Datas Chave</th>
                    <th className="px-6 py-4 text-center">Contratos Vinculados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {procurements.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Gavel className="w-4 h-4 text-indigo-600" />
                          Processo nº {p.process_number}/{p.year}
                        </div>
                        {p.bidding_number && (
                          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {p.bidding_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          {MODALITY_LABELS[p.modality] || p.modality}
                        </span>
                        <div className="text-2xs text-slate-400 mt-1">{p.legal_framework}</div>
                      </td>
                      <td className="px-6 py-4 max-w-sm">
                        <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">{p.object}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {p.opening_date && <div>Abertura: {new Date(p.opening_date).toLocaleDateString('pt-BR')}</div>}
                        {p.homologation_date && <div>Homologação: {new Date(p.homologation_date).toLocaleDateString('pt-BR')}</div>}
                        {!p.opening_date && !p.homologation_date && '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {p.contracts_count || 0} contrato(s)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <NovoContratoModal isOpen={isNovoModalOpen} onClose={() => setIsNovoModalOpen(false)} />
      <ImportarContratoModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      {/* Modal para criar processo licitatório avulso */}
      {isNovoProcessoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-indigo-600" />
                Novo Processo Licitatório
              </h3>
              <button onClick={() => setIsNovoProcessoModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProcNum.trim() || !newProcObject.trim()) return;
                createProcurementMutation.mutate({
                  process_number: newProcNum.trim(),
                  year: Number(newProcYear),
                  bidding_number: newBiddingNum.trim() || undefined,
                  modality: newModality,
                  legal_framework: newLegalFramework.trim() || 'Lei 14.133/2021',
                  object: newProcObject.trim(),
                });
              }}
              className="space-y-3 mt-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold block mb-1">Nº Processo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 005/2026"
                    value={newProcNum}
                    onChange={(e) => setNewProcNum(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Ano</label>
                  <input
                    type="number"
                    value={newProcYear}
                    onChange={(e) => setNewProcYear(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border rounded text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Identificação da Licitação / Pregão</label>
                <input
                  type="text"
                  placeholder="Ex: Pregão Eletrônico nº 03/2026"
                  value={newBiddingNum}
                  onChange={(e) => setNewBiddingNum(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold block mb-1">Modalidade</label>
                  <select
                    value={newModality}
                    onChange={(e) => setNewModality(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  >
                    <option value="PREGAO_ELETRONICO">Pregão Eletrônico</option>
                    <option value="PREGAO_PRESENCIAL">Pregão Presencial</option>
                    <option value="CONCORRENCIA">Concorrência</option>
                    <option value="DISPENSA">Dispensa</option>
                    <option value="INEXIGIBILIDADE">Inexigibilidade</option>
                    <option value="ADESAO_ATA">Adesão a Ata</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Fundamento Legal</label>
                  <input
                    type="text"
                    value={newLegalFramework}
                    onChange={(e) => setNewLegalFramework(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Objeto *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Descrição sucinta do objeto da contratação..."
                  value={newProcObject}
                  onChange={(e) => setNewProcObject(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNovoProcessoModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createProcurementMutation.isPending}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold"
                >
                  {createProcurementMutation.isPending ? 'Salvando...' : 'Cadastrar Processo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modais */}
      <NovoContratoModal isOpen={isNovoModalOpen} onClose={() => setIsNovoModalOpen(false)} />
      <ImportarContratoModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </div>
  );
}
