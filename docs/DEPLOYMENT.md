# Guia de Implantação — COZAM no Render com Supabase

Este guia orienta passo a passo como colocar o **Sistema Integrado de Compras e Pagamentos do COZAM** em produção no **Render**, conectado ao **Supabase**.

---

## 1. Passo a Passo no Supabase

### 1.1 Criar o Projeto
1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto (ex: `cozam-prod`).
2. Defina uma senha forte para o banco de dados PostgreSQL e anote-a.
3. Escolha a região mais próxima (ex: `sa-east-1` São Paulo).

### 1.2 Obter as Credenciais
No painel do Supabase, colete as seguintes informações:

1. **Project Settings > API**:
   - `Project URL` → **`SUPABASE_URL`** (ex: `https://xyz.supabase.co`)
   - `anon / public key` → **`SUPABASE_ANON_KEY`**
   - `service_role key` (secreta) → **`SUPABASE_SERVICE_ROLE_KEY`**

2. **Project Settings > Database > Connection String > URI**:
   - Copie a URI de conexão (modo **Transaction Pooler**, porta 6543, ou Session, porta 5432).
   - Substitua `[YOUR-PASSWORD]` pela senha do banco que você definiu.
   - Esta é a variável **`DATABASE_URL`**.

### 1.3 Migrações do Banco de Dados
A aplicação aplica as migrações automaticamente ao iniciar (`npm run start`). Caso prefira aplicar manualmente pelo painel do Supabase, execute os 3 arquivos SQL contidos na pasta `supabase/migrations/` no **SQL Editor** do Supabase, na seguinte ordem:
1. `20261110000001_schema.sql` (tabelas, tipos e restrições)
2. `20261110000002_business_rules.sql` (regras financeiras, triggers de saldo e auditoria)
3. `20261110000003_security_views_storage.sql` (políticas RLS, visões e fornecedores ativos)

---

## 2. Passo a Passo no Render

### Método A — Automático via Blueprint (Recomendado)
O repositório já inclui o arquivo [`render.yaml`](../render.yaml).

1. Acesse [dashboard.render.com](https://dashboard.render.com).
2. Clique em **New + > Blueprint**.
3. Conecte o repositório GitHub `JonathaPereira/COZAM-INC`.
4. O Render detectará o serviço `cozam-compras-pagamentos` e solicitará as 4 variáveis:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
5. Cole os valores obtidos no Supabase e clique em **Apply**.
6. O Render compilará a aplicação e disponibilizará a URL pública (ex: `https://cozam-compras-pagamentos.onrender.com`).

---

### Método B — Manual (Novo Web Service)
1. No painel do Render, clique em **New + > Web Service**.
2. Conecte o repositório `JonathaPereira/COZAM-INC`.
3. Preencha as configurações:
   - **Name:** `cozam-compras-pagamentos`
   - **Environment:** `Node`
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Health Check Path:** `/api/health`
4. Em **Environment Variables**, adicione:
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
   - `SUPABASE_URL` = sua URL do Supabase
   - `SUPABASE_ANON_KEY` = sua anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = sua service_role key
   - `DATABASE_URL` = sua string de conexão do PostgreSQL
5. Clique em **Create Web Service**.

---

## 3. Criar o Usuário Administrador Inicial (Compras)

Após a implantação, você pode criar o primeiro usuário administrador de duas formas:

### Opção 1: Via Linha de Comando (Render Shell ou Local com .env)
No console do Render (aba **Shell**) ou na sua máquina:
```bash
npm run create-admin -- --email compras@cozam.al.gov.br --name "Administrador Compras" --password "SuaSenhaSegura@2026"
```

### Opção 2: Pelo Painel do Supabase Auth
1. No painel do Supabase, vá em **Authentication > Users > Add user > Create user**.
2. Digite o e-mail: `compras@cozam.al.gov.br`.
3. Digite a senha desejada.
4. Em **User Metadata**, insira:
   ```json
   {
     "full_name": "Administrador — Compras",
     "role": "admin"
   }
   ```
5. Marque como "Auto Confirm User". O trigger do banco criará automaticamente o perfil com papel de Administrador (`admin`).

---

## 4. Teste de Funcionamento em Produção

1. Acesse a URL do Render no navegador.
2. Efetue login com o e-mail e senha do Administrador cadastrado.
3. Teste o fluxo ponta a ponta:
   - Clique em **Novo Lançamento**.
   - Cadastre uma OF para **MZ Bernardi** com PDF.
   - Cadastre uma NF de R$ 15.000,00 com PDF e clique em **ENCAMINHAR PARA PAGAMENTOS**.
   - No menu lateral, acesse **Fila de Pagamentos**.
   - Baixe e imprima os documentos da OF e NF.
   - Registre um pagamento parcial de R$ 5.000,00 e confira a atualização automática do saldo para R$ 10.000,00.
