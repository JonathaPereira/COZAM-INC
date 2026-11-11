# Plano de Implementação — Municípios em OF/NF/Relatórios, Retenção Tributária (IRRF 1,2%) e Simples Nacional

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o suporte completo a Municípios nas Ordens de Fornecimento (OFs), exibição universal em todas as tabelas do sistema e exportação para Excel; e incorporar o mecanismo de retenção tributária de 1,2% (IRRF) nas liquidações de notas fiscais, permitindo pagamentos com e sem retenção (com suporte a Simples Nacional no cadastro de fornecedores) em pagamentos integrais e parciais.

**Architecture:**
1. **Banco de Dados Incremental:** Migração aditiva `20261111000001_municipality_of_and_tax_withholding.sql` com colunas em `supply_orders` (`municipality`), `suppliers` (`is_simples_nacional`), e `payments` (`gross_amount`, `tax_rate`, `tax_amount`, `net_amount`, `is_tax_exempt`). Atualização das views `v_supply_orders`, `v_invoices` e `v_payments`.
2. **Contratos Compartilhados (`@cozam/shared`):** Atualização dos tipos e criação do helper `calculatePaymentTaxes(amount, isTaxExempt, taxRate)`.
3. **Backend API:** Ajustes nas rotas `/supply-orders`, `/suppliers`, `/invoices/:id/payments` e `/reports` para suportar município, flag do simples e cálculo/persistência dos tributos retidos.
4. **Frontend UI:** Inclusão de `MunicipalitySelect` na OF, coluna de município em todas as tabelas (Processos, OFs, NFs, Pagamentos), exportação em Excel com a nova coluna, flag de Simples Nacional no fornecedor e cálculo automático com cards visuais no modal de liquidação.

**Spec:** `docs/superpowers/specs/2026-11-11-municipios-tributos-simples-nacional-design.md`

---

### Task 1: Migração Aditiva no Banco de Dados e Atualização de Views

