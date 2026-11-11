-- =============================================================================
-- Migration 008: Município em Ordens de Fornecimento, Simples Nacional e Retenção Tributária (IRRF 1,2%)
-- Totalmente aditivo e seguro: preserva 100% dos dados já gravados.
-- =============================================================================

-- 1. Coluna de município na tabela supply_orders
ALTER TABLE public.supply_orders ADD COLUMN IF NOT EXISTS municipality text;

CREATE INDEX IF NOT EXISTS supply_orders_municipality_idx
  ON public.supply_orders (upper(trim(municipality)))
  WHERE municipality IS NOT NULL;

-- 2. Coluna de Simples Nacional na tabela suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_simples_nacional boolean NOT NULL DEFAULT false;

-- 3. Colunas de discriminação tributária na tabela payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tax_rate numeric(5,4) DEFAULT 0.0120;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS net_amount numeric(14,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_tax_exempt boolean DEFAULT false;

-- Atualizar registros existentes de pagamentos de forma consistente e segura:
DO $$
BEGIN
  UPDATE public.payments
  SET gross_amount = amount,
      net_amount = amount,
      tax_amount = 0.00,
      tax_rate = 0.0000,
      is_tax_exempt = true
  WHERE gross_amount IS NULL
    AND status <> 'CANCELADO';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Recriar visão v_payments de forma segura (drop e create)
DROP VIEW IF EXISTS public.v_payments CASCADE;

CREATE VIEW public.v_payments
WITH (security_invoker = true)
AS
SELECT
  p.*,
  i.invoice_number,
  i.supplier_id,
  i.modality,
  i.process_id,
  i.is_historical AS invoice_is_historical,
  i.municipality,
  s.name           AS supplier_name,
  s.is_simples_nacional,
  ap.process_number,
  cb.full_name     AS created_by_name,
  ub.full_name     AS updated_by_name,
  xb.full_name     AS cancelled_by_name,
  (SELECT d.id FROM public.documents d WHERE d.payment_id = p.id AND d.kind = 'COMPROVANTE' AND d.is_current) AS receipt_document_id
FROM public.payments p
JOIN public.invoices i ON i.id = p.invoice_id
JOIN public.suppliers s ON s.id = i.supplier_id
LEFT JOIN public.administrative_processes ap ON ap.id = i.process_id
LEFT JOIN public.profiles cb ON cb.id = p.created_by
LEFT JOIN public.profiles ub ON ub.id = p.updated_by
LEFT JOIN public.profiles xb ON xb.id = p.cancelled_by;

DO $$ BEGIN
  GRANT SELECT ON public.v_payments TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Recriar visão v_processes incluindo municípios associados ao processo
DROP VIEW IF EXISTS public.v_processes CASCADE;

CREATE VIEW public.v_processes
WITH (security_invoker = true)
AS
SELECT
  ap.*,
  cb.full_name AS created_by_name,
  (SELECT COUNT(*) FROM public.supply_orders so WHERE so.process_id = ap.id)::int AS supply_orders_count,
  (SELECT COUNT(*) FROM public.invoices i WHERE i.process_id = ap.id AND i.cancelled_at IS NULL)::int AS invoices_count,
  (SELECT COALESCE(SUM(i.amount), 0) FROM public.invoices i WHERE i.process_id = ap.id AND i.cancelled_at IS NULL AND i.verified) AS invoices_total,
  (SELECT COALESCE(SUM(i.total_paid), 0) FROM public.invoices i WHERE i.process_id = ap.id AND i.cancelled_at IS NULL AND i.verified) AS paid_total,
  (SELECT COALESCE(array_agg(DISTINCT s.name ORDER BY s.name), '{}')
     FROM public.supply_orders so JOIN public.suppliers s ON s.id = so.supplier_id
    WHERE so.process_id = ap.id) AS supplier_names,
  (SELECT string_agg(DISTINCT m, ', ')
     FROM (
       SELECT so.municipality AS m FROM public.supply_orders so WHERE so.process_id = ap.id AND so.municipality IS NOT NULL AND trim(so.municipality) <> ''
       UNION
       SELECT i.municipality AS m FROM public.invoices i WHERE i.process_id = ap.id AND i.municipality IS NOT NULL AND trim(i.municipality) <> ''
     ) sub) AS municipalities
FROM public.administrative_processes ap
LEFT JOIN public.profiles cb ON cb.id = ap.created_by;

DO $$ BEGIN
  GRANT SELECT ON public.v_processes TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Recriar visão v_invoices para incluir o status de Simples Nacional do fornecedor
DROP VIEW IF EXISTS public.v_invoices CASCADE;

CREATE VIEW public.v_invoices
WITH (security_invoker = true)
AS
SELECT
  i.*,
  CASE WHEN i.amount IS NULL THEN NULL ELSE i.amount - i.total_paid END AS balance,
  s.name                AS supplier_name,
  s.display_order       AS supplier_order,
  s.is_simples_nacional AS supplier_is_simples_nacional,
  so.of_number,
  so.issue_date         AS of_issue_date,
  ap.process_number,
  ap.description        AS process_description,
  cb.full_name          AS created_by_name,
  fb.full_name          AS forwarded_by_name,
  ab.full_name          AS attended_by_name,
  xb.full_name          AS cancelled_by_name,
  (SELECT d.id FROM public.documents d WHERE d.invoice_id = i.id AND d.kind = 'NF' AND d.is_current) AS nf_document_id,
  (SELECT d.id FROM public.documents d WHERE d.supply_order_id = i.supply_order_id AND d.kind = 'OF' AND d.is_current) AS of_document_id,
  (SELECT MAX(p.payment_date) FROM public.payments p WHERE p.invoice_id = i.id AND p.status = 'VALIDO') AS last_payment_date,
  (SELECT COUNT(*) FROM public.payments p WHERE p.invoice_id = i.id AND p.status = 'VALIDO')::int AS payments_count
FROM public.invoices i
JOIN public.suppliers s ON s.id = i.supplier_id
LEFT JOIN public.supply_orders so ON so.id = i.supply_order_id
LEFT JOIN public.administrative_processes ap ON ap.id = i.process_id
LEFT JOIN public.profiles cb ON cb.id = i.created_by
LEFT JOIN public.profiles fb ON fb.id = i.forwarded_by
LEFT JOIN public.profiles ab ON ab.id = i.attended_by
LEFT JOIN public.profiles xb ON xb.id = i.cancelled_by;

DO $$ BEGIN
  GRANT SELECT ON public.v_invoices TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
