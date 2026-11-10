import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, LogOut, User as UserIcon, Shield, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { ROLE_LABELS } from '@cozam/shared';

export function Header({ onOpenMobile }: { onOpenMobile?: () => void }) {
  const { profile, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

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
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 md:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Esquerda: menu mobile e pesquisa rápida */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onOpenMobile && (
          <button
            type="button"
            onClick={onOpenMobile}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <form onSubmit={handleSearch} className="w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nº de NF, processo ou fornecedor..."
            className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 pl-9 pr-3 py-2 rounded-lg border border-transparent focus:border-emerald-600 focus:outline-none transition-all placeholder:text-slate-400"
          />
        </form>
      </div>

      {/* Direita: usuário e menu de opções */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer select-none"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-800 to-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {getInitials(profile?.full_name)}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {profile?.full_name || 'Carregando...'}
            </p>
            <p className="text-2xs text-slate-500 font-medium">
              {profile ? ROLE_LABELS[profile.role] : ''}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-slate-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800 truncate">{profile?.full_name}</p>
                <p className="text-2xs text-slate-500 truncate">{profile?.email}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/perfil');
                }}
                className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-slate-400" />
                <span>Meu Perfil e Senha</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Encerrar Sessão</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
