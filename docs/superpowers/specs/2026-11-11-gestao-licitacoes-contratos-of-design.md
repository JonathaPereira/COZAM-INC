# Documento de Design — Sistema Integrado de Gestão de Licitações, Contratos, Fornecedores e Ordens de Fornecimento (COZAM-INC)

**Data:** 11 de Novembro de 2026  
**Status:** Aprovado para Planejamento e Execução  
**Autor:** Antigravity AI & Jonatha Pereira (Supervisor de Compras / COZAM)  

---

## 1. Visão Geral e Contexto (The Why)

O **Consórcio Intermunicipal da Zona da Mata Alagoana e Serviços Públicos (COZAM)** necessita de uma plataforma web integrada de gestão pública para atender com precisão o setor de **Compras**. O sistema unifica o ciclo completo de contratação pública: desde o processo licitatório, cadastro detalhado de fornecedores, formalização de contratos e termos aditivos, controle matemático de saldos contratuais por item, até a emissão e assinatura de Ordens de Fornecimento (OFs) e liquidação financeira de Notas Fiscais.

### Princípio Fundamental: Saldo Contratual, NÃO Estoque Físico
O sistema é estritamente voltado para a **gestão administrativa do saldo dos contratos administrativos**. 
- Não haverá controle de prateleiras, almoxarifado físico, lotes, validade, inventário físico ou transferências entre depósitos.
- A contabilidade de cada item obedece à equação:
  $$\text{Quantidade Contratada Atualizada} = \text{Qtd Original} + \text{Acréscimos (Aditivos)} - \text{Supressões (Aditivos)}$$
  $$\text{Saldo Disponível} = \text{Qtd Contratada Atualizada} - \text{Qtd Reservada (OFs aguardando assinatura)} - \text{Qtd Efetivamente Solicitada (OFs confirmadas)}$$
  $$\text{Valor Contratual Restante} = \text{Valor Total Contratado} - \text{Valor Total Solicitado em OFs}$$

---

## 2. Arquitetura Modular e Preservação do Sistema Existente

O sistema é modular e expansível, preservando 100% dos dados já gravados e das funcionalidades previamente validadas:
- **Módulo Financeiro / Pagamentos (Preservado):** `invoices`, `payments`, `v_invoices`, `v_payments`, modalidades financeiras (`FUMIP` e `COMPRA_COMPARTILHADA`), retenção legal de IRRF (1,2%), flag de Simples Nacional, auditoria de liquidações parciais/totais e controle de comprovantes.
- **Módulo de Compras (Novo Núcleo):**
  - **Licitações & Processos:** Gestão de processos administrativos e procedimentos licitatórios (Pregão Eletrônico, Concorrência, Dispensa, Inexigibilidade).
  - **Contratos & Aditivos:** Vigência com alertas de 90, 60, 30 e 15 dias, vinculação a fornecedor e processo licitatório, registro de aditivos de prazo e quantitativos.
  - **Itens Contratados:** Tabela detalhada de itens com código, descrição, categoria, unidade de fornecimento, quantidade e valor unitário adjudicado.
  - **Ordens de Fornecimento (OFs):** Assistente de emissão com seleção de itens e validação transacional de saldo em tempo real, numeração sequencial anual (`OF 001/2026`), geração de documento em PDF e XLSX idêntico ao modelo oficial da COZAM (`Santana do Mundaú`), QR Code/ID exclusivo para identificação documental, ciclo de assinatura física digitalizada e reconciliação idempotente de baixa de saldos.
  - **Dashboard & Indicadores:** Painel executivo com cards de saldos críticos, contratos a vencer, OFs pendentes de assinatura e valores executados.
  - **Relatórios:** Demonstrativos consolidados com exportação em Excel e PDF.

---

## 3. Modelo de Dados Relacional (PostgreSQL / Supabase)

