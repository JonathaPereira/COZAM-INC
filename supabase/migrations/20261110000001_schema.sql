-- =============================================================================
-- COZAM — Sistema Integrado de Compras e Pagamentos
-- Migration 001: esquema principal (tipos, tabelas, restrições e índices)
--
-- Convenções:
--   * Valores monetários: numeric(14,2) — nunca float.
--   * Nenhum registro financeiro é apagado: cancelamentos são lógicos.
--   * Arquivos ficam no Supabase Storage; aqui guardamos apenas referências.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'pagamentos', 'admin_secundario');

-- Apenas duas modalidades existem (regra de negócio nº 5).
create type public.payment_modality as enum ('FUMIP', 'COMPRA_COMPARTILHADA');

-- Situação financeira da NF — SEMPRE derivada por trigger, nunca gravada à mão.
create type public.invoice_status as enum (
  'AGUARDANDO_PAGAMENTO',
  'PARCIALMENTE_PAGA',
  'TOTALMENTE_PAGA',
  'CANCELADA',
  'NAO_VERIFICADA'
);

-- Situação do fluxo documental Compras -> Pagamentos.
create type public.forward_status as enum ('RASCUNHO', 'ENCAMINHADA', 'EM_ATENDIMENTO');

create type public.process_status as enum ('EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

create type public.payment_status as enum ('VALIDO', 'CANCELADO');

create type public.document_kind as enum ('OF', 'NF', 'COMPROVANTE');

-- Situação informada em levantamentos de pendências históricas.
create type public.historical_report_status as enum (
  'SEM_INFORMACAO',
  'PENDENTE',
  'PARCIALMENTE_PAGA',
  'PAGA'
);

-- ---------------------------------------------------------------------------
-- Perfis de usuário (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete restrict,
  full_name         text not null check (length(trim(full_name)) > 0),
  email             text not null,
  role              public.user_role not null default 'pagamentos',
  -- Permissões adicionais (preparado para o Administrador Secundário).
  extra_permissions text[] not null default '{}',
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index profiles_email_uk on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Fornecedores
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  legal_name    text,
  cnpj          text,
  display_order integer not null default 100,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index suppliers_name_uk on public.suppliers (upper(trim(name)));

-- ---------------------------------------------------------------------------
-- Processos administrativos
-- ---------------------------------------------------------------------------
create table public.administrative_processes (
  id             uuid primary key default gen_random_uuid(),
  process_number text not null check (length(trim(process_number)) > 0),
  registered_at  date not null default current_date,
  description    text not null check (length(trim(description)) > 0),
  status         public.process_status not null default 'EM_ANDAMENTO',
  notes          text,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id),
  updated_at     timestamptz not null default now()
);
create unique index processes_number_uk on public.administrative_processes (upper(trim(process_number)));
create index processes_registered_idx on public.administrative_processes (registered_at desc);

-- ---------------------------------------------------------------------------
-- Ordens de Fornecimento (cada OF pertence a UM fornecedor)
-- O número da OF é controle interno de Compras e não é único.
-- ---------------------------------------------------------------------------
create table public.supply_orders (
  id           uuid primary key default gen_random_uuid(),
  process_id   uuid not null references public.administrative_processes (id) on delete restrict,
  supplier_id  uuid not null references public.suppliers (id) on delete restrict,
  of_number    text not null check (length(trim(of_number)) > 0),
  issue_date   date not null,
  total_value  numeric(14, 2) check (total_value is null or total_value >= 0),
  notes        text,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id),
  updated_at   timestamptz not null default now()
);
create index supply_orders_process_idx on public.supply_orders (process_id);
create index supply_orders_supplier_idx on public.supply_orders (supplier_id);

-- ---------------------------------------------------------------------------
-- Notas Fiscais
-- ---------------------------------------------------------------------------
create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  supply_order_id  uuid references public.supply_orders (id) on delete restrict,
  process_id       uuid references public.administrative_processes (id) on delete restrict,
  supplier_id      uuid not null references public.suppliers (id) on delete restrict,
  invoice_number   text not null check (length(trim(invoice_number)) > 0),
  issue_date       date,
  -- Valor efetivamente documentado na NF. Nulo apenas em pendência histórica
  -- ainda não verificada (valor desconhecido).
  amount           numeric(14, 2) check (amount is null or amount > 0),
  modality         public.payment_modality,
  -- Comentário/observação de Compras (opcional, visível para Pagamentos).
  notes            text,

  -- Pendências históricas
  is_historical     boolean not null default false,
  verified          boolean not null default true,
  historical_source text,

  -- Campos financeiros mantidos por trigger
  total_paid       numeric(14, 2) not null default 0,
  status           public.invoice_status not null default 'AGUARDANDO_PAGAMENTO',

  -- Fluxo documental
  forward_status   public.forward_status not null default 'RASCUNHO',
  forwarded_at     timestamptz,
  forwarded_by     uuid references public.profiles (id),
  attended_at      timestamptz,
  attended_by      uuid references public.profiles (id),

  -- Cancelamento autorizado
  cancelled_at     timestamptz,
  cancelled_by     uuid references public.profiles (id),
  cancel_reason    text,

  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,

  -- NF regular exige OF, data de emissão, modalidade e valor.
  constraint invoices_regular_required check (
    is_historical
    or (supply_order_id is not null and issue_date is not null and modality is not null and amount is not null)
  ),
  -- Somente pendências históricas podem estar "não verificadas".
  constraint invoices_verified_only_historical check (verified or is_historical),
  -- NF verificada precisa de valor conhecido.
  constraint invoices_verified_amount check (not verified or amount is not null),
  constraint invoices_paid_range check (total_paid >= 0 and (amount is null or total_paid <= amount)),
  constraint invoices_cancel_consistency check ((cancelled_at is null) = (cancel_reason is null))
);

