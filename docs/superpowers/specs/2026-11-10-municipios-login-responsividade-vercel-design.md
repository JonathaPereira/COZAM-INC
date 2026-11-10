# Documento de Design — Melhorias COZAM: Municípios, Login, Perfil, Responsividade, Vercel e Exclusão Administrativa

**Data:** 10 de Novembro de 2026  
**Status:** Aprovado para Planejamento  
**Autor:** Antigravity AI & Gestão COZAM  

---

## 1. Contexto e Motivação (Intent & The Why)

O sistema **COZAM — Sistema Integrado de Compras e Pagamentos** já se encontra em produção no Render e integrado ao banco de dados Supabase PostgreSQL, autenticação e armazenamento de documentos. 

Com o primeiro ciclo de homologação concluído pela equipe do Consórcio, foram identificadas 6 melhorias essenciais para o dia a dia operacional:
1. Identificação clara de qual **Município consorciado** cada Nota Fiscal pertence, permitindo ao setor financeiro/pagamentos auditar e filtrar as pendências municipais.
2. Agilização do acesso com o recurso **"Lembre de mim"** na tela de autenticação.
3. Autonomia para o usuário do setor de **Pagamentos (e Compras) alterar sua própria senha** a qualquer momento.
4. Otimização visual e **responsividade mobile/tablet** nos Dashboards e tabelas analíticas.
5. Implantação do frontend na **Vercel** para máxima velocidade de carregamento (Edge CDN na América do Sul) conectado à API do Render.
6. Capacidade de o **Administrador excluir lançamentos de Ordens de Fornecimento ou Notas Fiscais** anexados por engano, registrando justificativa opcional visível para Pagamentos.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos:
- Permitir ao setor de Compras selecionar ou cadastrar novos municípios ao lançar notas fiscais.
- Permitir ao setor de Pagamentos filtrar a fila de pagamentos e histórico por município, com métricas e pendências individualizadas por cidade.
- Implementar persistência de e-mail e preferência de sessão ("Lembre de mim") no login.
- Disponibilizar modal de "Meu Perfil" para troca de senha via Supabase Auth.
- Refinar layout, tipografia, espaçamento e responsividade para dispositivos móveis e desktops.
- Configurar `vercel.json` para hospedar o frontend na Vercel com rewrites transparentes para o backend.
- Permitir ao Administrador excluir OFs e NFs cadastrados por engano (desde que não tenham pagamentos liquidados vinculados), com justificativa opcional registrada na auditoria.

### Não-Objetivos:
- Não construir um módulo complexo de gestão cadastral de municípios (apenas identificação ágil na nota fiscal e persistência dos nomes utilizados).
- Não permitir a exclusão de notas fiscais que já possuam pagamentos quitados no banco de dados.

### Anti-Objetivos (O que não pode acontecer):
- **Perda de Dados:** Sob nenhuma hipótese qualquer atualização ou migração de banco de dados poderá apagar, sobrescrever ou corromper dados, notas, fornecedores ou usuários já cadastrados no Supabase de produção.
- **Inconsistência de Arquivos:** Ao excluir uma nota cadastrada por engano, os arquivos anexados a ela devem ser desvinculados de forma limpa.

---

## 3. Restrições e Preservação de Dados (Constraints)

