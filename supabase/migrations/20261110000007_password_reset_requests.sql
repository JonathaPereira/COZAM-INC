-- ===========================================================================
-- Migração 007: Solicitações de Redefinição de Senha Autorizadas pelo Admin
-- Soluciona o cenário de e-mails institucionais fictícios usados como login
-- ===========================================================================

create table if not exists public.password_reset_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  email               text not null,
  full_name           text not null,
  role                text not null,
  status              text not null default 'PENDENTE' check (status in ('PENDENTE', 'APROVADA', 'REJEITADA')),
  request_reason      text,
  proposed_password   text,
  admin_notes         text,
  temporary_password  text,
  approved_by         uuid references public.profiles(id),
  approved_by_name    text,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

create index if not exists pwd_requests_status_idx on public.password_reset_requests (status);
create index if not exists pwd_requests_user_idx on public.password_reset_requests (user_id);
create index if not exists pwd_requests_email_idx on public.password_reset_requests (lower(trim(email)));
create index if not exists pwd_requests_created_idx on public.password_reset_requests (created_at desc);

-- RLS: Habilitado por padrão
alter table public.password_reset_requests enable row level security;

-- Política de leitura: administradores podem ler tudo; service_role lê tudo
drop policy if exists pwd_requests_admin_select on public.password_reset_requests;
create policy pwd_requests_admin_select on public.password_reset_requests
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Política de modificação: apenas administradores
drop policy if exists pwd_requests_admin_update on public.password_reset_requests;
create policy pwd_requests_admin_update on public.password_reset_requests
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
