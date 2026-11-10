# Plano de Correção e Continuidade do Sistema COZAM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a resolução das migrations no backend compilado, assegurar a criação e inicialização dos perfis de homologação (Compras e Pagamentos) tanto no banco quanto com fallback offline resiliente no cliente, permitindo navegação imediata pelas telas internas (Dashboard, Lançamentos, Ordens, Notas, Pagamentos e Relatórios).

**Architecture:** O servidor Express localiza as migrations via caminhos candidatos resilientes (`process.cwd()`, caminhos relativos ao módulo compilado e ao código-fonte), garantindo a execução do schema e seed dos dados obrigatórios. No cliente, o `AuthContext` incorpora um fallback de modo de demonstração caso a API não esteja acessível, garantindo que o operador consiga testar a interface de forma transparente.

**Tech Stack:** Node.js, Express, PostgreSQL / PGlite, React 19, Vite, React Router, Vitest.

**Spec:** Termo de Referência COZAM e Cenários A-J.

## Global Constraints
- Nenhuma dependência externa deve quebrar o fluxo de testes ou a inicialização local.
- Perfis de Compras (`admin`) e Pagamentos (`pagamentos`) devem possuir permissões corretas mapeadas em `@cozam/shared`.
- Imutabilidade e integridade das regras financeiras preservadas.

---

### Task 1: Correção do Path das Migrations e Seed dos Perfis de Homologação no Backend

**Files:**
- Modify: `server/src/db/migrate.ts`
- Modify: `server/src/config.ts`
- Test: `server/test/scenarios.test.ts`

- [ ] **Step 1: Ajustar resolução de `migrationsDir` em `server/src/db/migrate.ts`**
  Implementar lista de caminhos candidatos (`path.resolve(process.cwd(), 'supabase/migrations')`, `path.resolve(__dirname, '../../supabase/migrations')`, `path.resolve(__dirname, '../../../supabase/migrations')`) e verificar existência com `fs.stat`.

- [ ] **Step 2: Inserir seed dos perfis de teste de homologação no `migrate.ts`**
  Garantir a inserção idempotente dos usuários `00000000-0000-0000-0000-000000000001` (Admin Compras) e `00000000-0000-0000-0000-000000000002` (Operador Pagamentos) na tabela `public.profiles`.

- [ ] **Step 3: Recompilar o backend**
  Executar `npm run build --workspace server`.

- [ ] **Step 4: Executar testes de regressão**
  Executar `npm run test --workspace server` e garantir que todos os 10 cenários permaneçam com 100% de aprovação.

---

### Task 2: Resiliência no `AuthContext` do Frontend

**Files:**
- Modify: `client/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Implementar fallback gracioso em `loginDev` no `AuthContext`**
  Se a chamada a `/api/me` falhar durante o acesso rápido, instanciar localmente o perfil correspondente com as permissões completas de cada setor (`admin` para Compras, `pagamentos` para Pagamentos) e permitir o redirecionamento imediato para `/` ou `/pagamentos`.

- [ ] **Step 2: Recompilar o frontend**
  Executar `npm run build --workspace client`.

---

### Task 3: Verificação e Validação Ponta a Ponta

- [ ] **Step 1: Testar resposta da API com mock token**
  Executar requisições de teste em `/api/health`, `/api/me` com `mock-admin` e `mock-pagamentos`.

- [ ] **Step 2: Validar integridade dos comandos de build e commit das alterações**
  Garantir `npm run build` executado com código 0 e registrar commit no repositório.
