import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { AuthProvider } from './contexts/AuthContext.js';
import { AppShell, RequireAuth, RequirePermission } from './components/layout/AppShell.js';

// Páginas de Autenticação
import { Login } from './pages/auth/Login.js';
import { RecuperarSenha, RedefinirSenha } from './pages/auth/RecuperarSenha.js';

// Páginas Principais
import { Dashboard } from './pages/dashboard/Dashboard.js';
import { LancamentoWizard } from './pages/lancamento/LancamentoWizard.js';
import { ProcessosList } from './pages/processos/ProcessosList.js';
import { ProcessoDetail } from './pages/processos/ProcessoDetail.js';
import { OrdensList, OrdemDetail } from './pages/ordens/OrdensList.js';
import { NotasFiscaisList } from './pages/notas/NotasFiscaisList.js';
import { NotaFiscalDetail } from './pages/notas/NotaFiscalDetail.js';
import { PainelPagamentos, HistoricoPagamentos } from './pages/pagamentos/PainelPagamentos.js';
import { PendenciasHistoricas } from './pages/pendencias/PendenciasHistoricas.js';
import { RelatoriosPage } from './pages/relatorios/RelatoriosPage.js';
import { AuditoriaPage } from './pages/auditoria/AuditoriaPage.js';
import { UsuariosPage } from './pages/usuarios/UsuariosPage.js';
import { FornecedoresPage } from './pages/fornecedores/FornecedoresPage.js';
import { PerfilPage, NotFound } from './pages/perfil/PerfilPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />

            {/* Rotas Autenticadas protegidas pelo AppShell */}
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route
                index
                element={
                  <RequirePermission permission="dashboard.view">
                    <Dashboard />
                  </RequirePermission>
                }
              />

              <Route
                path="lancamento"
                element={
                  <RequirePermission permission="invoices.write">
                    <LancamentoWizard />
                  </RequirePermission>
                }
              />

              <Route
                path="processos"
                element={
                  <RequirePermission permission="processes.view">
                    <ProcessosList />
                  </RequirePermission>
                }
              />

              <Route
                path="processos/:id"
                element={
                  <RequirePermission permission="processes.view">
                    <ProcessoDetail />
                  </RequirePermission>
                }
              />

              <Route
                path="ordens"
                element={
                  <RequirePermission permission="processes.view">
                    <OrdensList />
                  </RequirePermission>
                }
              />

              <Route
                path="ordens/:id"
                element={
                  <RequirePermission permission="processes.view">
                    <OrdemDetail />
                  </RequirePermission>
                }
              />

              <Route
                path="notas"
                element={
                  <RequirePermission permission="invoices.view_drafts">
                    <NotasFiscaisList />
                  </RequirePermission>
                }
              />

              <Route path="notas/:id" element={<NotaFiscalDetail />} />

              <Route
                path="pagamentos"
                element={
                  <RequirePermission permission="payments.view">
                    <PainelPagamentos />
                  </RequirePermission>
                }
              />

              <Route
                path="pagamentos/historico"
                element={
                  <RequirePermission permission="payments.view">
                    <HistoricoPagamentos />
                  </RequirePermission>
                }
              />

              <Route
                path="pendencias"
                element={
                  <RequirePermission permission="historical.write">
                    <PendenciasHistoricas />
                  </RequirePermission>
                }
              />

              <Route
                path="relatorios"
                element={
                  <RequirePermission permission="reports.view">
                    <RelatoriosPage />
                  </RequirePermission>
                }
              />

              <Route
                path="auditoria"
                element={
                  <RequirePermission permission="audit.view">
                    <AuditoriaPage />
                  </RequirePermission>
                }
              />

              <Route
                path="usuarios"
                element={
                  <RequirePermission permission="users.manage">
                    <UsuariosPage />
                  </RequirePermission>
                }
              />

              <Route
                path="fornecedores"
                element={
                  <RequirePermission permission="suppliers.manage">
                    <FornecedoresPage />
                  </RequirePermission>
                }
              />

              <Route path="perfil" element={<PerfilPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
