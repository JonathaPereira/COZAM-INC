# Plano de Implementação — Municípios, Login, Perfil, Responsividade, Vercel e Exclusão Administrativa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o suporte a Municípios (cadastro e filtros de pendências em Pagamentos), "Lembre de mim" no login, alteração de senha de usuários (Meu Perfil), responsividade avançada dos dashboards, configuração para hospedagem do frontend na Vercel e exclusão auditada de Ordens e Notas pelo Administrador, garantindo preservação de 100% dos dados já existentes.

**Architecture:** 
1. **Banco de Dados Incremental:** Migração aditiva `20261110000004_add_municipality.sql` com `ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS municipality text;` e ajuste da trigger `tg_prevent_delete` para permitir deleção administrativa auditada quando `total_paid = 0`.
2. **Frontend Interativo:** Componente de seleção com autocomplete dos 4 municípios consorciados oficiais (*Santana do Mundaú, Branquinha, União dos Palmares, Carneiros*) + inserção dinâmica de novos municípios, filtros reativos em Pagamentos, persistência em `localStorage` para login, modal de perfil com Supabase Auth e confirmação de exclusão com justificativa.
3. **Deploy Híbrido:** `vercel.json` configurado na raiz para servir a SPA React no Edge da América do Sul com proxy reverso transparente de chamadas `/api/*` para o backend Node.js no Render.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Express, PostgreSQL / Supabase, Vercel CLI / Config, Recharts, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-11-10-municipios-login-responsividade-vercel-design.md`

## Global Constraints
- **Preservação de Dados:** Nenhuma migração ou comando SQL pode apagar tabelas ou sobrescrever dados já gravados em produção.
- **Suporte Bitemático:** Todos os novos componentes de interface devem suportar integralmente o Modo Claro e o Modo Escuro.
- **Segurança Financeira:** Notas com pagamentos válidos nunca podem ser excluídas (exige estorno/cancelamento formal prévio).

---

### Task 1: Migração Aditiva e Suporte a Municípios no Backend e Banco de Dados

**Files:**
- Create: `supabase/migrations/20261110000004_add_municipality.sql`
- Modify: `shared/src/types.ts`
- Modify: `server/src/routes/invoices.ts`
- Modify: `server/test/scenarios.test.ts`

**Interfaces:**
- Consumes: `Invoice` type de `@cozam/shared`
- Produces: `municipality?: string` persistido em `public.invoices` e retornado na view `v_invoices`

- [ ] **Step 1: Criar migração SQL `20261110000004_add_municipality.sql`**
  Adicionar a coluna `municipality text` em `public.invoices`, índice em `upper(trim(municipality))` e atualizar a view `v_invoices` com `i.municipality`.
- [ ] **Step 2: Atualizar tipos em `shared/src/types.ts`**
  Adicionar `municipality?: string;` nas interfaces `Invoice`, `CreateInvoiceInput` e `UpdateInvoiceInput`.
- [ ] **Step 3: Atualizar controller e queries em `server/src/routes/invoices.ts`**
  Garantir que o campo `municipality` seja gravado no `INSERT` e retornado no `SELECT` e listagens de NFs.
- [ ] **Step 4: Adicionar teste unitário de município em `server/test/scenarios.test.ts`**
  Verificar que uma nota cadastrada com `municipality: 'Santana do Mundaú'` é recuperada corretamente.
- [ ] **Step 5: Executar testes do servidor e validar aprovação**
  Run: `npm run test --workspace server`
- [ ] **Step 6: Commit**
  `git add supabase/migrations/ shared/src/ server/src/ server/test/`
  `git commit -m "feat(backend): add municipality support in database and API"`

---

### Task 2: Frontend — Municípios no Cadastro de Notas e Filtro no Painel de Pagamentos

**Files:**
- Create: `client/src/components/ui/MunicipalitySelect.tsx`
- Modify: `client/src/pages/lancamento/LancamentoWizard.tsx`
- Modify: `client/src/pages/pagamentos/PainelPagamentos.tsx`
- Modify: `client/src/pages/notas/NotasFiscaisList.tsx`
- Modify: `client/src/pages/notas/NotaFiscalDetail.tsx`

**Interfaces:**
- Consumes: Lista de municípios pré-carregados `['Santana do Mundaú', 'Branquinha', 'União dos Palmares', 'Carneiros']`
- Produces: Filtro ativo `selectedMunicipality` no painel de pagamentos e badge do município em cada linha da tabela.

- [ ] **Step 1: Criar componente reutilizável `MunicipalitySelect.tsx`**
  Componente com lista suspensa dos 4 municípios oficiais, busca/autocomplete e botão `+ Outro Município` com input para digitar novo município consorciado.
- [ ] **Step 2: Integrar `MunicipalitySelect` na Etapa 3 do `LancamentoWizard.tsx`**
  Vincular o estado `municipality` ao formulário de cadastro da Nota Fiscal.
- [ ] **Step 3: Adicionar filtro por município e badge no `PainelPagamentos.tsx`**
  Adicionar seletor de filtro de município ao lado do filtro de fornecedor, badge azul de município na tabela e recálculo dos cards de pendências por cidade.
- [ ] **Step 4: Exibir município nas telas `NotasFiscaisList.tsx` e `NotaFiscalDetail.tsx`**
  Mostrar coluna e badge de município nos detalhes da nota fiscal.
- [ ] **Step 5: Compilar e validar frontend**
  Run: `npm run build --workspace client`
- [ ] **Step 6: Commit**
  `git add client/src/`
  `git commit -m "feat(client): integrate municipality selection and filtering"`

---

### Task 3: Tela de Login — Recurso "Lembre de mim"

**Files:**
- Modify: `client/src/pages/auth/Login.tsx`

- [ ] **Step 1: Adicionar checkbox "Lembrar meu acesso neste dispositivo" no formulário**
  Estilizar checkbox compatível com Modo Claro e Escuro.
- [ ] **Step 2: Implementar lógica de persistência no `localStorage`**
  Salvar `cozam_remember_me` e `cozam_saved_email` ao submeter login bem-sucedido.
- [ ] **Step 3: Pré-carregar o e-mail no mount do componente**
  Se a flag estiver ativa, preencher automaticamente o campo de e-mail e direcionar o cursor para o campo de senha.
- [ ] **Step 4: Commit**
  `git add client/src/pages/auth/Login.tsx`
  `git commit -m "feat(auth): add remember me functionality on login"`

---

### Task 4: Módulo "Meu Perfil" e Alteração de Senha do Usuário

**Files:**
- Create: `client/src/components/profile/ProfileModal.tsx`
- Modify: `client/src/components/layout/Header.tsx`

- [ ] **Step 1: Criar modal `ProfileModal.tsx`**
  Exibir dados do usuário autenticado (Nome, E-mail, Setor) e formulário com "Nova Senha" e "Confirmar Nova Senha" (com validação de mínimo 6 dígitos).
- [ ] **Step 2: Conectar com Supabase Auth**
  Chamar `supabase.auth.updateUser({ password })` com feedback visual via toast `sonner`.
- [ ] **Step 3: Adicionar botão "Meu Perfil" no menu de usuário no `Header.tsx`**
  Permitir abrir o modal com um clique no avatar/perfil no cabeçalho.
- [ ] **Step 4: Commit**
  `git add client/src/components/profile/ client/src/components/layout/Header.tsx`
  `git commit -m "feat(profile): add profile modal and password update"`

---

### Task 5: Exclusão Administrativa de Ordens e Notas com Justificativa e Auditoria

**Files:**
- Modify: `supabase/migrations/20261110000004_add_municipality.sql`
- Modify: `server/src/routes/invoices.ts`
- Modify: `server/src/routes/supply-orders.ts`
- Create: `client/src/components/ui/DeleteConfirmModal.tsx`
- Modify: `client/src/pages/notas/NotaFiscalDetail.tsx`
- Modify: `client/src/pages/notas/NotasFiscaisList.tsx`
- Modify: `client/src/pages/ordens/OrdensList.tsx`

- [ ] **Step 1: Atualizar regras de deleção no banco**
  Permitir `DELETE` nas tabelas `invoices` e `supply_orders` apenas quando `total_paid = 0` e o ator for `admin`.
- [ ] **Step 2: Implementar endpoints `DELETE /api/invoices/:id` e `DELETE /api/supply-orders/:id` no backend**
  Receber justificativa opcional no body, registrar log em `audit_logs` (`NF_EXCLUIDA` / `OF_EXCLUIDA`) e deletar documentos associados.
- [ ] **Step 3: Criar modal `DeleteConfirmModal.tsx` com campo de justificativa opcional**
  Alertar sobre a exclusão e fornecer campo de justificativa para registrar na auditoria visível para Pagamentos.
- [ ] **Step 4: Integrar botão de exclusão nas páginas de detalhe e listagem para `admin`**
  Exibir botão vermelho "Excluir" somente quando `user.role === 'admin'` e `total_paid === 0`.
- [ ] **Step 5: Testar exclusão no backend e frontend**
  Run: `npm run test --workspace server && npm run build`
- [ ] **Step 6: Commit**
  `git add server/src/ client/src/ supabase/`
  `git commit -m "feat(admin): enable audited deletion of supply orders and invoices"`

---

### Task 6: Visual e Responsividade de Dashboards e Tabelas

**Files:**
- Modify: `client/src/pages/dashboard/Dashboard.tsx`
- Modify: `client/src/pages/pagamentos/PainelPagamentos.tsx`
- Modify: `client/src/pages/notas/NotasFiscaisList.tsx`
- Modify: `client/src/components/layout/AppShell.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Otimizar grid do `Dashboard.tsx` para mobile e tablet**
  Garantir `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` para StatCards e `min-h-[300px]` para gráficos Recharts com eixos legíveis.
