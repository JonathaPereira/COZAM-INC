-- Migração: Correção de retorno de saldo contratual ao excluir Ordem de Fornecimento
-- 1. Remove movimentações órfãs de ordens excluídas (onde supply_order_id é nulo ou não existe mais na tabela supply_orders)
DELETE FROM public.contract_item_movements
WHERE supply_order_id IS NULL AND movement_type IN ('RESERVA', 'BAIXA', 'LIBERACAO', 'ESTORNO');

DELETE FROM public.contract_item_movements
WHERE supply_order_id IS NOT NULL AND supply_order_id NOT IN (SELECT id FROM public.supply_orders);

-- 2. Atualiza a foreign key de contract_item_movements para ON DELETE CASCADE
ALTER TABLE public.contract_item_movements
  DROP CONSTRAINT IF EXISTS contract_item_movements_supply_order_id_fkey;

ALTER TABLE public.contract_item_movements
  ADD CONSTRAINT contract_item_movements_supply_order_id_fkey
  FOREIGN KEY (supply_order_id)
  REFERENCES public.supply_orders(id)
  ON DELETE CASCADE;

-- 3. Atualiza as views analíticas v_contracts e v_contract_items para vincular movimentações às ordens existentes
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
    JOIN public.supply_orders so ON so.id = m.supply_order_id
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
      JOIN public.supply_orders so ON so.id = m.supply_order_id
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
  GRANT SELECT ON public.v_contract_items, public.v_contracts TO authenticated;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
