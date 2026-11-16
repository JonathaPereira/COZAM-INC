-- =============================================================================
-- Migration: Suporte a anexo de Nota de Empenho nas Ordens de Fornecimento
-- (Material Elétrico, Materiais de Uso do COZAM e Despesas Diretas)
-- =============================================================================
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_kind_owner,
  ADD CONSTRAINT documents_kind_owner CHECK (
    (kind IN ('OF', 'EMPENHO') AND supply_order_id IS NOT NULL)
    OR (kind = 'NF' AND invoice_id IS NOT NULL)
    OR (kind = 'COMPROVANTE' AND payment_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS documents_current_empenho_uk
  ON public.documents (supply_order_id)
  WHERE is_current AND kind = 'EMPENHO';

ALTER TABLE public.supply_orders
  ADD COLUMN IF NOT EXISTS empenho_number text;
