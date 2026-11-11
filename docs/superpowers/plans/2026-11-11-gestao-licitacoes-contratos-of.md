# Gestão Integrada de Licitações, Contratos e Ordens de Fornecimento — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o sistema completo de Gestão de Licitações, Contratos Administrativos, Controle de Saldo Contratual e Emissão de Ordens de Fornecimento para o COZAM-INC, preservando integralmente o módulo financeiro e a base de dados existente.

**Architecture:** Modelagem relacional estrita no PostgreSQL com motor de saldo transacional por movimentações contábeis auditáveis (reserva, baixa, estorno). Backend Express com endpoints REST, validações Zod e transações isoladas; frontend React/TypeScript com componentes modulares, seletor de itens com cálculo de saldos em tempo real e gerador de documentos PDF/XLSX no padrão oficial da COZAM.

**Tech Stack:** Node.js/TypeScript, Express, PostgreSQL / Supabase, PGlite (testes de banco em memória), React 18, Vite, Tailwind CSS, Lucide icons, Vitest, pdf-lib, xlsx.

**Spec:** `docs/superpowers/specs/2026-11-11-gestao-licitacoes-contratos-of-design.md`

## Global Constraints
- **Preservação de Dados:** Nenhuma tabela existente é excluída ou truncada. A migração é 100% aditiva (`IF NOT EXISTS`).
- **Preservação Financeira:** O módulo de pagamentos (NFs, FUMIP, Compra Compartilhada, retenção de IRRF 1,2%, Simples Nacional) permanece funcional e integrado.
- **Conceito de Saldo Contratual:** O sistema gerencia saldo contratual (`Quantidade contratada`, `Quantidade reservada`, `Quantidade solicitada`, `Saldo disponível`), nunca estoque físico ou almoxarifado.
- **Modelo Oficial da OF:** A Ordem de Fornecimento em PDF/XLSX deve reproduzir fielmente o layout oficial da COZAM baseado na planilha modelo.
- **Validação de Saldo no Servidor:** Todas as reservas e baixas são validadas atomicamente dentro de transações de banco de dados (`FOR UPDATE`), protegendo contra concorrência e saldo negativo.
- **Tema Claro e Escuro:** Toda a interface deve suportar Light Mode e Dark Mode sem quebra de contraste.

## Review Focus
1. **Tentativa de estourar saldo contratual:** Requisições concorrentes ou valores acima do saldo disponível devem ser bloqueadas no backend com código de erro amigável.
2. **Contrato vencido ou suspenso:** Não permitir que uma nova OF seja emitida para contratos fora da vigência.
3. **Idempotência de upload assinado:** Reenviar a mesma via digitalizada da OF não pode duplicar movimentações de baixa de saldo.
4. **Cancelamento com fornecimento parcial:** Apenas a quantidade não fornecida retorna ao saldo contratual disponível.
5. **Conferência humana obrigatória:** Contratos importados via PDF devem ser revisados pelo operador antes de serem persistidos e ativados.

---

### Task 1: Fundação do Banco de Dados & Modelagem Aditiva (Fase 1)

**Files:**
- Create: `supabase/migrations/20261111000002_contracts_procurement_and_supply_order_items.sql`
- Modify: `shared/src/types.ts`
- Modify: `shared/src/index.ts`
- Test: `server/test/scenarios.test.ts`

- [ ] **Step 1:** Escrever a migration SQL `20261111000002_contracts_procurement_and_supply_order_items.sql` criando as tabelas `destinations`, `procurement_processes`, `contracts`, `contract_amendments`, `contract_items`, `supply_order_items`, `contract_item_movements` e adicionando colunas em `supply_orders` (`contract_id`, `destination_id`, `tracking_code`, `delivery_deadline`, `signed_document_id`, `signed_at`, `signed_by`).
- [ ] **Step 2:** Criar as visões SQL `v_contracts` (com total_items, total_requested, balance_amount, status_vigencia), `v_contract_items` (com original_qty, reserved_qty, requested_qty, available_qty) e `v_supply_orders_expanded`.
- [ ] **Step 3:** Atualizar `shared/src/types.ts` adicionando interfaces TypeScript para `Destination`, `ProcurementProcess`, `ContractRow`, `ContractAmendment`, `ContractItemRow`, `SupplyOrderItemRow`, `ContractItemMovement` e enums associados.
- [ ] **Step 4:** Rodar testes do servidor para garantir que a migration se aplica sem conflitos com as tabelas e views existentes.
- [ ] **Step 5:** Commit: `feat(db-shared): add procurement, contracts, items and movement schema`.

