# Guia Oficial de Integração: Banco de Dados Supabase & Criação de Logins

Este documento fornece o passo a passo completo, detalhado e estruturado em tópicos para conectar o sistema **COZAM — Sistema Integrado de Compras e Pagamentos** a uma instância oficial de produção do **Supabase (PostgreSQL, Auth e Storage)** e configurar os logins dos setores de **Compras** e **Pagamentos**.

---

## Sumário

1. [Tópico 1: Criação e Configuração do Projeto no Supabase](#tópico-1-criação-e-configuração-do-projeto-no-supabase)
2. [Tópico 2: Execução das Migrações SQL na Ordem Correta](#tópico-2-execução-das-migrações-sql-na-ordem-correta)
3. [Tópico 3: Configuração do Supabase Storage (Bucket de Documentos)](#tópico-3-configuração-do-supabase-storage-bucket-de-documentos)
4. [Tópico 4: Criação de Usuários Reais e Perfis de Acesso](#tópico-4-criação-de-usuários-reais-e-perfis-de-acesso)
5. [Tópico 5: Mapeamento de Chaves e Variáveis de Ambiente](#tópico-5-mapeamento-de-chaves-e-variáveis-de-ambiente)
6. [Tópico 6: Deploy e Conexão em Produção no Render](#tópico-6-deploy-e-conexão-em-produção-no-render)
7. [Tópico 7: Checklist de Verificação e Homologação Final](#tópico-7-checklist-de-verificação-e-homologação-final)

---

## Tópico 1: Criação e Configuração do Projeto no Supabase

O Supabase fornece a infraestrutura de banco de dados relacional PostgreSQL, autenticação segura com JWT e armazenamento de objetos (Storage).

### 1.1. Criando a Conta e a Organização
1. Acesse o console oficial do Supabase em [https://supabase.com](https://supabase.com) e efetue o login (ou crie sua conta).
2. Na página principal do painel, clique em **"New project"** (Novo Projeto).
3. Selecione a sua organização (Organization).

### 1.2. Configurando o Projeto
Preencha as informações do novo projeto:
- **Name (Nome do Projeto):** `cozam-prod` (ou `cozam-consórcio`).
- **Database Password (Senha do Banco de Dados):**
  - Gere uma senha forte de no mínimo 16 caracteres (guarde esta senha com segurança; ela será utilizada na string de conexão `DATABASE_URL`).
  - *Dica:* Evite caracteres como `@`, `:`, `/` na senha para não exigir URL-encoding na connection string.
- **Region (Região Geográfica):**
  - Selecione **South America (São Paulo) — `sa-east-1`**.
  - A escolha do data center no Brasil reduz drasticamente a latência das requisições e downloads de arquivos.
- **Pricing Plan:** Escolha o plano adequado (o plano *Free* atende perfeitamente à fase de testes e homologação; o plano *Pro* é recomendado para ambientes oficiais com backup contínuo).
- Clique em **"Create new project"** e aguarde 2 a 3 minutos até que a infraestrutura seja provisionada.

---

## Tópico 2: Execução das Migrações SQL na Ordem Correta

O COZAM conta com regras de integridade financeira rígidas implementadas diretamente no PostgreSQL (triggers que impedem deleção de registros financeiros, cálculo automático de saldos e controle de concorrência com `FOR UPDATE`).

As migrações versionadas encontram-se na pasta `supabase/migrations/` do repositório:
1. `001_schema.sql`
2. `002_business_rules.sql`
3. `003_security_views_storage.sql`

### 2.1. Passo a Passo no SQL Editor do Supabase
1. No menu lateral esquerdo do Supabase, clique no ícone **SQL Editor** (ou pressione `s` e depois `q`).
2. Clique em **"New Query"** (Nova Consulta).

#### Execução 1: Estrutura Base (`001_schema.sql`)
- Abra o arquivo `supabase/migrations/001_schema.sql` no seu editor ou clone local.
- Copie todo o conteúdo e cole na janela do SQL Editor.
- Clique em **"Run"** (ou aperte `Ctrl + Enter`).
- **O que esta migração faz:**
  - Cria os tipos enumerados: `app_role` (`admin`, `pagamentos`, `secondary_admin`), `invoice_status`, `payment_modality` (`FUMIP`, `COMPRA_COMPARTILHADA`), `forward_status` e `document_kind`.
  - Cria as tabelas fundamentais: `profiles`, `suppliers` (já inserindo os fornecedores homologados **MZ Bernardi** e **Nacional**), `administrative_processes`, `supply_orders`, `invoices`, `payments`, `historical_statuses`, `documents` e `audit_logs`.
  - Cria índices de alta performance para buscas por fornecedor, número de NF, processo e datas.

#### Execução 2: Regras de Negócio e Triggers (`002_business_rules.sql`)
- Crie uma nova query no SQL Editor.
- Copie e cole todo o conteúdo do arquivo `supabase/migrations/002_business_rules.sql`.
- Clique em **"Run"**.
- **O que esta migração faz:**
  - `tg_prevent_delete`: Proíbe terminantemente comandos `DELETE` nas tabelas financeiras (`invoices`, `payments`, `supply_orders`).
  - `tg_recalculate_invoice_financials`: Gatilho acionado a cada pagamento inserido, corrigido ou cancelado, recalculando atomicamente o saldo devedor e transitando a NF entre `AGUARDANDO_PAGAMENTO`, `PARCIALMENTE_PAGA` e `TOTALMENTE_PAGA`.
  - Validação estrita de que cada OF pertence a um único fornecedor.
  - Exigência de que NFs não-históricas sejam cadastradas inicialmente como `RASCUNHO` antes do encaminhamento formal.

#### Execução 3: Segurança RLS, Views e Storage (`003_security_views_storage.sql`)
- Crie uma nova query no SQL Editor.
- Copie e cole todo o conteúdo do arquivo `supabase/migrations/003_security_views_storage.sql`.
- Clique em **"Run"**.
- **O que esta migração faz:**
  - Ativa o **Row Level Security (RLS)** em todas as tabelas.
  - Cria as views analíticas para o Dashboard e para os Relatórios oficiais.
  - Garante a criação do bucket `documentos` e estabelece as políticas de acesso autenticado aos PDFs.

### 2.2. Verificação no Table Editor
No menu lateral, clique em **Table Editor** e confirme se as 9 tabelas (`profiles`, `suppliers`, `administrative_processes`, `supply_orders`, `invoices`, `payments`, `historical_statuses`, `documents`, `audit_logs`) estão visíveis.

---

## Tópico 3: Configuração do Supabase Storage (Bucket de Documentos)

Os arquivos PDF de Ordens de Fornecimento, Notas Fiscais e Comprovantes são armazenados em um bucket privado.

### 3.1. Verificação do Bucket
1. No menu lateral do Supabase, clique em **Storage**.
2. Verifique se o bucket com o nome **`documentos`** foi criado.
3. Se o bucket não existir, clique em **"New Bucket"**:
   - **Name:** `documentos`
   - **Public bucket:** **DESMARCADO (Privado)** — essencial para que documentos fiscais só possam ser baixados por usuários autenticados via URL assinada temporária.
   - **File size limit:** `20971520` (20 MB).
   - **Allowed MIME types:** `application/pdf`, `image/jpeg`, `image/png`.
   - Clique em **"Save"**.

---

## Tópico 4: Criação de Usuários Reais e Perfis de Acesso

O sistema opera com autenticação individual baseada em perfis (`profiles`). Não compartilhe senhas genéricas.

### Perfis Previstos no Consórcio:
1. **Administrador — Setor de Compras:**
   - Permissão total para criar processos, cadastrar OFs, emitir e encaminhar NFs, gerenciar fornecedores e usuários.
2. **Operador — Setor de Pagamentos:**
   - Permissão para consultar documentos encaminhados, baixar/imprimir PDFs de OFs e NFs, registrar pagamentos parciais/totais e anexar comprovantes.

---

### 4.1. Método A: Criação pelo Painel do Supabase + SQL (Recomendado)

#### Passo 1: Criar o Usuário no Supabase Auth
1. No menu lateral esquerdo, vá em **Authentication** -> **Users**.
2. Clique no botão **"Add user"** -> **"Create user"**.
3. Preencha os dados do responsável de **Compras**:
   - **Email:** `compras@cozam.al.gov.br` (exemplo)
   - **Password:** Defina uma senha temporária segura.
   - **Auto Confirm User:** **MARCADO (Checked)** (para que o e-mail não precise de confirmação por link na primeira ativação).
   - Clique em **"Create user"**.
4. Repita o processo para o responsável de **Pagamentos**:
   - **Email:** `pagamentos@cozam.al.gov.br` (exemplo)
   - **Password:** Defina uma senha temporária segura.
   - **Auto Confirm User:** **MARCADO**.
5. Copie o **User UID** gerado para cada um dos usuários (uma sequência como `a1b2c3d4-e5f6-...`).

#### Passo 2: Associar o Perfil Funcional em `public.profiles`
Vá até o **SQL Editor** e execute o seguinte script (substitua os UUIDs pelos UIDs reais copiados no Passo 1):

```sql
-- Perfil do Administrador de Compras
INSERT INTO public.profiles (id, full_name, email, role, active)
VALUES (
  'COLE_AQUI_O_UUID_DE_COMPRAS',
  'Responsável pelo Setor de Compras',
  'compras@cozam.al.gov.br',
  'admin',
  true
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  active = true;

-- Perfil do Operador de Pagamentos
INSERT INTO public.profiles (id, full_name, email, role, active)
VALUES (
  'COLE_AQUI_O_UUID_DE_PAGAMENTOS',
  'Responsável pelo Setor de Pagamentos',
  'pagamentos@cozam.al.gov.br',
  'pagamentos',
  true
)
ON CONFLICT (id) DO UPDATE SET
  role = 'pagamentos',
  active = true;
```

---

### 4.2. Método B: Criação via Script CLI Automatizado

Se você estiver executando o projeto em um ambiente com acesso ao terminal com as variáveis de ambiente configuradas no `.env`:

```bash
# Criação do Administrador de Compras
npm run create-admin -- \
  --email compras@cozam.al.gov.br \
  --password "SenhaForte@2026" \
  --name "Coordenação de Compras" \
  --role admin

# Criação do Operador de Pagamentos
npm run create-admin -- \
  --email pagamentos@cozam.al.gov.br \
  --password "SenhaForte@2026" \
  --name "Coordenação Financeira" \
  --role pagamentos
```

---

## Tópico 5: Mapeamento de Chaves e Variáveis de Ambiente

Para conectar o frontend e o backend à sua instância do Supabase, localize as chaves no painel do Supabase:
1. No menu lateral do Supabase, clique em **Project Settings** (ícone de engrenagem).
2. Vá em **API**:
   - **Project URL:** `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
   - **anon / public key:** Chave pública (segura para o navegador).
   - **service_role key:** Chave secreta de serviço (para operações administrativas e backend; **NUNCA** exponha no Git ou no frontend).
3. Vá em **Database**:
   - Na seção **Connection string**, selecione a aba **URI**.
   - Escolha o modo **Session** ou **Transaction** (porta 6543 ou 5432) e substitua `[YOUR-PASSWORD]` pela senha do banco que você definiu no Tópico 1.

### 5.1. Arquivo de Variáveis Local (`.env`)
No diretório raiz do projeto, crie ou edite o arquivo `.env`:

```env
# Configurações do Servidor
PORT=3000
NODE_ENV=production

# Supabase — URL e Chaves
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Conexão Direta ao PostgreSQL
DATABASE_URL=postgresql://postgres.xxxxxxxx:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

# Chave de Assinatura de Sessão / JWT
JWT_SECRET=gere_uma_chave_aleatoria_longa_aqui_para_sessao_32_caracteres
```

> [!WARNING]
> Nunca versione o arquivo `.env` no repositório GitHub. O arquivo `.gitignore` já está configurado para ignorá-lo.

---

## Tópico 6: Deploy e Conexão em Produção no Render

O repositório já possui um blueprint de infraestrutura pronto em `render.yaml`.

### 6.1. Conexão do Repositório no Render
1. Acesse o painel do [Render](https://dashboard.render.com).
2. Clique em **"New +"** -> **"Web Service"**.
3. Conecte o repositório GitHub do projeto (`JonathaPereira/COZAM-INC`).
4. Selecione a branch `main`.

### 6.2. Configurações do Serviço
- **Name:** `cozam-sistema`
- **Region:** `Frankfurt` ou `Ohio` (ou a mais próxima disponível).
- **Environment:** `Node`
- **Build Command:** `./render-build.sh` (ou `npm run build`)
- **Start Command:** `npm run start`
- **Plan:** `Starter` ou superior.

### 6.3. Injeção das Variáveis de Ambiente no Render
Na aba **Environment** do serviço no Render, adicione as seguintes variáveis:

| Variável | Valor | Finalidade |
|---|---|---|
| `NODE_ENV` | `production` | Modo otimizado de produção |
| `PORT` | `10000` | Porta padrão do Render |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | URL da sua instância Supabase |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` | Chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Chave administrativa do backend |
| `DATABASE_URL` | `postgresql://postgres...` | Connection string do PostgreSQL |
| `JWT_SECRET` | *(string aleatória de 32+ caracteres)* | Assinatura interna de tokens |

Clique em **"Save Changes"**. O Render iniciará a compilação e publicação automática.

---

## Tópico 7: Checklist de Verificação e Homologação Final

Após o deploy, realize a checagem ponta a ponta:

1. **Acesso à Tela de Login:**
   - Acesse a URL gerada pelo Render (`https://cozam-sistema.onrender.com`).
   - Verifique o carregamento dos logotipos institucionais e o seletor de tema (Modo Claro / Modo Escuro).
2. **Login com Usuário de Compras:**
   - Entre com as credenciais cadastradas no Tópico 4 (`compras@cozam.al.gov.br`).
   - Verifique o redirecionamento automático para o **Dashboard**.
   - Acesse o assistente **"Novo Lançamento"** e realize um cadastro de teste.
   - Clique em **"ENCAMINHAR PARA PAGAMENTOS"**.
3. **Login com Usuário de Pagamentos:**
   - Saia do sistema e faça login com as credenciais de Pagamentos (`pagamentos@cozam.al.gov.br`).
   - Acesse a **"Fila de Pagamentos"** e confirme que a nota fiscal encaminhada aparece imediatamente.
   - Clique no ícone de visualização do PDF da OF e da NF para confirmar que a URL assinada abre o arquivo corretamente.
   - Registre um pagamento parcial ou total.
4. **Verificação no Painel de Auditoria:**
   - Acesse **"Auditoria do Sistema"** com o usuário de Compras e confirme que o histórico de criação, encaminhamento e pagamento foi gravado com data, hora, responsável e justificativa.

---

## Tópico 8: Hospedagem de Alta Performance do Frontend na Vercel (Edge CDN)

Para proporcionar a máxima velocidade de navegação, carregamento instantâneo de telas e disponibilidade ininterrupta, o frontend do COZAM foi preparado para publicação na **Vercel** através de CDN Edge com roteamento inteligente para a API no Render.

### 8.1. Passo a Passo de Publicação na Vercel

1. Acesse o dashboard da [Vercel](https://vercel.com/) e faça login com sua conta do GitHub.
2. Clique no botão **"Add New..."** → **"Project"**.
3. Localize o repositório `JonathaPereira/COZAM-INC` e clique em **"Import"**.
4. A Vercel detectará automaticamente as configurações através do arquivo `vercel.json`:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run vercel-build`
   - **Output Directory:** `client/dist`
5. Na seção **Environment Variables**, adicione as variáveis públicas do Supabase (para autenticação direta do cliente):
   - `VITE_SUPABASE_URL`: sua URL do Supabase (ex: `https://wwtabxlxhejqaoetsbru.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: sua chave pública anônima do Supabase
6. Clique em **"Deploy"**.
7. Em menos de 1 minuto, sua aplicação estará no ar em uma URL ultra-rápida (ex: `https://cozam-inc.vercel.app`), com cache inteligente de assets estáticos e proxy transparente de todas as requisições `/api/*` para o backend no Render!

---

*Documentação mantida pela equipe técnica do COZAM — 2026.*