-- Proteção contra duplicidade: número da NF é único por fornecedor
-- (notas canceladas não bloqueiam um novo cadastro).
create unique index invoices_supplier_number_uk
  on public.invoices (supplier_id, upper(trim(invoice_number)))
  where cancelled_at is null;

create index invoices_supply_order_idx on public.invoices (supply_order_id);
create index invoices_process_idx on public.invoices (process_id);
create index invoices_supplier_idx on public.invoices (supplier_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_forward_idx on public.invoices (forward_status);
create index invoices_issue_date_idx on public.invoices (issue_date desc);
create index invoices_modality_idx on public.invoices (modality);

-- ---------------------------------------------------------------------------
-- Pagamentos (cada pagamento pertence a UMA NF; nunca são apagados)
-- ---------------------------------------------------------------------------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references public.invoices (id) on delete restrict,
  amount            numeric(14, 2) not null check (amount > 0),
  payment_date      date,
  notes             text,
  -- Pagamento informado em levantamento histórico (data pode ser desconhecida).
  is_historical     boolean not null default false,
  informed_by       text,
  status            public.payment_status not null default 'VALIDO',
  -- Idempotência: impede registro duplicado por duplo clique/reenvio.
  client_request_id uuid unique,
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles (id),
  updated_at        timestamptz not null default now(),
  edit_reason       text,
  cancelled_at      timestamptz,
  cancelled_by      uuid references public.profiles (id),
  cancel_reason     text,
  version           integer not null default 1,

  constraint payments_date_required check (is_historical or payment_date is not null),
  constraint payments_cancel_consistency check (
    (status = 'CANCELADO') = (cancelled_at is not null)
    and (cancelled_at is null) = (cancel_reason is null)
  )
);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_date_idx on public.payments (payment_date desc);
create index payments_status_idx on public.payments (status);

-- ---------------------------------------------------------------------------
-- Documentos (referências ao Supabase Storage, com versionamento)
-- ---------------------------------------------------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  kind            public.document_kind not null,
  supply_order_id uuid references public.supply_orders (id) on delete restrict,
  invoice_id      uuid references public.invoices (id) on delete restrict,
  payment_id      uuid references public.payments (id) on delete restrict,
  storage_path    text not null unique,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  sha256          text not null,
  version         integer not null default 1,
  is_current      boolean not null default true,
  uploaded_by     uuid not null references public.profiles (id),
  uploaded_at     timestamptz not null default now(),
  replaced_at     timestamptz,
  replaced_by     uuid references public.profiles (id),
  replace_reason  text,

  constraint documents_single_owner check (num_nonnulls(supply_order_id, invoice_id, payment_id) = 1),
  constraint documents_kind_owner check (
    (kind = 'OF' and supply_order_id is not null)
    or (kind = 'NF' and invoice_id is not null)
    or (kind = 'COMPROVANTE' and payment_id is not null)
  )
);
create unique index documents_current_of_uk on public.documents (supply_order_id) where is_current and kind = 'OF';
create unique index documents_current_nf_uk on public.documents (invoice_id) where is_current and kind = 'NF';
create unique index documents_current_receipt_uk on public.documents (payment_id) where is_current and kind = 'COMPROVANTE';
create index documents_invoice_idx on public.documents (invoice_id);
create index documents_supply_order_idx on public.documents (supply_order_id);
create index documents_payment_idx on public.documents (payment_id);

-- ---------------------------------------------------------------------------
-- Levantamentos de pendências históricas (quem informou o quê, e quando)
-- ---------------------------------------------------------------------------
create table public.historical_statuses (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references public.invoices (id) on delete restrict,
  reported_status   public.historical_report_status not null,
  known_paid_amount numeric(14, 2) check (known_paid_amount is null or known_paid_amount >= 0),
  informed_by       text not null check (length(trim(informed_by)) > 0),
  notes             text,
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now()
);
create index historical_statuses_invoice_idx on public.historical_statuses (invoice_id);

-- ---------------------------------------------------------------------------
-- Auditoria (somente inserção)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_id       uuid,
  actor_name     text,
  actor_role     text,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  invoice_id     uuid,
  summary        text,
  reason         text,
  changed_fields text[],
  old_data       jsonb,
  new_data       jsonb,
  request_id     text
);
create index audit_logs_occurred_idx on public.audit_logs (occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_invoice_idx on public.audit_logs (invoice_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