---

### Task 2: Backend — Destinatários, Processos Licitatórios e Gestão de Contratos (Fase 1 & 2)

**Files:**
- Create: `server/src/routes/destinations.ts`
- Create: `server/src/routes/procurement-processes.ts`
- Create: `server/src/routes/contracts.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/scenarios.test.ts`

- [ ] **Step 1:** Implementar `server/src/routes/destinations.ts` com rotas para listar, criar e editar municípios/entidades destinatárias.
- [ ] **Step 2:** Implementar `server/src/routes/procurement-processes.ts` com rotas para listar, criar, editar e vincular documentos aos processos licitatórios.
- [ ] **Step 3:** Implementar `server/src/routes/contracts.ts` com rotas para:
  - Listagem com filtros de fornecedor, vigência e status.
  - Cadastro de contrato manual com itens iniciais dentro de transação.
  - Detalhe do contrato com itens, saldos consolidados e histórico de aditivos.
  - Registro de aditivos (`contract_amendments`) de prazo e de quantitativo/valor.
  - Cálculo de alertas de vencimento (90, 60, 30 e 15 dias).
- [ ] **Step 4:** Registrar os novos roteadores em `server/src/app.ts`.
- [ ] **Step 5:** Escrever testes de integração em `scenarios.test.ts` validando o cadastro do contrato com itens e conferência de saldo inicial (Cenário A do Prompt Mestre).
- [ ] **Step 6:** Commit: `feat(server): add routes for destinations, procurements and contracts`.

---

### Task 3: Backend — Motor Transacional de Saldo Contratual e Emissão de OFs (Fase 4 & 5)

**Files:**
- Create: `server/src/services/contract-balance.ts`
- Modify: `server/src/routes/supply-orders.ts`
- Test: `server/test/scenarios.test.ts`

- [ ] **Step 1:** Criar `server/src/services/contract-balance.ts` contendo funções transacionais:
  - `reserveItems(client, contractId, items, orderId, actorId)` com `SELECT ... FOR UPDATE` nos itens e inserção de movimentações `RESERVA`.
  - `confirmItems(client, orderId, actorId)` convertendo `RESERVA` em `BAIXA`.
  - `releaseReservedItems(client, orderId, reason, actorId)` registrando `LIBERACAO`.
  - `revertItems(client, orderId, returnItems, reason, actorId)` registrando `ESTORNO`.
  - Validações de vigência do contrato e saldo contratual disponível.
- [ ] **Step 2:** Atualizar `server/src/routes/supply-orders.ts` para suportar a criação de OF com seleção de itens do contrato:
  - Geração de numeração sequencial anual (`OF 001/2026`).
  - Geração de tracking code / UUID único para a ordem.
  - Gravação dos itens em `supply_order_items` e chamada a `reserveItems`.
- [ ] **Step 3:** Implementar cancelamento seguro de OF em `server/src/routes/supply-orders.ts`:
  - Se status `AGUARDANDO_ASSINATURA`, executa `releaseReservedItems`.
  - Se status `CONFIRMADA`, executa `revertItems` com os itens e quantidades estornadas.
- [ ] **Step 4:** Escrever testes cobrindo Cenário B (Emissão de OF e reserva), Cenário G (Tentativa acima do saldo bloqueada), Cenário D (Cancelamento antes da assinatura e liberação de reserva), Cenário E (Cancelamento pós-assinatura com estorno) e Cenário F (Fornecimento parcial).
- [ ] **Step 5:** Commit: `feat(server): transactional contract balance engine and supply order creation`.

---

### Task 4: Motor de Geração de Documentos da OF no Padrão Oficial COZAM (Fase 5)

**Files:**
- Create: `server/src/services/supply-order-document.ts`
- Modify: `server/src/routes/supply-orders.ts`
- Test: `server/test/scenarios.test.ts`

- [ ] **Step 1:** Criar `server/src/services/supply-order-document.ts` para gerar PDF e XLSX idêntico ao modelo oficial da COZAM:
  - Cabeçalho institucional com CNPJ do Consórcio COZAM.
  - Título `ORDEM DE FORNECIMENTO — TERMO DE CONTRATO - [LICITAÇÃO]`.
  - Objeto, Fundamentação Legal, Órgão Gerenciador e Fornecedor completo.
  - Datas de celebração e validade formatadas por extenso.
  - Texto de autorização de fornecimento e Município destinatário.
  - Tabela com `ITEM | DESCRIÇÃO | UND | QUANT | VALOR UNITÁRIO | VALOR TOTAL`.
  - Total geral formatado em R$.
  - Local, data por extenso, prazo de entrega e blocos de assinatura do Supervisor de Compras e do Fornecedor.
  - Inclusão do tracking code legível e QR Code para escaneamento.
