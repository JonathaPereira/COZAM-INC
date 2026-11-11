-- =============================================================================
-- Migration 009: Gestão de Licitações, Contratos, Destinatários e Saldo Contratual
-- Totalmente aditivo: Preserva 100% dos dados já gravados.
-- =============================================================================

-- 1. Tabela de Destinatários (Municípios e Entidades Consorciadas)
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

-- Seed de municípios consorciados iniciais caso não existam
INSERT INTO public.destinations (name, city, state)
VALUES
  ('SANTANA DO MUNDAÚ', 'Santana do Mundaú', 'AL'),
  ('SÃO JOSÉ DA LAJE', 'São José da Laje', 'AL'),
  ('IBATEGUARA', 'Ibateguara', 'AL'),
  ('COLÔNIA LEOPOLDINA', 'Colônia Leopoldina', 'AL'),
  ('NOVO LINO', 'Novo Lino', 'AL'),
  ('JOAQUIM GOMES', 'Joaquim Gomes', 'AL'),
  ('CAMPESTRE', 'Campestre', 'AL'),
  ('JUNDIÁ', 'Jundiá', 'AL'),
  ('BRANQUINHA', 'Branquinha', 'AL'),
  ('MURICI', 'Murici', 'AL'),
  ('MESSIAS', 'Messias', 'AL')
ON CONFLICT (name) DO NOTHING;

-- 2. Tabela de Processos Licitatórios
CREATE TABLE IF NOT EXISTS public.procurement_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_number text NOT NULL,
  year int NOT NULL,
  bidding_number text NOT NULL, -- Ex: Pregão Eletrônico 002/2026
  modality text NOT NULL DEFAULT 'PREGAO_ELETRONICO',
  legal_framework text NOT NULL DEFAULT 'Lei 14.133/2021',
  object text NOT NULL,
  opening_date date,
  homologation_date date,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'HOMOLOGADO',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_bidding_year
  ON public.procurement_processes (bidding_number, year);