1. **Migrações Aditivas:** Todas as alterações no PostgreSQL serão realizadas através de `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, garantindo compatibilidade reversa e preservação dos registros já existentes.
2. **Imutabilidade Financeira Condicional:** A trigger `tg_prevent_delete` será atualizada exclusivamente para permitir exclusão por administradores quando `total_paid = 0` ou status de rascunho/sem pagamento, mantendo o bloqueio total para registros já pagos.
3. **Padrão de Cores e Temas:** Todos os novos componentes (modal de perfil, seletor de municípios, inputs) devem suportar nativamente tanto o Modo Claro quanto o Modo Escuro.

---

## 4. Abordagens Consideradas

### Abordagem 1 (Escolhida e Aprovada):
- **Arquitetura:** Frontend React/Vite hospedado na Vercel (Edge CDN global) consumindo o backend Node.js no Render e Supabase PostgreSQL/Auth.
- **Banco de Dados:** Migração aditiva `004_add_municipality.sql` adicionando a coluna `municipality text` em `public.invoices`.
- **Exclusão com Auditoria:** Exclusão administrativa permitida para notas/OFs sem pagamentos, com captura de justificativa opcional gravada em `public.audit_logs`.
- **Municípios Pré-Carregados:** *Santana do Mundaú, Branquinha, União dos Palmares, Carneiros*, além de campo dinâmico para cadastrar novos municípios consorciados.

### Abordagem 2 (Descartada):
- Manter o monolito apenas no Render e restringir exclusão estritamente a notas em rascunho. Descartada por não atender à velocidade da Vercel nem à necessidade de corrigir notas enviadas com anexo errado.

---

## 5. Especificação Técnica Detalhada

### 5.1. Módulo de Municípios
- **Banco de Dados:**
  ```sql
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS municipality text;
  CREATE INDEX IF NOT EXISTS invoices_municipality_idx ON public.invoices (upper(trim(municipality)));
  ```
- **Municípios Iniciais:**
  1. Santana do Mundaú
  2. Branquinha
  3. União dos Palmares
  4. Carneiros
- **Interface do Lançamento:**
  - Componente de seleção rápida com autocomplete.
  - Opção `+ Outro Município` que abre um campo de texto para digitar um novo município consorciado.
  - Lista de municípios no frontend combina os 4 padrões + municípios únicos já cadastrados no banco.
- **Painel de Pagamentos:**
  - Novo filtro dropdown `Filtrar por Município` ao lado do filtro de fornecedor.
  - Ao selecionar um município, a tabela e os cards de resumo (Total Pendente, Total Pago, Qtd Notas) são recalculados para aquele município.

### 5.2. "Lembre de mim" na Tela de Login
- Checkbox estilizado com ícone e label *"Lembrar meu acesso neste dispositivo"*.
- Estado salvo em `localStorage.setItem('cozam_remember_me', 'true')` e `localStorage.setItem('cozam_saved_email', email)`.
- No carregamento inicial do Login, se `cozam_remember_me === 'true'`, o e-mail é automaticamente pré-preenchido e o foco vai direto para a senha.

### 5.3. Módulo "Meu Perfil" e Alteração de Senha
- No `Header.tsx`, ao clicar no avatar/nome do usuário, é adicionada a opção **"Meu Perfil / Trocar Senha"**.
- Modal elegante contendo:
  - Nome completo e E-mail (somente leitura).
  - Cargo/Perfil (ex: "Setor de Pagamentos" ou "Administrador - Compras").
  - Campo "Nova Senha" (mínimo 6 caracteres).
  - Campo "Confirmar Nova Senha".
  - Botão "Salvar Nova Senha", que chama `supabase.auth.updateUser({ password: newPassword })`.
  - Notificação de sucesso com Sonner toast.

### 5.4. Responsividade e Melhoria Visual
- **Dashboard:**
  - Ajustar o grid de StatCards para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - Envolver tabelas longas em containers com scroll horizontal suave (`overflow-x-auto` com indicador sutil).
  - Recharts: garantir `ResponsiveContainer width="100%" height={320}` com padding adequado para não cortar rótulos nos eixos X e Y em telas estreitas.
- **Menu Lateral / Sidebar:**
  - Garantir abertura suave e backdrop escurecido no mobile (`fixed inset-y-0 z-50 lg:static`).

### 5.5. Exclusão de Ordens e Notas pelo Administrador
- **Regras:**
  - Somente usuários com `role = 'admin'` podem ver e clicar no botão "Excluir".
  - Notas que possuam pagamentos com status `VALIDO` **NÃO** podem ser excluídas (exige cancelamento/estorno dos pagamentos antes).
  - Ao clicar em "Excluir", abre-se um modal de confirmação:
    - Exibe aviso claro da ação.
    - Campo de texto opcional: *"Justificativa da exclusão (visível para o setor de Pagamentos)"*.
    - Botão "Confirmar Exclusão".
  - A exclusão remove os documentos anexados e o registro da nota/OF, gravando um log na tabela `audit_logs` com a ação `NF_EXCLUIDA` ou `OF_EXCLUIDA`, contendo o resumo e a justificativa para que Pagamentos tenha total transparência.

### 5.6. Configuração para Hospedagem na Vercel
- Criação de `vercel.json` no repositório:
  - Roteamento SPA: todas as rotas não-API direcionam para `/index.html`.
  - Rewrites de API: direciona requisições `/api/:path*` diretamente para a API no Render (`https://cozam-sistema.onrender.com/api/:path*`).
- Configuração de build na Vercel:
  - Root directory ou build command: `npm run build --workspace client`
  - Output directory: `client/dist`

---

## 6. Próximo Passo
Com este design aprovado, a próxima etapa é acionar a skill `writing-plans` para elaborar o plano passo a passo com checklist de tarefas rastreáveis.