- [ ] **Step 2: Implementar containers com scroll horizontal suave nas tabelas analíticas**
  Adicionar `overflow-x-auto scrollbar-thin` para não quebrar a largura da tela em celulares.
- [ ] **Step 3: Otimizar navegação mobile na `Sidebar.tsx`**
  Garantir fechamento automático ao clicar em links no mobile e botão hambúrguer responsivo.
- [ ] **Step 4: Commit**
  `git add client/src/`
  `git commit -m "style(responsive): enhance mobile and tablet responsiveness across dashboard and tables"`

---

### Task 7: Configuração de Hospedagem na Vercel

**Files:**
- Create: `vercel.json`
- Modify: `package.json`
- Modify: `docs/GUIA_BANCO_E_LOGINS.md`

- [ ] **Step 1: Criar arquivo `vercel.json` na raiz**
  Configurar rewrites:
  - `/api/:match*` -> `https://cozam-sistema.onrender.com/api/:match*`
  - `/:match*` -> `/index.html` (SPA fallback)
  - Framework: `vite`
- [ ] **Step 2: Adicionar script no `package.json` para build da Vercel**
  Garantir que a Vercel execute `npm run build --workspace client` e aponte para `client/dist`.
- [ ] **Step 3: Documentar o passo a passo de deploy na Vercel**
  Adicionar seção dedicada no guia com os passos no dashboard da Vercel.
- [ ] **Step 4: Commit**
  `git add vercel.json package.json docs/`
  `git commit -m "feat(deploy): configure vercel deployment with api rewrites"`

---

### Task 8: Validação, Testes e Publicação

- [ ] **Step 1: Executar suíte completa de testes no backend**
  Run: `npm run test --workspace server`
- [ ] **Step 2: Executar build completo de produção no monorepo**
  Run: `npm run build`
- [ ] **Step 3: Push final para o GitHub na branch `main`**
  Run: `git push origin main`
