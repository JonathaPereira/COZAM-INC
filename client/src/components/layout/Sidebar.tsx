import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { BRAND } from '../../config/brand.js';
import { ROLE_LABELS } from '@cozam/shared';

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

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Principal',
      items: [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, perm: 'dashboard.view' },
        { to: '/lancamento', label: 'Novo Lançamento', icon: <FilePlus2 className="w-4 h-4" />, perm: 'invoices.write' },
      ],
    },
    {
      title: 'Compras',
      items: [
        { to: '/processos', label: 'Processos Adm.', icon: <FolderKanban className="w-4 h-4" />, perm: 'processes.view' },
        { to: '/ordens', label: 'Ordens de Fornecimento', icon: <FileText className="w-4 h-4" />, perm: 'processes.view' },
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
        { to: '/usuarios', label: 'Usuários e Permissões', icon: <Users className="w-4 h-4" />, perm: 'users.manage' },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col h-full select-none">
      {/* Cabeçalho da marca */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={BRAND.logos.icon}
            alt={BRAND.acronym}
            className="w-9 h-9 object-contain drop-shadow-xs"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 text-lg tracking-tight font-heading">
                {BRAND.acronym}
              </span>
              <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                PROD
              </span>
            </div>
            <p className="text-2xs text-slate-500 font-medium truncate max-w-[140px]">
              {BRAND.shortSystemName}
            </p>
          </div>
        </div>
      </div>

      {/* Cartão do setor ativo */}
      {profile && (
        <div className="px-4 py-3 mx-3 my-2 rounded-xl bg-slate-50 border border-slate-200/70">
          <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Acesso autorizado</p>
          <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
            {ROLE_LABELS[profile.role]}
          </p>
          <p className="text-2xs text-slate-500 truncate mt-0.5">{profile.full_name}</p>
        </div>
      )}

      {/* Navegação principal */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.perm || can(item.perm));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <p className="px-3 text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
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
                          ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-2xs border border-emerald-200/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={isActive ? 'text-emerald-700' : 'text-slate-400'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Rodapé da sidebar */}
      <div className="p-3 border-t border-slate-100 text-center">
        <p className="text-2xs text-slate-400">
          Consórcio Intermunicipal COZAM · 2026
        </p>
      </div>
    </aside>
  );
}
