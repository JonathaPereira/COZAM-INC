import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { Button } from '../ui/Button.js';
import type { Permission } from '@cozam/shared';

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
      {/* Sidebar Desktop */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar Mobile (Off-canvas) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 z-10 shadow-2xl">
            <Sidebar onCloseMobile={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-3">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 tracking-wide">
          Verificando credenciais COZAM...
        </p>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { can, profile } = useAuth();

  if (!can(permission)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
          Acesso Restrito
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mt-2">
          Seu perfil de usuário ({profile?.role}) não possui a permissão{' '}
          <code className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">
            {permission}
          </code>{' '}
          necessária para acessar este módulo.
        </p>
        <div className="mt-6">
          <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => window.history.back()}>
            Voltar para a tela anterior
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
