import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu, Search, LogOut, User as UserIcon, Shield, ChevronDown, Sun, Moon, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import { ROLE_LABELS } from '@cozam/shared';
import { ProfileModal } from '../profile/ProfileModal.js';
import { api } from '../../lib/api.js';

export function Header({ onOpenMobile }: { onOpenMobile?: () => void }) {
  const { profile, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const navigate = useNavigate();

  const { data: pendingData } = useQuery({
    queryKey: ['pending-password-resets-count'],
    queryFn: () => api.get<{ pendingCount: number }>('/password-reset-requests/pending-count'),
    enabled: profile?.role === 'admin',
    refetchInterval: 15000,
  });

  const pendingCount = pendingData?.pendingCount || 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/notas?search=${encodeURIComponent(search.trim())}`);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'CZ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
      {/* Esquerda: menu mobile e pesquisa rápida */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onOpenMobile && (
          <button
            type="button"
            onClick={onOpenMobile}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <form onSubmit={handleSearch} className="w-full relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nº de NF, processo ou fornecedor..."
            className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-850 text-xs text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2 rounded-lg border border-transparent focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </form>
      </div>

      {/* Direita: notificações, alternador de tema e perfil de usuário */}
      <div className="flex items-center gap-2">
        {/* Notificação de Solicitações de Senha para Administrador */}
        {profile?.role === 'admin' && (
          <button
            type="button"
            onClick={() => navigate('/usuarios?tab=solicitacoes')}
            title={
              pendingCount > 0
                ? `${pendingCount} solicitação(ões) de redefinição de senha aguardando sua autorização`
                : 'Nenhuma solicitação de senha pendente'
            }
            className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-2xs font-extrabold text-white shadow-xs animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
        )}

        {/* Botão de Alternância de Tema (Modo Escuro / Claro) */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400 transition-transform rotate-0 scale-100" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600 transition-transform rotate-0 scale-100" />
          )}
        </button>

        {/* Menu do usuário */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-800 to-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {getInitials(profile?.full_name)}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {profile?.full_name || 'Carregando...'}
              </p>
              <p className="text-2xs text-slate-500 dark:text-slate-400 font-medium">
                {profile ? ROLE_LABELS[profile.role] : ''}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 hidden sm:block" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{profile?.full_name}</p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">{profile?.email}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setProfileModalOpen(true);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>Meu Perfil e Senha</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  <span>Encerrar Sessão</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </header>
  );
}
