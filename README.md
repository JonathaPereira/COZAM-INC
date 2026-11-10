# COZAM — Sistema Integrado de Compras e Pagamentos

Sistema web institucional desenvolvido para o **Consórcio Intermunicipal da Zona da Mata Alagoana e Serviços Públicos (COZAM)** para gestão de processos administrativos, ordens de fornecimento, documentos fiscais e controle financeiro de pagamentos.

O sistema elimina a tramitação física de papéis entre os setores de **Compras** e **Pagamentos**, garantindo integridade financeira, rastreabilidade e auditoria imutável de todas as operações.

---

## Principais Funcionalidades

- **Setor de Compras (Administrador Principal):**
  - Cadastro de processos administrativos, ordens de fornecimento (OF) e notas fiscais (NF).
  - Upload e versionamento de arquivos PDF originais de OFs e NFs.
  - Seleção das modalidades oficiais: **FUMIP** ou **Compra Compartilhada**.
  - Campo opcional para observações administrativas (comentários sobre notas emitidas parcialmente que não alteram o saldo financeiro).
  - Fluxo documental com ação expressa **ENCAMINHAR PARA PAGAMENTOS**.
  - Gestão de usuários, fornecedores homologados e trilha de auditoria.

- **Setor de Pagamentos:**
  - Fila de atendimento com visualização imediata das NFs encaminhadas.
  - Consulta, download e **impressão direta** dos PDFs originais da OF e da NF (sem necessidade de solicitar novamente ao setor de Compras).
  - Busca rápida por nº de NF, processo, fornecedor ou período (sem exigência do número da OF).
  - Registro de pagamentos parciais e totais com valor, data, observação e comprovante opcional.
  - Cálculo automático de saldo devedor e transição de status em tempo real.
  - Correção ou cancelamento de pagamentos com justificativa obrigatória registrada em auditoria.

- **Pendências Históricas:**
  - Módulo opcional para levantamento progressivo de notas antigas.
  - Situação **"Sem Informação / Não Verificada"** que isola notas não auditadas dos totais confirmados.
  - Registro de notas pendentes, parcialmente pagas ou já quitadas com identificação de quem forneceu a informação.

- **Painel Gerencial e Relatórios:**
  - Dashboard moderno com indicadores em tempo real e gráficos animados via Recharts.
  - 10 relatórios analíticos oficiais com exportação direta para **PDF** (layout A4 com cabeçalho institucional) e **Excel** (células monetárias formatadas).

---

## Arquitetura Tecnológica

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts, Sonner.
- **Backend:** Node.js, Express, PostgreSQL / Supabase, Supabase Auth & Storage.
- **Infraestrutura:** Preparado para deploy no **Render** como Web Service único via `render.yaml`.
- **Banco de Dados & RLS:** Políticas de segurança no nível de linha (RLS), triggers de cálculo automático e bloqueio de concorrência (`FOR UPDATE`).

---

## Estrutura do Repositório (npm workspaces)

```
.
├── client/                     # Aplicação frontend React + Vite + Tailwind CSS
│   ├── public/brand/           # Logotipos oficiais do COZAM (variantes clara, escura e ícone)
│   └── src/
│       ├── components/         # Componentes de UI e Layout (Sidebar, Header, AppShell)
│       ├── contexts/           # AuthContext (sessão e permissões)
│       ├── lib/                # API wrapper, integração Supabase, exportação PDF/Excel
│       └── pages/              # Telas (Dashboard, Lançamento, Processos, OFs, NFs, Pagamentos...)
├── server/                     # API backend Express + Node.js
│   ├── src/
│   │   ├── db/                 # Pool PostgreSQL com fallback in-memory PGlite e runner de migrations
│   │   ├── middleware/         # Autenticação, autorização por permissão, upload multer, erros
│   │   ├── routes/             # Rotas da API (/api/invoices, /api/payments, /api/reports...)
│   │   ├── services/           # Supabase Storage e armazenamento de arquivos
│   │   └── scripts/            # Script CLI create-admin
│   └── test/                   # Suíte automatizada com todos os Cenários Obrigatórios (A a J)
├── shared/                     # Pacote compartilhado (@cozam/shared)
│   └── src/                    # Enums, matriz de permissões, contratos da API e helpers BRL/datas
├── supabase/migrations/        # Migrações versionadas do banco PostgreSQL
├── docs/                       # Documentação técnica (API.md e DEPLOYMENT.md)
└── render.yaml                 # Blueprint de infraestrutura para implantação no Render
```

---

## Comandos Disponíveis

```bash
# Instalar dependências em todos os workspaces
npm install

# Executar suíte de testes automatizados (Cenários A até J)
npm run test --workspace server

# Compilar todo o projeto para produção (client + server)
npm run build

# Iniciar o servidor em produção
npm run start

# Executar verificação de tipos TypeScript em todo o monorepo
npm run typecheck

# Criar ou redefinir senha do usuário administrador
npm run create-admin -- --email compras@cozam.al.gov.br --password "SuaSenha@2026"
```

---

## Implantação no Render

Consulte o guia completo em [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para o passo a passo de configuração do Supabase e deploy no Render.