### 3.1. Entidades Novas e Alterações Aditivas
```sql
-- 1. Destinatários (Municípios consorciados, órgãos e secretarias)
CREATE TABLE IF NOT EXISTS public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  cnpj text,
  address text,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'AL',
  contact_department text,
  contact_name text,
  contact_phone text,
  contact_email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Processos Licitatórios
CREATE TABLE IF NOT EXISTS public.procurement_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_number text NOT NULL,
  year int NOT NULL,
  bidding_number text NOT NULL, -- Ex: Pregão Eletrônico 002/2026
  modality text NOT NULL,        -- PREGAO_ELETRONICO, DISPENSA, INEXIGIBILIDADE, etc.
  legal_framework text NOT NULL, -- Lei 14.133/2021, Lei 10.520/2002, etc.
  object text NOT NULL,
  opening_date date,
  homologation_date date,
  manager_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'HOMOLOGADO', -- EM_ANDAMENTO, HOMOLOGADO, CANCELADO, ENCERRADO
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_procurement_number_year UNIQUE (bidding_number, year)
);

-- 3. Contratos Administrativos
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL, -- Ex: Contrato nº 012/2026
  year int NOT NULL,
  procurement_id uuid REFERENCES public.procurement_processes(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  object text NOT NULL,
  legal_framework text NOT NULL,
  signing_date date NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  delivery_deadline_days int DEFAULT 15,
  total_amount numeric(14,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'ATIVO', -- EM_ELABORACAO, AGUARDANDO_CONFERENCIA, ATIVO, PROXIMO_VENCIMENTO, SUSPENSO, ENCERRADO, VENCIDO, RESCINDIDO
  contract_pdf_document_id uuid REFERENCES public.documents(id),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_contract_number_year UNIQUE (contract_number, year)
);

-- 4. Termos Aditivos de Contrato
CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  amendment_number text NOT NULL, -- 1º Termo Aditivo, etc.
  amendment_type text NOT NULL,   -- PRAZO, QUANTITATIVO_ACRESCIMO, QUANTITATIVO_SUPRESSAO, REAJUSTE, OUTRO
  signing_date date NOT NULL,
  new_end_date date,
  additional_amount numeric(14,2) DEFAULT 0.00,
  justification text NOT NULL,
  document_id uuid REFERENCES public.documents(id),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Itens do Contrato
CREATE TABLE IF NOT EXISTS public.contract_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  item_code text NOT NULL, -- Ex: 1-1, 3-6, 19-5
  item_group text,         -- Lote ou grupo licitado
  description text NOT NULL,
  category text NOT NULL,  -- MATERIAL_CONSUMO, MATERIAL_EXPEDIENTE, AGUA_CAFE, MATERIAL_ELETRICO, EPIS, SERVICOS, LOCACAO, OUTROS
  unit text NOT NULL,      -- Unidade, Peça, Pct, Kg, Litro, Metro, Diária, Mês, Hora
  original_quantity numeric(12,3) NOT NULL,
  current_quantity numeric(12,3) NOT NULL,
  unit_price numeric(14,4) NOT NULL,
  total_price numeric(14,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_contract_item UNIQUE (contract_id, item_code)
);

-- 6. Itens das Ordens de Fornecimento
CREATE TABLE IF NOT EXISTS public.supply_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_order_id uuid NOT NULL REFERENCES public.supply_orders(id) ON DELETE CASCADE,
  contract_item_id uuid NOT NULL REFERENCES public.contract_items(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL,
  unit_price numeric(14,4) NOT NULL,
  total_price numeric(14,2) NOT NULL,
  delivered_quantity numeric(12,3) DEFAULT 0.000,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Movimentações Contratuais Auditáveis de Saldo
CREATE TABLE IF NOT EXISTS public.contract_item_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_item_id uuid NOT NULL REFERENCES public.contract_items(id) ON DELETE RESTRICT,
  supply_order_id uuid REFERENCES public.supply_orders(id) ON DELETE SET NULL,
  movement_type text NOT NULL, -- RESERVA, BAIXA, LIBERACAO, ESTORNO, ADITIVO_ACRESCIMO, ADITIVO_SUPRESSAO
  quantity numeric(12,3) NOT NULL,
  unit_price numeric(14,4) NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  reason text,
  client_request_id uuid, -- Idempotência
  actor_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Alteração aditiva em supply_orders para vincular a contrato e ciclo de assinatura
ALTER TABLE public.supply_orders 
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS delivery_deadline text DEFAULT '15 DIAS CORRIDOS',
  ADD COLUMN IF NOT EXISTS signed_document_id uuid REFERENCES public.documents(id),
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by uuid REFERENCES public.profiles(id);
```

---

## 4. O Modelo de Ordem de Fornecimento (Alta Fidelidade)

Baseado no arquivo oficial `MODELO DE ORDEM PROTOTIPO SISTEMA.xlsx`:
1. **Cabeçalho:** Logotipo do Consórcio COZAM, texto institucional centralizado:
   `CONSÓRCIO INTERMUNICIPAL DA ZONA DA MATA ALAGOANA E SERVIÇOS PÚBLICOS - CNPJ Nº 19.140.014/0001-39`
