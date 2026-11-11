import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FilePlus2,
  FolderKanban,
  FileText,
  Receipt,
  Wallet,
  History,
  ClockAlert,
  BarChart3,
  ShieldCheck,
  Building2,
  Users,
  ChevronRight,
  X,
  ScrollText,
  Gavel,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { BRAND } from '../../config/brand.js';
import { ROLE_LABELS } from '@cozam/shared';
import { api } from '../../lib/api.js';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  perm?: Parameters<ReturnType<typeof useAuth>['can']>[0];
  badge?: string;
}

export function Sidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const { profile, can } = useAuth();
  const location = useLocation();

  const { data: pendingData } = useQuery({
    queryKey: ['pending-password-resets-count'],
    queryFn: () => api.get<{ pendingCount: number }>('/password-reset-requests/pending-count'),
    enabled: profile?.role === 'admin',
    refetchInterval: 15000,
  });
  const pendingCount = pendingData?.pendingCount || 0;

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Principal',
      items: [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, perm: 'dashboard.view' },
        { to: '/lancamento', label: 'Novo Lançamento', icon: <FilePlus2 className="w-4 h-4" />, perm: 'invoices.write' },
      ],
    },
    {
      title: 'Contratos & Compras',
      items: [
        { to: '/contratos', label: 'Contratos & Licitações', icon: <ScrollText className="w-4 h-4" />, perm: 'contracts.view' },
        { to: '/ordens', label: 'Ordens de Fornecimento', icon: <FileText className="w-4 h-4" />, perm: 'processes.view' },
        { to: '/ordens/nova', label: 'Emitir Nova OF', icon: <FilePlus2 className="w-4 h-4" />, perm: 'supply_orders.write' },
        { to: '/processos', label: 'Processos Adm.', icon: <FolderKanban className="w-4 h-4" />, perm: 'processes.view' },
        { to: '/notas', label: 'Notas Fiscais', icon: <Receipt className="w-4 h-4" />, perm: 'invoices.view_drafts' },
      ],
    },
    {
      title: 'Pagamentos',
      items: [
        { to: '/pagamentos', label: 'Fila de Pagamentos', icon: <Wallet className="w-4 h-4" />, perm: 'payments.view' },
        { to: '/pagamentos/historico', label: 'Histórico de Pagamentos', icon: <History className="w-4 h-4" />, perm: 'payments.view' },
      ],
    },
    {
      title: 'Gestão & Controle',
      items: [
        { to: '/pendencias', label: 'Pendências Históricas', icon: <ClockAlert className="w-4 h-4" />, perm: 'historical.write' },
        { to: '/relatorios', label: 'Relatórios Oficiais', icon: <BarChart3 className="w-4 h-4" />, perm: 'reports.view' },
        { to: '/auditoria', label: 'Auditoria do Sistema', icon: <ShieldCheck className="w-4 h-4" />, perm: 'audit.view' },
      ],
    },
    {
      title: 'Administração',
      items: [
        { to: '/fornecedores', label: 'Fornecedores', icon: <Building2 className="w-4 h-4" />, perm: 'suppliers.manage' },
        { to: '/destinatarios', label: 'Municípios Destinatários', icon: <Landmark className="w-4 h-4" />, perm: 'destinations.manage' },
        {
          to: '/usuarios',
          label: 'Usuários e Permissões',
          icon: <Users className="w-4 h-4" />,
          perm: 'users.manage',
          badge: pendingCount > 0 ? String(pendingCount) : undefined,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 flex flex-col h-full select-none transition-colors">
      {/* Cabeçalho da marca */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={BRAND.logos.icon}
            alt={BRAND.acronym}
            className="w-9 h-9 object-contain drop-shadow-xs"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-lg tracking-tight font-heading">
                {BRAND.acronym}
              </span>
              <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                PROD
              </span>
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[140px]">
              {BRAND.shortSystemName}
            </p>
          </div>
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Cartão do setor ativo */}
      {profile && (
        <div className="px-4 py-3 mx-3 my-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
          <p className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acesso autorizado</p>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5 truncate">
            {ROLE_LABELS[profile.role]}
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{profile.full_name}</p>
        </div>
      )}

      {/* Navegação principal */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.perm || can(item.perm));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <p className="px-3 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                {group.title}
              </p>
              <nav className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    item.to === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onCloseMobile}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs border border-emerald-200/50 dark:border-emerald-800/40'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span
                            title={`${item.badge} solicitação(ões) pendente(s)`}
                            className="px-1.5 py-0.5 rounded-full text-2xs font-extrabold bg-amber-500 text-white animate-pulse"
                          >
                            {item.badge}
                          </span>
                        )}
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Rodapé da sidebar */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-2xs text-slate-400 dark:text-slate-500">
          Consórcio Intermunicipal COZAM · 2026
        </p>
      </div>
    </aside>
  );
}
