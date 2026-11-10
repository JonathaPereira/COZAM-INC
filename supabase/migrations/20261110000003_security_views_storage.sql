-- =============================================================================
-- Migration 003: visões de consulta, segurança (RLS), Storage e dados iniciais
--
-- Modelo de segurança:
--   * Toda ESCRITA passa pela API (servidor), que valida permissões e grava
--     dentro de transações com o contexto do usuário (app.actor_id).
--   * Usuários autenticados via chave pública (anon) só conseguem LER o que a
--     sua função permite (RLS). Não existem políticas de INSERT/UPDATE/DELETE
--     para os papéis "anon" e "authenticated".
--   * O bucket de documentos é privado e sem políticas públicas: arquivos só
--     são entregues pela API, após checagem de permissão.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Funções auxiliares de autorização
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active;
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- NF visível para a função atual (Pagamentos só enxerga NFs encaminhadas ou históricas).
create or replace function public.can_view_invoice(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_user_role() in ('admin', 'admin_secundario') then true
    when public.current_user_role() = 'pagamentos' then exists (
      select 1 from public.invoices i
       where i.id = p_invoice_id and (i.forward_status <> 'RASCUNHO' or i.is_historical)
    )
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.suppliers               enable row level security;
alter table public.administrative_processes enable row level security;
alter table public.supply_orders           enable row level security;
alter table public.invoices                enable row level security;
alter table public.payments                enable row level security;
alter table public.documents               enable row level security;
alter table public.historical_statuses     enable row level security;
alter table public.audit_logs              enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy suppliers_select on public.suppliers for select to authenticated
  using (public.is_active_user());

create policy processes_select on public.administrative_processes for select to authenticated
  using (public.is_active_user());

create policy supply_orders_select on public.supply_orders for select to authenticated
  using (public.is_active_user());

create policy invoices_select on public.invoices for select to authenticated
  using (public.can_view_invoice(id));

create policy payments_select on public.payments for select to authenticated
  using (public.can_view_invoice(invoice_id));

create policy documents_select on public.documents for select to authenticated
  using (
    public.is_active_user() and (
      (invoice_id is not null and public.can_view_invoice(invoice_id))
      or (payment_id is not null and public.can_view_invoice((select p.invoice_id from public.payments p where p.id = payment_id)))
      or (supply_order_id is not null and (
        public.current_user_role() in ('admin', 'admin_secundario')
        or exists (select 1 from public.invoices i where i.supply_order_id = documents.supply_order_id and public.can_view_invoice(i.id))
      ))
    )
  );

create policy historical_select on public.historical_statuses for select to authenticated
  using (public.can_view_invoice(invoice_id));

create policy audit_select on public.audit_logs for select to authenticated
  using (public.is_admin());

-- Nenhuma permissão de escrita para clientes diretos.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;

-- Funções de negócio não devem ser chamadas diretamente pelos clientes.
revoke execute on function public.compute_invoice_status(timestamptz, boolean, numeric, numeric) from public;
revoke execute on function public.handle_new_auth_user() from public;

-- ---------------------------------------------------------------------------
-- Visões de consulta (respeitam a RLS do usuário que consulta)
-- ---------------------------------------------------------------------------
create view public.v_invoices
with (security_invoker = true)
as
select
  i.*,
  case when i.amount is null then null else i.amount - i.total_paid end as balance,
  s.name               as supplier_name,
  s.display_order      as supplier_order,
  so.of_number,
  so.issue_date        as of_issue_date,
  ap.process_number,
  ap.description       as process_description,
  cb.full_name         as created_by_name,
  fb.full_name         as forwarded_by_name,
  ab.full_name         as attended_by_name,
  xb.full_name         as cancelled_by_name,
  (select d.id from public.documents d where d.invoice_id = i.id and d.kind = 'NF' and d.is_current) as nf_document_id,
  (select d.id from public.documents d where d.supply_order_id = i.supply_order_id and d.kind = 'OF' and d.is_current) as of_document_id,
  (select max(p.payment_date) from public.payments p where p.invoice_id = i.id and p.status = 'VALIDO') as last_payment_date,
  (select count(*) from public.payments p where p.invoice_id = i.id and p.status = 'VALIDO')::int as payments_count
from public.invoices i
join public.suppliers s on s.id = i.supplier_id
left join public.supply_orders so on so.id = i.supply_order_id
left join public.administrative_processes ap on ap.id = i.process_id
left join public.profiles cb on cb.id = i.created_by
left join public.profiles fb on fb.id = i.forwarded_by
left join public.profiles ab on ab.id = i.attended_by
left join public.profiles xb on xb.id = i.cancelled_by;

create view public.v_payments
with (security_invoker = true)
as
select
  p.*,
  i.invoice_number,
  i.supplier_id,
  i.modality,
  i.process_id,
  i.is_historical as invoice_is_historical,
  s.name           as supplier_name,
  ap.process_number,
  cb.full_name     as created_by_name,
  ub.full_name     as updated_by_name,
  xb.full_name     as cancelled_by_name,
  (select d.id from public.documents d where d.payment_id = p.id and d.kind = 'COMPROVANTE' and d.is_current) as receipt_document_id
from public.payments p
join public.invoices i on i.id = p.invoice_id
join public.suppliers s on s.id = i.supplier_id
left join public.administrative_processes ap on ap.id = i.process_id
left join public.profiles cb on cb.id = p.created_by
left join public.profiles ub on ub.id = p.updated_by
left join public.profiles xb on xb.id = p.cancelled_by;

create view public.v_processes
with (security_invoker = true)
as
select
  ap.*,
  cb.full_name as created_by_name,
  (select count(*) from public.supply_orders so where so.process_id = ap.id)::int as supply_orders_count,
  (select count(*) from public.invoices i where i.process_id = ap.id and i.cancelled_at is null)::int as invoices_count,
  (select coalesce(sum(i.amount), 0) from public.invoices i where i.process_id = ap.id and i.cancelled_at is null and i.verified) as invoices_total,
  (select coalesce(sum(i.total_paid), 0) from public.invoices i where i.process_id = ap.id and i.cancelled_at is null and i.verified) as paid_total,
  (select coalesce(array_agg(distinct s.name order by s.name), '{}')
     from public.supply_orders so join public.suppliers s on s.id = so.supplier_id
    where so.process_id = ap.id) as supplier_names
from public.administrative_processes ap
left join public.profiles cb on cb.id = ap.created_by;

grant select on public.v_invoices, public.v_payments, public.v_processes to authenticated;

-- ---------------------------------------------------------------------------
-- Supabase Storage: bucket privado para documentos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  20971520, -- 20 MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Dados iniciais reais: os dois fornecedores ativos do consórcio.
-- MZ Bernardi aparece primeiro nas listas (display_order = 1).
-- ---------------------------------------------------------------------------
insert into public.suppliers (name, display_order)
values ('MZ Bernardi', 1), ('Nacional', 2)
on conflict do nothing;
