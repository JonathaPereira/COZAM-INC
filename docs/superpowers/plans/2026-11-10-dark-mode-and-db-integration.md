# Plano de Implementação — Modo Escuro & Guia de Integração de Banco de Dados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o Modo Escuro (Dark Mode) completo e consistente em toda a aplicação COZAM (persistido em localStorage, com suporte a preferência do sistema e alternador no cabeçalho), seguido da elaboração do guia completo e detalhado em tópicos para integração com o banco de dados Supabase e criação de logins reais de produção.

**Architecture:** 
1. **Frontend Theming:** `ThemeContext` gerenciando estado `light | dark | system` via classe `.dark` em `document.documentElement`, com suporte nativo no Tailwind CSS v4 via `@custom-variant dark`. Todos os componentes base (`Card`, `Input`, `Select`, `Modal`, `Button`, `StatusBadge`, `Sidebar`, `Header`) e páginas recebem estilização adaptativa (`dark:*`).
2. **Dashboard Visuals:** Ajuste das cores dos gráficos Recharts (tooltips, eixos e linhas de grade) conforme o tema ativo.
3. **Guia de Integração e Logins:** Documentação técnica exaustiva passo a passo em tópicos cobrindo Supabase (DB, Auth, Storage, RLS) e Render.

**Tech Stack:** React 19, Tailwind CSS v4, Lucide Icons, Recharts, LocalStorage.

---

### Task 1: Infraestrutura de Tema e Tailwind CSS v4

**Files:**
- Modify: `client/src/index.css`
- Create: `client/src/contexts/ThemeContext.tsx`
- Modify: `client/src/App.tsx`

- [x] **Step 1: Configurar `@custom-variant dark` e variáveis de cor no `client/src/index.css`**
- [x] **Step 2: Criar `ThemeContext.tsx` com detecção de preferência de sistema e persistência em localStorage**
- [x] **Step 3: Envolver a aplicação com `ThemeProvider` em `client/src/App.tsx`**

---

### Task 2: Componentes de Layout e Alternador de Tema

**Files:**
- Modify: `client/src/components/layout/Header.tsx`
- Modify: `client/src/components/layout/AppShell.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`

- [x] **Step 1: Adicionar botão de alternância de tema no `Header.tsx` (Sol / Lua com indicador)**
- [x] **Step 2: Ajustar estilos de fundo e bordas no `AppShell.tsx` e `Header.tsx` para modo escuro**
- [x] **Step 3: Refinar contraste da logo e itens na `Sidebar.tsx`**

---

### Task 3: Adaptação dos Componentes UI e Formulários

**Files:**
- Modify: `client/src/components/ui/Card.tsx`
- Modify: `client/src/components/ui/Input.tsx`
- Modify: `client/src/components/ui/Modal.tsx`
- Modify: `client/src/components/ui/FileDropzone.tsx`
- Modify: `client/src/components/ui/CurrencyInput.tsx`
- Modify: `client/src/components/ui/DocumentViewerModal.tsx`

- [x] **Step 1: Adaptar `Card` e `StatCard` para `dark:bg-slate-900 dark:border-slate-800`**
- [x] **Step 2: Adaptar `Input`, `CurrencyInput`, `Select` e `Textarea` para inputs escuros legíveis**
- [x] **Step 3: Adaptar `Modal`, `ConfirmDialog` e `DocumentViewerModal`**
- [x] **Step 4: Adaptar `FileDropzone` para contraste adequado no drag-and-drop**

---

### Task 4: Adaptação das Páginas e Gráficos do Dashboard

**Files:**
- Modify: `client/src/pages/dashboard/Dashboard.tsx`
- Modify: `client/src/pages/auth/Login.tsx`
- Modify: `client/src/pages/pagamentos/PainelPagamentos.tsx`
- Modify: `client/src/pages/notas/NotasFiscaisList.tsx`
- Modify: `client/src/pages/lancamento/LancamentoWizard.tsx`
- Modify: `client/src/pages/relatorios/RelatoriosPage.tsx`
- Modify: `client/src/pages/auditoria/AuditoriaPage.tsx`

- [x] **Step 1: Atualizar paleta dos gráficos Recharts no `Dashboard.tsx` para renderizar perfeitamente no escuro**
- [x] **Step 2: Adaptar tabelas e filtros em `PainelPagamentos.tsx`, `NotasFiscaisList.tsx` e `RelatoriosPage.tsx`**
- [x] **Step 3: Adaptar assistente de lançamento em 4 etapas no `LancamentoWizard.tsx`**
- [x] **Step 4: Adaptar visualizador de diff de auditoria no `AuditoriaPage.tsx`**
- [x] **Step 5: Adaptar painel da tela de `Login.tsx`**

---

### Task 5: Guia Completo de Integração de Banco de Dados e Criação de Logins

**Files:**
- Create: `docs/GUIA_BANCO_E_LOGINS.md`
- Modify: `README.md`

- [x] **Step 1: Escrever o guia passo a passo em tópicos didáticos e detalhados para Supabase e Render**
- [x] **Step 2: Atualizar `README.md` com referências ao modo escuro e ao guia de integração**

---

### Task 6: Validação, Testes e Publicação

- [x] **Step 1: Executar `npm run build` e validar compilação sem erros**
- [x] **Step 2: Executar `npm run test --workspace server` para garantir regressão zero**
- [x] **Step 3: Commit e push para o repositório GitHub**