**Files:**
- Create: `supabase/migrations/20261111000001_municipality_of_and_tax_withholding.sql`
- Modify: `shared/src/types.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Criar migração SQL `20261111000001_municipality_of_and_tax_withholding.sql`**
  - `ALTER TABLE public.supply_orders ADD COLUMN IF NOT EXISTS municipality text;`
  - `ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_simples_nacional boolean NOT NULL DEFAULT false;`
  - `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2), ADD COLUMN IF NOT EXISTS tax_rate numeric(5,4) DEFAULT 0.0120, ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2) DEFAULT 0.00, ADD COLUMN IF NOT EXISTS net_amount numeric(14,2), ADD COLUMN IF NOT EXISTS is_tax_exempt boolean DEFAULT false;`
  - Preencher retroativamente `gross_amount = amount`, `net_amount = amount` nos registros anteriores.
  - Recriar views `v_supply_orders`, `v_invoices` e `v_payments` expondo esses campos.
- [ ] **Step 2: Atualizar tipos em `shared/src/types.ts`**
  - Atualizar `SupplyOrderRow`, `Supplier`, `PaymentRow`, `CreatePaymentInput`.
- [ ] **Step 3: Criar helper de cálculo tributário em `shared/src/index.ts`**
  - Implementar e exportar função `calculatePaymentTaxes(grossAmount, isTaxExempt, taxRate = 0.012)`.
- [ ] **Step 4: Commit**
  - `git add supabase/ shared/`
  - `git commit -m "feat(db-shared): add municipality to supply orders and tax withholding to payments and suppliers"`

---

### Task 2: Backend — Rotas de OF, Fornecedores, Pagamentos e Relatórios

**Files:**
- Modify: `server/src/routes/supply-orders.ts`
- Modify: `server/src/routes/suppliers.ts`
- Modify: `server/src/routes/payments.ts`
- Modify: `server/src/routes/reports.ts`
- Modify: `server/test/scenarios.test.ts`

- [ ] **Step 1: Atualizar `server/src/routes/supply-orders.ts`**
  - Permitir gravação e leitura de `municipality` na criação e atualização de OF.
- [ ] **Step 2: Atualizar `server/src/routes/suppliers.ts`**
  - Permitir gravação e leitura de `is_simples_nacional` no cadastro e listagem de fornecedores.
- [ ] **Step 3: Atualizar `server/src/routes/payments.ts`**
  - No `INSERT` de pagamento, calcular ou receber `is_tax_exempt` e persistir `gross_amount`, `tax_rate`, `tax_amount`, `net_amount`, `is_tax_exempt`.
- [ ] **Step 4: Atualizar `server/src/routes/reports.ts`**
  - Adicionar coluna de `municipality` nos relatórios de faturamento e coluna de `tax_amount` / `net_amount` nos relatórios de pagamentos.
- [ ] **Step 5: Executar testes automatizados do servidor**
  - Run: `npm run test --workspace server`
- [ ] **Step 6: Commit**
  - `git add server/`
  - `git commit -m "feat(server): support municipality on supply orders and tax withholding in payments"`

---

### Task 3: Frontend — Município nas Ordens de Fornecimento e Visibilidade Universal

**Files:**
- Modify: `client/src/pages/lancamento/LancamentoWizard.tsx`
- Modify: `client/src/pages/ordens/OrdensFornecimentoList.tsx`
- Modify: `client/src/pages/ordens/OrdemFornecimentoDetail.tsx`
- Modify: `client/src/pages/processos/ProcessosList.tsx`
- Modify: `client/src/pages/processos/ProcessoDetail.tsx`
- Modify: `client/src/pages/notas/NotasFiscaisList.tsx`
- Modify: `client/src/pages/pagamentos/PainelPagamentos.tsx`

- [ ] **Step 1: Integrar `MunicipalitySelect` na criação da OF em `LancamentoWizard.tsx`**
- [ ] **Step 2: Adicionar coluna e badge de Município em `OrdensFornecimentoList.tsx` e `OrdemFornecimentoDetail.tsx`**
- [ ] **Step 3: Adicionar exibição de Municípios associados em `ProcessosList.tsx` e `ProcessoDetail.tsx`**
- [ ] **Step 4: Garantir coluna de Município clara em `NotasFiscaisList.tsx` e na fila/histórico de `PainelPagamentos.tsx`**
- [ ] **Step 5: Commit**
  - `git add client/src/`
  - `git commit -m "feat(client): display municipality across all orders, processes and tables"`

---

### Task 4: Frontend — Exportação em Excel com Municípios e Impostos

**Files:**
- Modify: `client/src/lib/export/excel.ts`
- Modify: `client/src/pages/relatorios/RelatoriosPage.tsx`

- [ ] **Step 1: Atualizar geração de planilhas em `excel.ts`**
  - Garantir que a coluna de município e colunas de imposto retido / valor líquido sejam formatadas com largura e tipo monetário corretos.
- [ ] **Step 2: Commit**
  - `git add client/src/`
  - `git commit -m "feat(export): include municipality and tax withholding in excel exports"`

---

### Task 5: Frontend — Fornecedores (Simples Nacional) e Modal de Pagamento com Retenção de 1,2%

**Files:**
- Modify: `client/src/pages/fornecedores/FornecedoresList.tsx`
- Modify: `client/src/pages/notas/NotaFiscalDetail.tsx`
- Modify: `client/src/pages/pagamentos/PainelPagamentos.tsx`

- [ ] **Step 1: Adicionar checkbox "Optante pelo Simples Nacional" no cadastro/edição de Fornecedor**
- [ ] **Step 2: Atualizar Modal de Pagamento em `NotaFiscalDetail.tsx`**
  - Adicionar checkbox "Pagamento sem imposto (Simples Nacional / Isento)" com valor inicial herdado do fornecedor (`supplier.is_simples_nacional`).
  - Adicionar cards visuais em tempo real no modal:
    - Valor Bruto / Abatimento da NF: R$ X
    - Alíquota: 1,2% (ou 0% se isento)
    - Imposto Retido (IRRF): R$ Y
    - Valor Líquido a Pagar ao Fornecedor: R$ Z
  - Tratamento idêntico tanto para pagamentos integrais quanto parcelados.
- [ ] **Step 3: Atualizar tabela de histórico de pagamentos e recibos para detalhar o valor bruto, retenção e líquido**
- [ ] **Step 4: Validar build e testes do monorepo**
  - Run: `npm run build`
  - Run: `npm run typecheck`
- [ ] **Step 5: Commit**
  - `git add client/src/`
  - `git commit -m "feat(client): implement tax withholding breakdown and simples nacional flag in payments"`
