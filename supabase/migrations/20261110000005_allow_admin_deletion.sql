-- ===========================================================================
-- Migração 005: Permitir exclusão administrativa auditada de Ordens e Notas
-- Permite exclusão de NFs (sem pagamentos efetivados) e OFs (sem NFs vinculadas)
-- ===========================================================================

-- 1. Remover triggers estritos de bloqueio incondicional em invoices, supply_orders e documents
drop trigger if exists no_delete_invoices on public.invoices;
drop trigger if exists no_delete_supply_orders on public.supply_orders;
drop trigger if exists no_delete_documents on public.documents;
drop trigger if exists no_delete_historical on public.historical_statuses;

-- 2. Trigger de proteção financeira para Notas Fiscais: impede delete se houver pagamento
create or replace function public.tg_check_invoice_delete()
returns trigger
language plpgsql
as $$
declare
  v_paid_count int;
begin
  select count(*) into v_paid_count
  from public.payments
  where invoice_id = OLD.id and status = 'VALIDO';

  if v_paid_count > 0 then
    raise exception 'Impossível excluir Nota Fiscal com pagamentos registrados. Cancele os pagamentos antes da exclusão.'
      using errcode = '42501';
  end if;

  return OLD;
end;
$$;

drop trigger if exists check_invoice_delete on public.invoices;
create trigger check_invoice_delete
  before delete on public.invoices
  for each row execute function public.tg_check_invoice_delete();

-- 3. Trigger de proteção para Ordens de Fornecimento: impede delete se houver NFs vinculadas
create or replace function public.tg_check_supply_order_delete()
returns trigger
language plpgsql
as $$
declare
  v_invoices_count int;
begin
  select count(*) into v_invoices_count
  from public.invoices
  where supply_order_id = OLD.id;

  if v_invoices_count > 0 then
    raise exception 'Impossível excluir Ordem de Fornecimento com Notas Fiscais vinculadas. Remova ou desvincule as notas primeiro.'
      using errcode = '42501';
  end if;

  return OLD;
end;
$$;

drop trigger if exists check_supply_order_delete on public.supply_orders;
create trigger check_supply_order_delete
  before delete on public.supply_orders
  for each row execute function public.tg_check_supply_order_delete();
