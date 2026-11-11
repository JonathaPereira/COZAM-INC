-- ===========================================================================
-- Migração 006: Permitir exclusão de Ordem de Fornecimento + Notas Fiscais vinculadas,
-- remover bloqueio incondicional em pagamentos e garantir integridade em cascata
-- ===========================================================================

-- 1. Remover trigger de bloqueio incondicional em payments se ainda existir
drop trigger if exists no_delete_payments on public.payments;

-- 2. Trigger refinada para pagamentos: impede exclusão apenas se status = 'VALIDO'
create or replace function public.tg_check_payment_delete()
returns trigger
language plpgsql
as $$
begin
  if OLD.status = 'VALIDO' then
    raise exception 'Impossível excluir pagamento válido. Cancele ou estorne o pagamento antes de excluir o lançamento.'
      using errcode = '42501';
  end if;
  return OLD;
end;
$$;

drop trigger if exists check_payment_delete on public.payments;
create trigger check_payment_delete
  before delete on public.payments
  for each row execute function public.tg_check_payment_delete();

-- 3. Atualizar trigger de Ordens de Fornecimento:
-- Permite exclusão de OF mesmo com NFs vinculadas (exclusão de Ordem + Notas mandadas pro pagamento),
-- desde que nenhuma das NFs vinculadas possua pagamentos válidos confirmados.
create or replace function public.tg_check_supply_order_delete()
returns trigger
language plpgsql
as $$
declare
  v_paid_count int;
begin
  select count(*) into v_paid_count
  from public.payments p
  join public.invoices i on i.id = p.invoice_id
  where i.supply_order_id = OLD.id and p.status = 'VALIDO';

  if v_paid_count > 0 then
    raise exception 'Impossível excluir Ordem de Fornecimento com Notas Fiscais que possuem pagamentos registrados. Cancele os pagamentos antes de excluir.'
      using errcode = '42501';
  end if;

  return OLD;
end;
$$;

drop trigger if exists check_supply_order_delete on public.supply_orders;
create trigger check_supply_order_delete
  before delete on public.supply_orders
  for each row execute function public.tg_check_supply_order_delete();

-- 4. Foreign Keys seguras com CASCADE para permitir exclusão limpa
-- (invoices vinculadas à OF podem ser cascateadas ou removidas em conjunto)
alter table public.invoices
  drop constraint if exists invoices_supply_order_id_fkey,
  add constraint invoices_supply_order_id_fkey
    foreign key (supply_order_id)
    references public.supply_orders(id)
    on delete cascade;

alter table public.documents
  drop constraint if exists documents_supply_order_id_fkey,
  add constraint documents_supply_order_id_fkey
    foreign key (supply_order_id)
    references public.supply_orders(id)
    on delete cascade;

alter table public.documents
  drop constraint if exists documents_invoice_id_fkey,
  add constraint documents_invoice_id_fkey
    foreign key (invoice_id)
    references public.invoices(id)
    on delete cascade;

alter table public.documents
  drop constraint if exists documents_payment_id_fkey,
  add constraint documents_payment_id_fkey
    foreign key (payment_id)
    references public.payments(id)
    on delete cascade;

alter table public.payments
  drop constraint if exists payments_invoice_id_fkey,
  add constraint payments_invoice_id_fkey
    foreign key (invoice_id)
    references public.invoices(id)
    on delete cascade;

alter table public.historical_statuses
  drop constraint if exists historical_statuses_invoice_id_fkey,
  add constraint historical_statuses_invoice_id_fkey
    foreign key (invoice_id)
    references public.invoices(id)
    on delete cascade;