- [ ] **Step 2:** Adicionar endpoints em `server/src/routes/supply-orders.ts`:
  - `GET /api/supply-orders/:id/pdf` para download do documento formatado.
  - `GET /api/supply-orders/:id/xlsx` para download da planilha modelo gerada.
- [ ] **Step 3:** Escrever teste verificando a geração do PDF da OF com retorno 200 e tipo `application/pdf`.
- [ ] **Step 4:** Commit: `feat(document): high-fidelity supply order PDF and Excel generator`.

---

### Task 5: Backend — Ciclo de Assinatura, Digitalização e Reconciliação Idempotente (Fase 6)

**Files:**
- Modify: `server/src/routes/supply-orders.ts`
- Test: `server/test/scenarios.test.ts`

- [ ] **Step 1:** Implementar endpoint `POST /api/supply-orders/:id/upload-signed`:
  - Recebe o arquivo PDF da OF assinada via upload multipart.
  - Salva o arquivo na tabela `documents` com categoria `OF_ASSINADA`.
  - Atualiza a OF para `CONFIRMADA` / `ASSINADA` e grava `signed_at` e `signed_by`.
  - Invoca `confirmItems` para efetivar a baixa do saldo.
  - Garante idempotência: se a OF já estiver confirmada, retorna os dados atuais sem duplicar movimentações de baixa.
- [ ] **Step 2:** Escrever testes cobrindo Cenário C (Confirmação de assinatura e baixa efetiva) e Cenário K (Idempotência no reenvio de documento assinado).
- [ ] **Step 3:** Commit: `feat(server): signed supply order upload and idempotent balance confirmation`.

---

### Task 6: Backend — Importação de Contratos em PDF com Conferência Humana (Fase 3)

**Files:**
- Create: `server/src/services/contract-parser.ts`
- Modify: `server/src/routes/contracts.ts`
- Test: `server/test/scenarios.test.ts`

- [ ] **Step 1:** Criar `server/src/services/contract-parser.ts` com capacidade de extrair texto de PDF estruturado, identificar padrões de cabeçalho (processo, fornecedor, CNPJ, vigência, valor) e linhas tabulares de itens (`código, descrição, unidade, quantidade, valor unitário, valor total`).
- [ ] **Step 2:** Criar endpoint `POST /api/contracts/parse-pdf` que extrai os dados sem gravá-los no banco e retorna um payload estruturado com grau de confiança e alertas de divergência (`qtd * unitario != total`).
- [ ] **Step 3:** Adicionar validação de integridade matemática no backend antes da persistência definitiva.
- [ ] **Step 4:** Escrever teste cobrindo Cenário J (Leitura de contrato e validação de conferência).
- [ ] **Step 5:** Commit: `feat(contracts): PDF contract parsing service with human review stage`.

---

### Task 7: Frontend — Módulos de Destinatários, Licitações e Gestão de Contratos (Fase 1 & 2)

