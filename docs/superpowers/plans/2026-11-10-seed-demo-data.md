# Plano de Implementação — Carga de Dados Fictícios de Demonstração (COZAM)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um gerador e script automatizado de dados fictícios para teste e homologação do COZAM, cobrindo todo o ciclo operacional de Compras (Processos, OFs, NFs FUMIP e Compra Compartilhada, comentários) e Pagamentos (Aguardando, Parcialmente Paga, Totalmente Paga, Pendência Histórica), permitindo testar em tela gráficos, tabelas e filtros avançados.

**Architecture:** Script standalone executável via CLI (`npm run seed`) e endpoint de desenvolvimento (`POST /api/dev/seed`) que limpa dados transacionais de teste e insere um cenário realista de fornecimento para os dois fornecedores (*MZ Bernardi* e *Nacional*), mantendo a estrita integridade referencial, triggers de saldo e isolamento de notas não verificadas.

**Tech Stack:** TypeScript, Node.js, PostgreSQL / PGlite, `@cozam/shared`.

**Spec:** Requisitos do consórcio COZAM para filtros por fornecedor, modalidades FUMIP e Compra Compartilhada, comentários parciais e cálculo de saldos.

## Cenários de Dados Fictícios a Serem Criados:
1. **Processo 001/2026 — Aquisição de Medicamentos e Insumos Hospitalares (Hospital Regional)**:
   - OF 2026/001 vinculada a MZ Bernardi (R$ 250.000,00) com PDF anexado.
   - NF 10450: R$ 120.000,00 | Modalidade FUMIP | Encaminhada | Status: `PARCIALMENTE_PAGA` (1 pagamento de R$ 70.000,00; saldo devedor R$ 50.000,00).
   - NF 10451: R$ 80.000,00 | Modalidade COMPRA COMPARTILHADA | Encaminhada | Status: `TOTALMENTE_PAGA` (2 pagamentos totalizando R$ 80.000,00; saldo zero).
   - NF 10452: R$ 50.000,00 | Modalidade FUMIP | Encaminhada | Status: `AGUARDANDO_PAGAMENTO` (Saldo R$ 50.000,00) com comentário: *"Entrega da 1ª remessa. Faltam insumos da 2ª remessa prevista para próxima semana."*
2. **Processo 002/2026 — Fornecimento de Material Gráfico e Expediente Administrativo**:
   - OF 2026/002 vinculada a Nacional (R$ 48.000,00) com PDF anexado.
   - NF 30120: R$ 32.500,00 | Modalidade COMPRA COMPARTILHADA | Encaminhada | Status: `PARCIALMENTE_PAGA` (1 pagamento de R$ 15.000,00; saldo devedor R$ 17.500,00).
   - NF 30121: R$ 15.500,00 | Modalidade FUMIP | Status: `RASCUNHO` (Em análise em Compras, não encaminhada ainda).
3. **Processo 003/2026 — Aquisição de Equipamentos de Proteção Individual (EPIs)**:
   - Processo com múltiplas OFs:
     - OF 2026/003 (MZ Bernardi, R$ 75.000,00) -> NF 10488 (R$ 75.000,00, FUMIP, Aguardando).
     - OF 2026/004 (Nacional, R$ 22.000,00) -> NF 30190 (R$ 22.000,00, Compra Compartilhada, Totalmente Paga).
4. **Nota Histórica com Pendência (Cenário G)**:
   - NF 9015: MZ Bernardi | R$ 38.000,00 | Modalidade FUMIP | `NAO_VERIFICADA` | Sem OF anexada | Não conta nos totais confirmados do consórcio, visível na fila de *Pendências Históricas*.

---

### Task 1: Desenvolver o Script de Seed de Demonstração

**Files:**
- Create: `server/src/scripts/seed-demo.ts`
- Modify: `server/package.json`

- [x] **Step 1: Implementar `seed-demo.ts`**
  Script com execução transacional idempotente, geração de PDFs sintéticos mínimos de teste (`%PDF-1.4...`), criação de processos, OFs, NFs e pagamentos detalhados acima.

- [x] **Step 2: Adicionar comando `"seed"` no `server/package.json` e incluir no esbuild**
  Configurar script para execução direta via `npm run seed`.

---

### Task 2: Endpoint de Desenvolvimento para Carga em Tempo de Execução

**Files:**
- Modify: `server/src/routes/config.ts`

- [x] **Step 1: Adicionar rota `POST /api/dev/seed` protegida para ambientes de homologação/desenvolvimento**
  Permite recarregar os dados de demonstração a qualquer momento via requisição HTTP.

---

### Task 3: Verificação e Execução

- [x] **Step 1: Executar o script de seed no banco local**
  Executar `npm run seed --workspace server` e verificar registros criados.

- [x] **Step 2: Executar a suíte de testes de regressão**
  Executar `npm run test --workspace server` para garantir 100% de conformidade com todos os cenários.

- [x] **Step 3: Compilar e publicar no GitHub**
  Executar `npm run build` e dar push na branch `main`.
