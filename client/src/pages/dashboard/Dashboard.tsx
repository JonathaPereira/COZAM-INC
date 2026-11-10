import React, { useState } from 'react';
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