**Files:**
- Create: `client/src/pages/destinatarios/DestinatariosPage.tsx`
- Create: `client/src/pages/licitacoes/LicitacoesPage.tsx`
- Create: `client/src/pages/contratos/ContratosListPage.tsx`
- Create: `client/src/pages/contratos/ContratoDetailPage.tsx`
- Create: `client/src/pages/contratos/NovoContratoModal.tsx`
- Create: `client/src/pages/contratos/ImportarContratoModal.tsx`
- Create: `client/src/pages/contratos/AditivosModal.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1:** Reorganizar a barra de navegação lateral (`Sidebar.tsx`) agrupando os módulos em:
  - **Visão Geral** (Dashboard)
  - **Compras & Contratos** (Licitações, Contratos, Ordens de Fornecimento)
  - **Cadastros** (Fornecedores, Municípios Destinatários)
  - **Financeiro** (Notas Fiscais, Pagamentos - preservado intacto)
  - **Relatórios & Auditoria**
- [ ] **Step 2:** Criar tela de Destinatários (`DestinatariosPage.tsx`) com lista de municípios consorciados e formulário de cadastro/edição.
- [ ] **Step 3:** Criar tela de Processos Licitatórios (`LicitacoesPage.tsx`) com dados do processo e contratos vinculados.
- [ ] **Step 4:** Criar listagem de contratos (`ContratosListPage.tsx`) com badges visuais de vigência (Ativo, Próximo do Vencimento, Vencido).
- [ ] **Step 5:** Criar detalhe do contrato (`ContratoDetailPage.tsx`) exibindo resumo executivo, tabela de itens com quantidades e valores (contratado, reservado, solicitado, disponível), histórico de aditivos e documentos vinculados.
- [ ] **Step 6:** Criar modal de conferência de importação de PDF (`ImportarContratoModal.tsx`) destacando valores e permitindo edição humana antes de salvar.
- [ ] **Step 7:** Verificar build do client (`npm.cmd run build --workspace client`).
- [ ] **Step 8:** Commit: `feat(client): UI for destinations, procurements, contracts and PDF review`.

---

### Task 8: Frontend — Assistente de Emissão de OF e Ciclo de Assinatura (Fase 5 & 6)

**Files:**
- Create: `client/src/pages/ordens/NovaOrdemWizard.tsx`
- Modify: `client/src/pages/ordens/OrdensList.tsx`
- Create: `client/src/pages/ordens/OrdemDetailModal.tsx`
- Create: `client/src/pages/ordens/UploadSignedOfModal.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1:** Criar `NovaOrdemWizard.tsx` com fluxo em etapas:
  - Etapa 1: Seleção de Fornecedor e Contrato ativo.
  - Etapa 2: Seleção do Município Destinatário (ex: Santana do Mundaú).
  - Etapa 3: Seleção e quantidade dos itens com feedback imediato do saldo disponível e cálculo de valores em tempo real.
  - Etapa 4: Pré-visualização do modelo oficial e emissão da ordem.
- [ ] **Step 2:** Atualizar `OrdensList.tsx` com filtros de fornecedor, contrato, município e status (`RASCUNHO`, `AGUARDANDO_ASSINATURA`, `CONFIRMADA`, `CANCELADA`).
- [ ] **Step 3:** Criar modal de detalhes da OF com botões para baixar PDF formatado, baixar XLSX e modal de upload do documento digitalizado assinado (`UploadSignedOfModal.tsx`).
- [ ] **Step 4:** Criar modal de cancelamento de OF com motivo e tratamento de liberação de reserva ou estorno de itens.
- [ ] **Step 5:** Verificar build do client (`npm.cmd run build --workspace client`).
- [ ] **Step 6:** Commit: `feat(client): supply order creation wizard, official view and signature upload`.

---

### Task 9: Frontend — Dashboard Executivo & Relatórios Analíticos (Fase 8)

**Files:**
- Modify: `client/src/pages/Dashboard.tsx`
- Modify: `client/src/pages/relatorios/RelatoriosPage.tsx`
- Modify: `server/src/routes/reports.ts`

- [ ] **Step 1:** Atualizar `Dashboard.tsx` com indicadores executivos do setor de Compras:
  - Total de contratos ativos, a vencer e vencidos.
  - Ordens emitidas no mês e ordens aguardando assinatura.
  - Itens com saldo crítico/baixo.
  - Valores globais: Total Contratado, Total Solicitado em OFs e Saldo Contratual Restante.
- [ ] **Step 2:** Atualizar `server/src/routes/reports.ts` para disponibilizar relatórios de execução contratual e saldos por contrato/fornecedor/município.
- [ ] **Step 3:** Atualizar `RelatoriosPage.tsx` com abas para relatórios de Contratos, Saldos e Ordens de Fornecimento, com exportação em Excel e PDF.
- [ ] **Step 4:** Verificar build do client e testes do servidor.
- [ ] **Step 5:** Commit: `feat(dashboard-reports): executive procurement indicators and analytic reports`.

---

### Task 10: Suíte Completa de Testes, Verificação e Validação Final (Fase 9)

**Files:**
- Modify: `server/test/scenarios.test.ts`

- [ ] **Step 1:** Garantir que todos os 11 cenários obrigatórios do Prompt Mestre (Cenários A a K) estão formalmente implementados e passando em `scenarios.test.ts`.
- [ ] **Step 2:** Garantir que todos os cenários legados de Pagamentos e Compras (Cenários A a N da suíte existente) continuam passando intactos.
- [ ] **Step 3:** Executar verificação completa:
  - `npm.cmd run test --workspace server`
  - `npm.cmd run build` (client + server)
  - `npm.cmd run typecheck`
- [ ] **Step 4:** Commit: `test(full-suite): complete integration tests for contracts and supply orders`.
