-- =============================================================================
-- Migration 004: Suporte a Municípios Consorciados nas Notas Fiscais
--
-- Adiciona a coluna municipality na tabela invoices e atualiza a visão v_invoices.
-- Totalmente aditivo: não apaga nem modifica dados existentes.
-- =============================================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS municipality text;

CREATE INDEX IF NOT EXISTS invoices_municipality_idx
  ON public.invoices (upper(trim(municipality)))
  WHERE municipality IS NOT NULL;

-- Recriação da visão v_invoices (drop seguro para evitar erro de reordenação de colunas)
DROP VIEW IF EXISTS public.v_invoices;

CREATE VIEW public.v_invoices
WITH (security_invoker = true)
AS
SELECT
  i.*,
  CASE WHEN i.amount IS NULL THEN NULL ELSE i.amount - i.total_paid END AS balance,
  s.name               AS supplier_name,
  s.display_order      AS supplier_order,
  so.of_number,
  so.issue_date        AS of_issue_date,
  ap.process_number,
  ap.description       AS process_description,
  cb.full_name         AS created_by_name,
  fb.full_name         AS forwarded_by_name,
  ab.full_name         AS attended_by_name,
  xb.full_name         AS cancelled_by_name,
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

GRANT SELECT ON public.v_invoices TO authenticated;