2. **Título:** `ORDEM DE FORNECIMENTO — TERMO DE CONTRATO - PREGÃO ELETRÔNICO Nº [XXX/ANO]`
3. **Metadados:**
   - **Objeto:** Texto contratual dinâmico.
   - **Fundamentação Legal:** Enquadramento jurídico.
   - **Órgão Gerenciador:** COZAM.
   - **Fornecedor Registrado:** Razão Social, CNPJ, Endereço completo, Telefone e E-mail.
   - **Celebração & Validade:** Datas formatadas por extenso (`DD de Mês de AAAA`).
   - **Texto de Autorização:** `"AUTORIZO a empresa [FORNECEDOR], a partir da presente data, proceder o fornecimento dos itens relacionados e na forma abaixo, em atenção ao edital."`
   - **Município:** Cidade consorciada destinatária (ex: `SANTANA DO MUNDAÚ`).
4. **Tabela de Itens:**
   - Colunas: `ITEM | DESCRIÇÃO | UND | QUANT | VALOR UNITÁRIO | VALOR TOTAL`
   - Total Geral com formatação monetária em Real (`R$`).
5. **Rodapé e Assinaturas:**
   - Local e data por extenso (`Maceió/AL, DD de Mês de AAAA`).
   - Assinatura do Supervisor de Compras (nome configurável, padrão: `JONATHA PEREIRA DE JESUS / SUPERVISOR DE COMPRAS`).
   - Prazo de entrega: `15 DIAS CORRIDOS` (ou configurado no contrato).
   - Campo para assinatura do fornecedor registrado.
   - QR Code / Código de rastreabilidade para vinculação automática do arquivo digitalizado.

---

## 5. Regras de Negócio e Integridade Transacional

1. **Validação de Saldo no Backend:** A emissão de OF realiza `SELECT ... FOR UPDATE` nos itens do contrato dentro de uma transação. Se `quantidade_solicitada > saldo_disponivel`, a transação sofre rollback imediato com erro `SALDO_CONTRATUAL_INSUFICIENTE`.
2. **Concorrência Protegida:** Múltiplos operadores não conseguem estourar o saldo disponível em requisições simultâneas.
3. **Vigência Obrigatória:** Contratos vencidos ou suspensos não permitem geração de OF normal (`CONTRATO_FORA_DE_VIGENCIA`).
4. **Idempotência de Assinatura:** O upload repetido da mesma via assinada não duplica movimentações de baixa de saldo.
5. **Cancelamento Seguro:**
   - OF em status `AGUARDANDO_ASSINATURA` cancelada -> Registra movimentação de `LIBERACAO`, zerando a reserva.
   - OF em status `CONFIRMADA` cancelada -> Registra movimentação de `ESTORNO` com justificativa obrigatória, retornando os itens não fornecidos ao saldo disponível.
   - Fornecimento parcial -> Apenas o saldo não fornecido retorna ao contrato.
6. **Conferência Humana Obrigatória na Leitura de Contratos em PDF:** A IA e os parsers sugerem campos e tabelas extraídas, mas a ativação do contrato exige revisão e aprovação humana explícita.

---

## 6. Plano de Testes Obrigatórios

A suíte de testes do servidor conterá testes unitários e de integração de ponta a ponta:
- **Cenário A:** Cadastro de contrato com 100 itens a R$ 20,00 e conferência de saldos.
- **Cenário B:** Emissão de OF reservando 25 unidades e verificação do saldo disponível (75).
- **Cenário C:** Envio de OF assinada convertendo reserva em baixa confirmada.
- **Cenário D:** Cancelamento antes da assinatura liberando a reserva integralmente.
- **Cenário E:** Cancelamento pós-assinatura com estorno integral e auditoria.
- **Cenário F:** Fornecimento parcial (30 solicitados, 10 fornecidos, 20 cancelados).
- **Cenário G:** Bloqueio estrito de tentativa de emitir quantidade superior ao saldo disponível.
- **Cenário H:** Teste de concorrência com requisições concorrentes.
- **Cenário I:** Bloqueio de emissão para contrato vencido.
- **Cenário J:** Conferência de dados extraídos de contrato em PDF.
- **Cenário K:** Idempotência no reenvio de documento assinado.
- **Cenários Anteriores (A até N):** Preservação de todos os 15 testes já existentes de Compras e Pagamentos.
