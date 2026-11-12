import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Filter,
  DollarSign,
  PieChart as PieIcon,
  BarChart2,
  Calendar,
  Building2,
  ScrollText,
  AlertTriangle,
  ArrowRight,
  Zap,
  Coffee,
  Layers,
  Package,
  Plus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../lib/api.js';
import type { DashboardData, Supplier } from '@cozam/shared';
import { formatBRL, formatDateBR, MODALITY_LABELS } from '@cozam/shared';
import { StatCard, Card, ProgressBar } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { ModalityBadge } from '../../components/ui/Badges.js';
import { useTheme } from '../../contexts/ThemeContext.js';

export function Dashboard() {
  const { isDark } = useTheme();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [modality, setModality] = useState('');
  const [status, setStatus] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Consulta lista de fornecedores para filtro
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  // Consulta dados do dashboard
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', dateFrom, dateTo, supplierId, modality, status],
    queryFn: () =>
      api.get<DashboardData>('/dashboard', {
        date_from: dateFrom,
        date_to: dateTo,
        supplier_id: supplierId,
        modality,
        status,
      }),
  });

  // Consulta contratos para indicadores de saldo contratual
  const { data: contracts = [] } = useQuery<any[]>({
    queryKey: ['contracts-dashboard'],
    queryFn: () => api.get('/contracts'),
  });

  const totalContractedAmount = contracts.reduce((acc, c) => acc + Number(c.total_amount || 0), 0);
  const totalRequestedAmount = contracts.reduce((acc, c) => acc + Number(c.requested_amount || 0), 0);
  const totalRemainingAmount = contracts.reduce((acc, c) => acc + Number(c.remaining_amount || 0), 0);
  const activeContractsCount = contracts.filter((c) => c.computed_status === 'ATIVO' || c.computed_status === 'PROXIMO_VENCIMENTO').length;
  const expiringContractsCount = contracts.filter((c) => c.computed_status === 'PROXIMO_VENCIMENTO').length;
  const expiredContractsCount = contracts.filter((c) => c.computed_status === 'VENCIDO').length;

  const [dashboardCategory, setDashboardCategory] = useState<'eletrico' | 'consumo_interno' | 'geral'>('eletrico');

  // Filtros de Contratos por Categoria
  const eletricoContracts = contracts.filter((c) =>
    (c.object && /elétr|eletri|ilumina|lâmpad|lampad|poste|luminár/i.test(c.object)) ||
    (c.supplier_name && /nacional/i.test(c.supplier_name))
  );
  const eletricoContracted = eletricoContracts.reduce((a, c) => a + Number(c.total_amount || 0), 0);
  const eletricoRequested = eletricoContracts.reduce((a, c) => a + Number(c.requested_amount || 0), 0);
  const eletricoRemaining = eletricoContracts.reduce((a, c) => a + Number(c.remaining_amount || 0), 0);

  const cozamUsoContracts = contracts.filter((c) =>
    (c.object && /café|cafe|água|agua|consumo|expediente|limpeza|escritório|epis|hospitalar/i.test(c.object)) ||
    (c.supplier_name && /bernardi/i.test(c.supplier_name))
  );
  const cozamUsoContracted = cozamUsoContracts.reduce((a, c) => a + Number(c.total_amount || 0), 0);
  const cozamUsoRequested = cozamUsoContracts.reduce((a, c) => a + Number(c.requested_amount || 0), 0);
  const cozamUsoRemaining = cozamUsoContracts.reduce((a, c) => a + Number(c.remaining_amount || 0), 0);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSupplierId('');
    setModality('');
    setStatus('');
  };

  const hasActiveFilters = Boolean(dateFrom || dateTo || supplierId || modality || status);

  // Paleta de cores para gráficos
  const COLORS = {
    greenPrimary: '#258900',
    greenLight: '#6BE000',
    orange: '#EA580C',
    amber: '#D97706',
    slate: isDark ? '#94A3B8' : '#64748B',
    blue: '#2563EB',
    purple: '#7C3AED',
  };

  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página e botão de filtro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            Painel Geral de Controle
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Indicadores gerenciais, fluxo documental e controle financeiro do consórcio
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={hasActiveFilters ? 'primary' : 'outline'}
            size="sm"
            icon={<Filter className="w-3.5 h-3.5" />}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            {hasActiveFilters ? 'Filtros Ativos' : 'Filtrar Dados'}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Painel colapsável de filtros avançados */}
      {filtersOpen && (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 animate-in fade-in duration-150">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">A partir de</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
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
              <option value="">Todos os fornecedores</option>
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
              <option value="">Todas as situações</option>
              <option value="AGUARDANDO_PAGAMENTO">Aguardando Pagamento</option>
              <option value="PARCIALMENTE_PAGA">Parcialmente Paga</option>
              <option value="TOTALMENTE_PAGA">Totalmente Paga</option>
              <option value="NAO_VERIFICADA">Não Verificada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
        </div>
      )}

      {/* Submenu de Dashboards */}
      <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setDashboardCategory('eletrico')}
          className={`flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            dashboardCategory === 'eletrico'
              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/40'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-100" />
          ⚡ Material Elétrico (Dashboard Principal)
        </button>

        <button
          type="button"
          onClick={() => setDashboardCategory('consumo_interno')}
          className={`flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            dashboardCategory === 'consumo_interno'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/40'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Coffee className="w-4 h-4 text-indigo-100" />
          ☕ Produtos de Uso do COZAM (Consumo Interno)
        </button>

        <button
          type="button"
          onClick={() => setDashboardCategory('geral')}
          className={`flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            dashboardCategory === 'geral'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-100" />
          📊 Visão Geral Consolidada
        </button>
      </div>

      {/* PAINEL CATEGORIA 1: Material Elétrico (Principal) */}
      {dashboardCategory === 'eletrico' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500 text-white font-bold">
                  <Zap className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-amber-950 dark:text-amber-200 font-heading">
                  Dashboard de Material Elétrico & Iluminação Pública
                </h2>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                Contratos de cabos, reatores, lâmpadas LED e materiais de iluminação para atendimento aos municípios consorciados.
              </p>
            </div>
            <Link to="/lancamento">
              <Button variant="primary" size="sm" icon={<Zap className="w-3.5 h-3.5" />} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                Emitir OF de Material Elétrico
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Contratado (Material Elétrico)"
              value={eletricoContracted}
              isCurrency
              subtitle={`${eletricoContracts.length} contrato(s) registrado(s)`}
              tone="default"
              icon={<Zap className="w-5 h-5 text-amber-600" />}
            />
            <StatCard
              title="Consumo Solicitado em OFs"
              value={eletricoRequested}
              isCurrency
              subtitle="Demandado em Ordens de Fornecimento"
              tone="default"
              icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
            />
            <StatCard
              title="Saldo Contratual Disponível"
              value={eletricoRemaining}
              isCurrency
              subtitle="Limite financeiro para novas solicitações"
              tone="green"
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            />
          </div>

          {eletricoContracts.length > 0 && (
            <Card title="Contratos Ativos de Material Elétrico">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-2xs">
                      <th className="py-2.5">Contrato</th>
                      <th className="py-2.5">Fornecedor</th>
                      <th className="py-2.5 text-right">Valor Total</th>
                      <th className="py-2.5 text-right">Solicitado</th>
                      <th className="py-2.5 text-right">Saldo Restante</th>
                      <th className="py-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {eletricoContracts.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                          Contrato nº {c.contract_number}/{c.year}
                          <p className="text-2xs text-slate-400 font-normal line-clamp-1">{c.object}</p>
                        </td>
                        <td className="py-2.5 font-medium">{c.supplier_name}</td>
                        <td className="py-2.5 text-right font-semibold">{formatBRL(c.total_amount)}</td>
                        <td className="py-2.5 text-right text-amber-700 dark:text-amber-400 font-semibold">{formatBRL(c.requested_amount)}</td>
                        <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">{formatBRL(c.remaining_amount)}</td>
                        <td className="py-2.5 text-right">
                          <Link to={`/contratos/${c.id}`} className="text-2xs font-bold text-indigo-600 hover:underline">
                            Ver Itens & Saldo →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* PAINEL CATEGORIA 2: Produtos de Uso do COZAM (Consumo Interno) */}
      {dashboardCategory === 'consumo_interno' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-600 text-white font-bold">
                  <Coffee className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-indigo-950 dark:text-indigo-200 font-heading">
                  Dashboard de Produtos de Uso do COZAM (Consumo Interno)
                </h2>
              </div>
              <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-1">
                Controle de suprimentos para uso e funcionamento do consórcio: Café, Água Mineral, Material de Expediente, Limpeza e EPIs.
              </p>
            </div>
            <Link to="/lancamento">
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                Emitir OF de Consumo Interno
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Contratado (Consumo Interno)"
              value={cozamUsoContracted}
              isCurrency
              subtitle={`${cozamUsoContracts.length} contrato(s) administrativo(s)`}
              tone="default"
              icon={<Coffee className="w-5 h-5 text-indigo-600" />}
            />
            <StatCard
              title="Consumo Solicitado em OFs"
              value={cozamUsoRequested}
              isCurrency
              subtitle="Materiais já requisitados pelo consórcio"
              tone="default"
              icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
            />
            <StatCard
              title="Saldo de Dotação Disponível"
              value={cozamUsoRemaining}
              isCurrency
              subtitle="Limite restante para novas requisições"
              tone="green"
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            />
          </div>

          {cozamUsoContracts.length > 0 && (
            <Card title="Contratos de Suprimentos & Consumo do COZAM">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-2xs">
                      <th className="py-2.5">Contrato</th>
                      <th className="py-2.5">Fornecedor</th>
                      <th className="py-2.5 text-right">Valor Total</th>
                      <th className="py-2.5 text-right">Consumido</th>
                      <th className="py-2.5 text-right">Saldo Restante</th>
                      <th className="py-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cozamUsoContracts.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                          Contrato nº {c.contract_number}/{c.year}
                          <p className="text-2xs text-slate-400 font-normal line-clamp-1">{c.object}</p>
                        </td>
                        <td className="py-2.5 font-medium">{c.supplier_name}</td>
                        <td className="py-2.5 text-right font-semibold">{formatBRL(c.total_amount)}</td>
                        <td className="py-2.5 text-right text-amber-700 dark:text-amber-400 font-semibold">{formatBRL(c.requested_amount)}</td>
                        <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">{formatBRL(c.remaining_amount)}</td>
                        <td className="py-2.5 text-right">
                          <Link to={`/contratos/${c.id}`} className="text-2xs font-bold text-indigo-600 hover:underline">
                            Ver Itens & Saldo →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* PAINEL CATEGORIA 3: Visão Geral Consolidada */}
      {dashboardCategory === 'geral' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Gestão de Saldos Contratuais COZAM */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Contratos & Saldos Globais Disponíveis
                </h2>
              </div>
              <Link
                to="/contratos"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                Ver todos os contratos
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Valor Total Contratado (Global)"
                value={totalContractedAmount}
                isCurrency
                subtitle={`${activeContractsCount} contrato(s) ativo(s) em vigência`}
                tone="default"
                icon={<ScrollText className="w-5 h-5 text-indigo-600" />}
              />
              <StatCard
                title="Total Solicitado em OFs"
                value={totalRequestedAmount}
                isCurrency
                subtitle="Montante demandado através de Ordens de Fornecimento"
                tone="default"
                icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
              />
              <StatCard
                title="Saldo Contratual Disponível"
                value={totalRemainingAmount}
                isCurrency
                subtitle="Limite financeiro remanescente para emissão de novas OFs"
                tone="green"
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              />
            </div>

            {expiringContractsCount > 0 && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    <strong>Atenção:</strong> {expiringContractsCount} contrato(s) com vigência expirando nos próximos 30 dias.
                  </span>
                </div>
                <Link
                  to="/contratos"
                  className="font-bold text-amber-900 dark:text-amber-200 underline hover:text-amber-700"
                >
                  Conferir e Aditivar
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cartões Financeiros Principais (Valores Confirmados) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Financeiro Documentado"
          value={data?.totals.registered || 0}
          isCurrency
          subtitle="Soma de todas as NFs verificadas e não canceladas"
          tone="default"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Total Efetivamente Pago"
          value={data?.totals.paid || 0}
          isCurrency
          subtitle="Soma de todos os pagamentos válidos registrados"
          tone="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          title="Saldo Devedor Conhecido"
          value={data?.totals.balance || 0}
          isCurrency
          subtitle="Diferença entre o documentado e os pagamentos realizados"
          tone={(data?.totals.balance || 0) > 0 ? 'orange' : 'green'}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Cartão Isolado para Pendências Não Verificadas */}
      {(data?.totals.unverified_count || 0) > 0 && (
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {data?.totals.unverified_count} Nota(s) com Situação "Sem Informação / Não Verificada"
              </p>
              <p className="text-2xs text-slate-600 dark:text-slate-400 mt-0.5">
                Valores estimados informados em levantamentos preliminares ({formatBRL(data?.totals.unverified_known_amount || 0)}) não estão somados aos totais confirmados acima.
              </p>
            </div>
          </div>
          <a
            href="/pendencias"
            className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 shrink-0"
          >
            Verificar Pendências
          </a>
        </div>
      )}

      {/* Contadores por Situação */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Processos"
          value={data?.counts.processes || 0}
          icon={<FolderKanban className="w-4 h-4" />}
        />
        <StatCard
          title="Notas Fiscais"
          value={data?.counts.invoices || 0}
          icon={<Receipt className="w-4 h-4" />}
        />
        <StatCard
          title="Aguardando"
          value={data?.counts.aguardando || 0}
          tone="amber"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          title="Parciais"
          value={data?.counts.parciais || 0}
          tone="orange"
          icon={<AlertCircle className="w-4 h-4" />}
        />
        <StatCard
          title="Totalmente Pagas"
          value={data?.counts.pagas || 0}
          tone="green"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <StatCard
          title="Fila de Pagamentos"
          value={data?.counts.fila_pagamentos || 0}
          badge="Abertas"
          tone="default"
        />
      </div>

      {/* Gráficos Gerenciais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Evolução mensal dos pagamentos */}
        <Card
          title="Evolução dos Pagamentos Realizados"
          subtitle="Volume financeiro liquidado mês a mês (R$)"
        >
          <div className="h-72 w-full pt-4">
            {data?.monthly && data.monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthly} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.greenPrimary} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.greenPrimary} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke={isDark ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <YAxis
                    stroke={isDark ? '#64748b' : '#94a3b8'}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any) => [formatBRL(Number(v)), 'Valor Pago']}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="paid"
                    stroke={COLORS.greenPrimary}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorPaid)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum pagamento registrado no período
              </div>
            )}
          </div>
        </Card>

        {/* Gráfico 2: Distribuição por fornecedor (MZ Bernardi vs Nacional) */}
        <Card
          title="Valores por Fornecedor Ativo"
          subtitle="Comparativo entre total documentado e total pago por empresa"
        >
          <div className="h-72 w-full pt-4">
            {data?.by_supplier && data.by_supplier.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.by_supplier} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke={isDark ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <YAxis
                    stroke={isDark ? '#64748b' : '#94a3b8'}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, name: any) => [
                      formatBRL(Number(v)),
                      name === 'amount' ? 'Total Faturado' : name === 'paid' ? 'Total Pago' : 'Saldo Devedor',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ color: isDark ? '#cbd5e1' : '#475569' }}
                    formatter={(v) => (v === 'amount' ? 'Documentado' : v === 'paid' ? 'Pago' : 'Saldo')}
                  />
                  <Bar dataKey="amount" fill={isDark ? '#475569' : '#94A3B8'} name="amount" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" fill={COLORS.greenPrimary} name="paid" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="balance" fill={COLORS.orange} name="balance" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado por fornecedor
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Gráfico 3 e Tabela de Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição por modalidade */}
        <Card
          title="Distribuição por Modalidade"
          subtitle="FUMIP vs Compra Compartilhada"
          className="lg:col-span-1"
        >
          <div className="h-64 flex flex-col justify-center">
            {data?.by_modality && data.by_modality.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.by_modality}
                      dataKey="paid"
                      nameKey="modality"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {data.by_modality.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.modality === 'FUMIP' ? COLORS.blue : COLORS.purple}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [formatBRL(Number(v)), 'Pago']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {data.by_modality.map((m) => (
                    <div key={m.modality} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            m.modality === 'FUMIP' ? 'bg-blue-600' : 'bg-purple-600'
                          }`}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{MODALITY_LABELS[m.modality]}</span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatBRL(m.paid)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-xs text-slate-400">Nenhum pagamento registrado</p>
            )}
          </div>
        </Card>

        {/* Últimos pagamentos registrados */}
        <Card
          title="Últimos Pagamentos Registrados"
          subtitle="Liquidações financeiras mais recentes"
          className="lg:col-span-2"
        >
          {data?.recent_payments && data.recent_payments.length > 0 ? (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-2xs">
                    <th className="pb-2 font-semibold">Data</th>
                    <th className="pb-2 font-semibold">NF</th>
                    <th className="pb-2 font-semibold">Fornecedor</th>
                    <th className="pb-2 font-semibold text-right">Valor Pago</th>
                    <th className="pb-2 font-semibold text-right">Registrado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recent_payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 font-medium text-slate-600 dark:text-slate-400">{formatDateBR(p.payment_date)}</td>
                      <td className="py-2.5 font-bold text-slate-900 dark:text-slate-100">{p.invoice_number}</td>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">{p.supplier_name}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatBRL(p.amount)}
                      </td>
                      <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">{p.created_by_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400 py-8">Nenhum pagamento registrado ainda.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