-- 3. Tabela de Contratos Administrativos
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL, -- Ex: Contrato nº 012/2026
  year int NOT NULL,
  procurement_id uuid REFERENCES public.procurement_processes(id) ON DELETE SET NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  object text NOT NULL,
  legal_framework text NOT NULL DEFAULT 'Lei 14.133/2021',
  signing_date date NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  delivery_deadline_days int DEFAULT 15,
  total_amount numeric(14,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'ATIVO',
  contract_pdf_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON public.contracts (supplier_id);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.contracts (end_date);

-- 4. Termos Aditivos de Contrato
CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  amendment_number text NOT NULL, -- Ex: 1º Termo Aditivo
  amendment_type text NOT NULL,   -- PRAZO, QUANTITATIVO_ACRESCIMO, QUANTITATIVO_SUPRESSAO, REAJUSTE, OUTRO
  signing_date date NOT NULL,
  new_end_date date,
  additional_amount numeric(14,2) DEFAULT 0.00,
  justification text NOT NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amendments_contract ON public.contract_amendments (contract_id);

-- 5. Itens do Contrato
CREATE TABLE IF NOT EXISTS public.contract_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  item_code text NOT NULL, -- Ex: 1-1, 3-6, 19-5
  item_group text,         -- Lote ou grupo licitado
  description text NOT NULL,
  category text NOT NULL DEFAULT 'MATERIAL_CONSUMO',
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

CREATE INDEX IF NOT EXISTS idx_contract_items_contract ON public.contract_items (contract_id);

-- 6. Adição de Colunas em Supply Orders para Apoio aos Contratos e Assinatura
ALTER TABLE public.supply_orders 
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS delivery_deadline text DEFAULT '15 DIAS CORRIDOS',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'CONFIRMADA',
  ADD COLUMN IF NOT EXISTS signed_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supply_orders_contract ON public.supply_orders (contract_id);

-- 7. Itens Solicitados na Ordem de Fornecimento
CREATE TABLE IF NOT EXISTS public.supply_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_order_id uuid NOT NULL REFERENCES public.supply_orders(id) ON DELETE CASCADE,
  contract_item_id uuid NOT NULL REFERENCES public.contract_items(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL,
  unit_price numeric(14,4) NOT NULL,
  total_price numeric(14,2) NOT NULL,
  delivered_quantity numeric(12,3) DEFAULT 0.000,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_so_item UNIQUE (supply_order_id, contract_item_id)
);

CREATE INDEX IF NOT EXISTS idx_so_items_order ON public.supply_order_items (supply_order_id);
CREATE INDEX IF NOT EXISTS idx_so_items_contract_item ON public.supply_order_items (contract_item_id);

-- 8. Movimentações Contratuais Auditáveis de Saldo
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
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_item ON public.contract_item_movements (contract_item_id);
CREATE INDEX IF NOT EXISTS idx_movements_order ON public.contract_item_movements (supply_order_id);

-- 9. Views Analíticas (ordem segura com CASCADE)
DROP VIEW IF EXISTS public.v_contracts CASCADE;
DROP VIEW IF EXISTS public.v_contract_items CASCADE;

CREATE VIEW public.v_contract_items
WITH (security_invoker = true)
AS
SELECT
  ci.*,
  COALESCE((
    SELECT SUM(m.quantity)
    FROM public.contract_item_movements m
    JOIN public.supply_orders so ON so.id = m.supply_order_id
    WHERE m.contract_item_id = ci.id
      AND m.movement_type = 'RESERVA'
      AND so.status = 'AGUARDANDO_ASSINATURA'
  ), 0)::numeric(12,3) AS reserved_quantity,
  COALESCE((
    SELECT SUM(CASE WHEN m.movement_type = 'BAIXA' THEN m.quantity WHEN m.movement_type = 'ESTORNO' THEN -m.quantity ELSE 0 END)
    FROM public.contract_item_movements m
    WHERE m.contract_item_id = ci.id
      AND m.movement_type IN ('BAIXA', 'ESTORNO')
  ), 0)::numeric(12,3) AS requested_quantity,
  (
    ci.current_quantity - 
    COALESCE((
      SELECT SUM(m.quantity)
      FROM public.contract_item_movements m
      JOIN public.supply_orders so ON so.id = m.supply_order_id
      WHERE m.contract_item_id = ci.id
        AND m.movement_type = 'RESERVA'
        AND so.status = 'AGUARDANDO_ASSINATURA'
    ), 0) -
    COALESCE((
      SELECT SUM(CASE WHEN m.movement_type = 'BAIXA' THEN m.quantity WHEN m.movement_type = 'ESTORNO' THEN -m.quantity ELSE 0 END)
      FROM public.contract_item_movements m
      WHERE m.contract_item_id = ci.id
        AND m.movement_type IN ('BAIXA', 'ESTORNO')
    ), 0)
  )::numeric(12,3) AS available_quantity
FROM public.contract_items ci;

CREATE VIEW public.v_contracts
WITH (security_invoker = true)
AS
SELECT
  c.*,
  s.name AS supplier_name,
  s.cnpj AS supplier_cnpj,
  s.legal_name AS supplier_legal_name,
  s.is_simples_nacional AS supplier_is_simples_nacional,
  pp.bidding_number,
  pp.modality AS procurement_modality,
  pp.process_number AS procurement_process_number,
  cb.full_name AS created_by_name,
  (SELECT COUNT(*) FROM public.contract_items ci WHERE ci.contract_id = c.id)::int AS items_count,
  COALESCE((SELECT SUM(vci.requested_quantity * vci.unit_price) FROM public.v_contract_items vci WHERE vci.contract_id = c.id), 0)::numeric(14,2) AS requested_amount,
  (c.total_amount - COALESCE((SELECT SUM(vci.requested_quantity * vci.unit_price) FROM public.v_contract_items vci WHERE vci.contract_id = c.id), 0))::numeric(14,2) AS remaining_amount,
  CASE
    WHEN c.status = 'SUSPENSO' THEN 'SUSPENSO'
    WHEN c.status = 'RESCINDIDO' THEN 'RESCINDIDO'
    WHEN c.status = 'ENCERRADO' THEN 'ENCERRADO'
    WHEN c.end_date < CURRENT_DATE THEN 'VENCIDO'
    WHEN c.end_date <= CURRENT_DATE + interval '30 days' THEN 'PROXIMO_VENCIMENTO'
    ELSE c.status
  END AS computed_status,
  (c.end_date - CURRENT_DATE)::int AS days_to_expire
FROM public.contracts c
JOIN public.suppliers s ON s.id = c.supplier_id
LEFT JOIN public.procurement_processes pp ON pp.id = c.procurement_id
LEFT JOIN public.profiles cb ON cb.id = c.created_by;

DO $$
BEGIN
  GRANT SELECT ON public.destinations, public.procurement_processes, public.contracts,
                  public.contract_amendments, public.contract_items, public.supply_order_items,
                  public.contract_item_movements, public.v_contract_items, public.v_contracts
    TO authenticated;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
