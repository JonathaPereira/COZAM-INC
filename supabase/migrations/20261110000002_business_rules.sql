-- =============================================================================
-- Migration 002: regras de negócio garantidas pelo banco de dados
--
-- Mesmo que a API tenha um defeito, o banco impede:
--   * pagamento acima do saldo da NF (com bloqueio de linha FOR UPDATE);
--   * NF vinculada a OF de outro fornecedor;
--   * alteração manual de total pago / situação;
--   * encaminhamento sem os PDFs da OF e da NF;
--   * exclusão de registros financeiros, documentos e auditoria.
--
-- Contexto da requisição (definido pela API em cada transação):
--   app.actor_id   -> uuid do usuário autenticado
--   app.reason     -> justificativa da operação (correções/cancelamentos)
--   app.request_id -> identificador da requisição (rastreabilidade)
-- Os erros de negócio usam HINT com um código estável, ex.: 'PAGAMENTO_EXCEDE_SALDO'.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.app_actor()
returns uuid
language plpgsql
stable
as $$
declare
  v text := nullif(current_setting('app.actor_id', true), '');
begin
  if v is not null then
    return v::uuid;
  end if;
  begin
    return auth.uid();
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.app_reason()
returns text
language sql
stable
as $$
  select nullif(trim(current_setting('app.reason', true)), '');
$$;

create or replace function public.brl(v numeric)
returns text
language sql
immutable
as $$
  select 'R$ ' || replace(replace(replace(to_char(coalesce(v, 0), 'FM999G999G999G990D00'), ',', '#'), '.', ','), '#', '.');
$$;

create or replace function public.tg_prevent_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Registros de "%" não podem ser excluídos. Utilize o cancelamento/correção com justificativa.', tg_table_name
    using errcode = '42501', hint = 'EXCLUSAO_PROIBIDA';
end;
$$;

create or replace function public.tg_touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Novo usuário do Supabase Auth => perfil
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'pagamentos';
begin
  begin
    v_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role, 'pagamentos');
  exception when others then
    v_role := 'pagamentos';
  end;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Processos, fornecedores e perfis: updated_at / updated_by
-- ---------------------------------------------------------------------------
create or replace function public.tg_stamp_actor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := public.app_actor();
    end if;
  else
    new.updated_by := coalesce(public.app_actor(), new.updated_by);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger processes_stamp before insert or update on public.administrative_processes
  for each row execute function public.tg_stamp_actor();
create trigger suppliers_touch before update on public.suppliers
  for each row execute function public.tg_touch_updated();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.tg_touch_updated();

-- ---------------------------------------------------------------------------
-- Ordens de Fornecimento
-- ---------------------------------------------------------------------------
create or replace function public.tg_supply_orders_before()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, public.app_actor());
  else
    if new.supplier_id is distinct from old.supplier_id
       and exists (select 1 from public.invoices i where i.supply_order_id = old.id) then
      raise exception 'Não é possível trocar o fornecedor de uma OF que já possui Notas Fiscais vinculadas.'
        using errcode = '23514', hint = 'OF_FORNECEDOR_COM_NOTAS';
    end if;
    new.updated_by := coalesce(public.app_actor(), new.updated_by);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger supply_orders_before before insert or update on public.supply_orders
  for each row execute function public.tg_supply_orders_before();

-- Mantém o processo das NFs alinhado ao processo da OF.
create or replace function public.tg_supply_orders_after()
returns trigger
language plpgsql
as $$
begin
  if new.process_id is distinct from old.process_id then
    update public.invoices set process_id = new.process_id where supply_order_id = new.id;
  end if;
  return null;
end;
$$;

create trigger supply_orders_after after update on public.supply_orders
  for each row execute function public.tg_supply_orders_after();

-- ---------------------------------------------------------------------------
-- Notas Fiscais
-- ---------------------------------------------------------------------------
create or replace function public.compute_invoice_status(
  p_cancelled_at timestamptz,
  p_verified boolean,
  p_amount numeric,
  p_total_paid numeric
) returns public.invoice_status
language sql
immutable
as $$
  select case
    when p_cancelled_at is not null then 'CANCELADA'::public.invoice_status
    when not p_verified then 'NAO_VERIFICADA'::public.invoice_status
    when coalesce(p_total_paid, 0) <= 0 then 'AGUARDANDO_PAGAMENTO'::public.invoice_status
    when p_total_paid < p_amount then 'PARCIALMENTE_PAGA'::public.invoice_status
    else 'TOTALMENTE_PAGA'::public.invoice_status
  end;
$$;

create or replace function public.tg_invoices_before()
returns trigger
language plpgsql
as $$
declare
  v_of record;
  v_internal boolean := pg_trigger_depth() > 1; -- chamada originada por outro trigger
begin
  -- Vínculo com a OF: fornecedor obrigatoriamente igual; processo herdado da OF.
  if new.supply_order_id is not null then
    select so.supplier_id, so.process_id into v_of
      from public.supply_orders so where so.id = new.supply_order_id;
    if not found then
      raise exception 'Ordem de Fornecimento não encontrada.' using errcode = '23503', hint = 'OF_INEXISTENTE';
    end if;
    if v_of.supplier_id <> new.supplier_id then
      raise exception 'A Nota Fiscal deve ser do mesmo fornecedor da Ordem de Fornecimento.'
        using errcode = '23514', hint = 'FORNECEDOR_DIVERGENTE_OF';
    end if;
    new.process_id := v_of.process_id;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, public.app_actor());
    new.total_paid := 0;
    new.version := 1;
    if not new.is_historical and new.forward_status <> 'RASCUNHO' then
      raise exception 'A NF deve ser cadastrada e depois encaminhada.' using errcode = '23514', hint = 'ENCAMINHAMENTO_INVALIDO';
    end if;
    if new.cancelled_at is not null then
      raise exception 'Não é possível cadastrar uma NF já cancelada.' using errcode = '23514', hint = 'CANCELAMENTO_INVALIDO';
    end if;
  else
    -- Campos financeiros só podem ser alterados pelos triggers de pagamento.
    if not v_internal and new.total_paid is distinct from old.total_paid then
      raise exception 'O total pago é calculado automaticamente e não pode ser alterado manualmente.'
        using errcode = '42501', hint = 'TOTAL_PAGO_PROTEGIDO';
    end if;
    if old.cancelled_at is not null and not v_internal then
      raise exception 'Nota Fiscal cancelada não pode ser alterada.' using errcode = '23514', hint = 'NF_CANCELADA';
    end if;
    if new.is_historical is distinct from old.is_historical then
      raise exception 'Não é possível alterar a origem (histórica/regular) da NF.' using errcode = '23514', hint = 'ORIGEM_PROTEGIDA';
    end if;
    if old.verified and not new.verified then
      raise exception 'Uma NF verificada não pode voltar a ser "não verificada".' using errcode = '23514', hint = 'VERIFICACAO_IRREVERSIVEL';
    end if;
    if new.supplier_id is distinct from old.supplier_id and old.total_paid > 0 then
      raise exception 'Não é possível trocar o fornecedor de uma NF com pagamentos registrados.'
        using errcode = '23514', hint = 'NF_FORNECEDOR_COM_PAGAMENTOS';
    end if;
    if new.amount is distinct from old.amount and new.amount is not null and new.amount < new.total_paid then
      raise exception 'O valor da NF (%) não pode ser menor que o total já pago (%).', public.brl(new.amount), public.brl(new.total_paid)
        using errcode = '23514', hint = 'VALOR_MENOR_QUE_PAGO';
    end if;

    -- Cancelamento autorizado: somente sem pagamentos válidos.
    if new.cancelled_at is not null and old.cancelled_at is null then
      if old.total_paid > 0 then
        raise exception 'A NF possui pagamentos válidos. Cancele/estorne os pagamentos antes de cancelar a NF.'
          using errcode = '23514', hint = 'NF_COM_PAGAMENTOS';
      end if;
      new.cancelled_by := coalesce(new.cancelled_by, public.app_actor());
      new.cancel_reason := coalesce(nullif(trim(new.cancel_reason), ''), public.app_reason());
      if new.cancel_reason is null then
        raise exception 'Informe a justificativa do cancelamento.' using errcode = '23514', hint = 'JUSTIFICATIVA_OBRIGATORIA';
      end if;
    end if;

    -- Fluxo de encaminhamento
    if old.forward_status <> 'RASCUNHO' and new.forward_status = 'RASCUNHO' then
      raise exception 'Uma NF encaminhada não pode voltar para rascunho.' using errcode = '23514', hint = 'ENCAMINHAMENTO_IRREVERSIVEL';
    end if;
    if old.forward_status = 'RASCUNHO' and new.forward_status <> 'RASCUNHO' then
      if not new.is_historical then
        if not exists (select 1 from public.documents d where d.invoice_id = new.id and d.kind = 'NF' and d.is_current) then
          raise exception 'Anexe o PDF da Nota Fiscal antes de encaminhar.' using errcode = '23514', hint = 'NF_SEM_PDF';
        end if;
        if not exists (select 1 from public.documents d where d.supply_order_id = new.supply_order_id and d.kind = 'OF' and d.is_current) then
          raise exception 'Anexe o PDF da Ordem de Fornecimento antes de encaminhar.' using errcode = '23514', hint = 'OF_SEM_PDF';
        end if;
      end if;
      new.forwarded_at := coalesce(new.forwarded_at, now());
      new.forwarded_by := coalesce(new.forwarded_by, public.app_actor());
    end if;
    if new.forward_status = 'EM_ATENDIMENTO' and old.forward_status <> 'EM_ATENDIMENTO' then
      new.attended_at := coalesce(new.attended_at, now());
      new.attended_by := coalesce(new.attended_by, public.app_actor());
    end if;

    new.version := old.version + 1;
    if not v_internal then
      new.updated_by := coalesce(public.app_actor(), new.updated_by);
    end if;
    new.updated_at := now();
  end if;

  -- Situação SEMPRE derivada (nunca definida manualmente).
  new.status := public.compute_invoice_status(new.cancelled_at, new.verified, new.amount, new.total_paid);
  return new;
end;
$$;

create trigger invoices_before before insert or update on public.invoices
  for each row execute function public.tg_invoices_before();

-- ---------------------------------------------------------------------------
-- Pagamentos — controle de saldo com bloqueio de concorrência
-- ---------------------------------------------------------------------------
create or replace function public.tg_payments_before()
returns trigger
language plpgsql
as $$
declare
  v_inv public.invoices%rowtype;
  v_others numeric(14, 2);
  v_balance numeric(14, 2);
begin
  if tg_op = 'UPDATE' then
    if new.invoice_id <> old.invoice_id then
      raise exception 'Não é possível transferir um pagamento para outra NF.' using errcode = '23514', hint = 'PAGAMENTO_NF_PROTEGIDA';
    end if;
    if old.status = 'CANCELADO' then
      raise exception 'Pagamento cancelado não pode ser alterado.' using errcode = '23514', hint = 'PAGAMENTO_CANCELADO';
    end if;
    if new.created_by <> old.created_by or new.created_at <> old.created_at or new.is_historical <> old.is_historical then
      raise exception 'Campos de origem do pagamento não podem ser alterados.' using errcode = '23514', hint = 'PAGAMENTO_ORIGEM_PROTEGIDA';
    end if;
  end if;

  -- Bloqueia a NF: pagamentos simultâneos na mesma NF são serializados.
  select * into v_inv from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception 'Nota Fiscal não encontrada.' using errcode = '23503', hint = 'NF_INEXISTENTE';
  end if;

  if new.status = 'VALIDO' then
    if v_inv.cancelled_at is not null then
      raise exception 'Não é possível registrar pagamento em NF cancelada.' using errcode = '23514', hint = 'NF_CANCELADA';
    end if;
    if not v_inv.verified then
      raise exception 'A NF está como "Sem informação / não verificada". Verifique a NF e informe o valor antes de registrar pagamentos.'
        using errcode = '23514', hint = 'NF_NAO_VERIFICADA';
    end if;
    if not v_inv.is_historical and v_inv.forward_status = 'RASCUNHO' then
      raise exception 'A NF ainda não foi encaminhada para Pagamentos.' using errcode = '23514', hint = 'NF_NAO_ENCAMINHADA';
    end if;

    select coalesce(sum(p.amount), 0) into v_others
      from public.payments p
     where p.invoice_id = new.invoice_id and p.status = 'VALIDO' and p.id <> new.id;

    v_balance := v_inv.amount - v_others;
    if new.amount > v_balance then
      raise exception 'O valor do pagamento (%) é superior ao saldo devedor da NF (%).', public.brl(new.amount), public.brl(v_balance)
        using errcode = '23514', hint = 'PAGAMENTO_EXCEDE_SALDO';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'VALIDO' then
      raise exception 'Pagamentos devem ser registrados como válidos.' using errcode = '23514', hint = 'PAGAMENTO_INVALIDO';
    end if;
    new.created_by := coalesce(new.created_by, public.app_actor());
    new.created_at := now();
    new.version := 1;
  else
    if new.status = 'CANCELADO' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.cancelled_by := coalesce(new.cancelled_by, public.app_actor());
      new.cancel_reason := coalesce(nullif(trim(new.cancel_reason), ''), public.app_reason());
      if new.cancel_reason is null then
        raise exception 'Informe a justificativa do cancelamento do pagamento.' using errcode = '23514', hint = 'JUSTIFICATIVA_OBRIGATORIA';
      end if;
    elsif new.amount is distinct from old.amount
       or new.payment_date is distinct from old.payment_date
       or new.notes is distinct from old.notes
       or new.informed_by is distinct from old.informed_by then
      -- A justificativa deve vir da requisição atual (nunca reaproveitar a anterior).
      new.edit_reason := public.app_reason();
      if new.edit_reason is null then
        raise exception 'Informe a justificativa da correção do pagamento.' using errcode = '23514', hint = 'JUSTIFICATIVA_OBRIGATORIA';
      end if;
    end if;
    new.version := old.version + 1;
    new.updated_by := coalesce(public.app_actor(), new.updated_by);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger payments_before before insert or update on public.payments
  for each row execute function public.tg_payments_before();

-- Recalcula total pago / situação da NF após qualquer mudança em pagamentos.
create or replace function public.tg_payments_after()
returns trigger
language plpgsql
as $$
declare
  v_total numeric(14, 2);
begin
  select coalesce(sum(amount), 0) into v_total
    from public.payments where invoice_id = new.invoice_id and status = 'VALIDO';

  update public.invoices
     set total_paid = v_total,
         forward_status = case when forward_status = 'ENCAMINHADA' then 'EM_ATENDIMENTO'::public.forward_status else forward_status end
   where id = new.invoice_id;
  return null;
end;
$$;

create trigger payments_after after insert or update on public.payments
  for each row execute function public.tg_payments_after();

-- ---------------------------------------------------------------------------
-- Documentos — imutáveis, exceto para marcar uma versão como substituída
-- ---------------------------------------------------------------------------
create or replace function public.tg_documents_before()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.uploaded_by := coalesce(new.uploaded_by, public.app_actor());
    new.uploaded_at := now();
    new.is_current := true;
    new.replaced_at := null;
    return new;
  end if;

  if (to_jsonb(new) - array['is_current', 'replaced_at', 'replaced_by', 'replace_reason'])
     is distinct from (to_jsonb(old) - array['is_current', 'replaced_at', 'replaced_by', 'replace_reason']) then
    raise exception 'Documentos anexados não podem ser alterados. Envie uma nova versão.' using errcode = '42501', hint = 'DOCUMENTO_IMUTAVEL';
  end if;
  if not old.is_current or new.is_current then
    raise exception 'Operação de documento inválida.' using errcode = '23514', hint = 'DOCUMENTO_IMUTAVEL';
  end if;
  new.replaced_at := now();
  new.replaced_by := coalesce(new.replaced_by, public.app_actor());
  new.replace_reason := coalesce(nullif(trim(new.replace_reason), ''), public.app_reason());
  return new;
end;
$$;

create trigger documents_before before insert or update on public.documents
  for each row execute function public.tg_documents_before();

-- ---------------------------------------------------------------------------
-- Levantamentos históricos — somente inserção
-- ---------------------------------------------------------------------------
create or replace function public.tg_historical_before()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Levantamentos históricos não podem ser alterados; registre uma nova informação.' using errcode = '42501', hint = 'HISTORICO_IMUTAVEL';
  end if;
  new.created_by := coalesce(new.created_by, public.app_actor());
  new.created_at := now();
  return new;
end;
$$;

create trigger historical_before before insert or update on public.historical_statuses
  for each row execute function public.tg_historical_before();

-- ---------------------------------------------------------------------------
-- Auditoria automática
-- ---------------------------------------------------------------------------
create or replace function public.tg_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := public.app_actor();
  v_name    text;
  v_role    text;
  v_old     jsonb;
  v_new     jsonb;
  v_row     jsonb;
  v_changed text[];
  v_action  text;
  v_summary text;
  v_invoice uuid;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select array_agg(n.key order by n.key) into v_changed
      from jsonb_each(v_new) n
     where n.value is distinct from (v_old -> n.key)
       and n.key not in ('updated_at', 'updated_by', 'version');
    if v_changed is null then
      return null;
    end if;
    -- Recalculo automático disparado por pagamento: já auditado no próprio pagamento.
    if tg_table_name = 'invoices' and pg_trigger_depth() > 1
       and v_changed <@ array['total_paid', 'status', 'forward_status', 'attended_at', 'attended_by', 'process_id'] then
      return null;
    end if;
    -- Marcação de versão substituída: auditada pela inclusão da nova versão.
    if tg_table_name = 'documents' then
      return null;
    end if;
  end if;
  v_row := v_new;

  v_action := case tg_table_name
    when 'administrative_processes' then case when tg_op = 'INSERT' then 'PROCESSO_CADASTRADO' else 'PROCESSO_ALTERADO' end
    when 'supply_orders' then case when tg_op = 'INSERT' then 'OF_CADASTRADA' else 'OF_ALTERADA' end
    when 'invoices' then case
      when tg_op = 'INSERT' and (v_row ->> 'is_historical')::boolean then 'NF_HISTORICA_CADASTRADA'
      when tg_op = 'INSERT' then 'NF_CADASTRADA'
      when v_old ->> 'cancelled_at' is null and v_new ->> 'cancelled_at' is not null then 'NF_CANCELADA'
      when v_old ->> 'forward_status' = 'RASCUNHO' and v_new ->> 'forward_status' <> 'RASCUNHO' then 'NF_ENCAMINHADA'
      when v_old ->> 'forward_status' = 'ENCAMINHADA' and v_new ->> 'forward_status' = 'EM_ATENDIMENTO' then 'NF_ATENDIMENTO_INICIADO'
      when not (v_old ->> 'verified')::boolean and (v_new ->> 'verified')::boolean then 'NF_VERIFICADA'
      else 'NF_ALTERADA' end
    when 'payments' then case
      when tg_op = 'INSERT' then 'PAGAMENTO_REGISTRADO'
      when v_new ->> 'status' = 'CANCELADO' then 'PAGAMENTO_CANCELADO'
      else 'PAGAMENTO_CORRIGIDO' end
    when 'documents' then case when (v_row ->> 'version')::int > 1 then 'DOCUMENTO_SUBSTITUIDO' else 'DOCUMENTO_ANEXADO' end
    when 'historical_statuses' then 'HISTORICO_INFORMADO'
    when 'profiles' then case when tg_op = 'INSERT' then 'USUARIO_CRIADO' else 'USUARIO_ALTERADO' end
    when 'suppliers' then case when tg_op = 'INSERT' then 'FORNECEDOR_CADASTRADO' else 'FORNECEDOR_ALTERADO' end
    else tg_table_name || '_' || lower(tg_op)
  end;

  v_invoice := case tg_table_name
    when 'invoices' then (v_row ->> 'id')::uuid
    when 'payments' then (v_row ->> 'invoice_id')::uuid
    when 'historical_statuses' then (v_row ->> 'invoice_id')::uuid
    when 'documents' then case
      when v_row ->> 'invoice_id' is not null then (v_row ->> 'invoice_id')::uuid
      when v_row ->> 'payment_id' is not null then (select p.invoice_id from public.payments p where p.id = (v_row ->> 'payment_id')::uuid)
      else null end
    else null
  end;

  v_summary := case tg_table_name
    when 'administrative_processes' then 'Processo ' || (v_row ->> 'process_number')
    when 'supply_orders' then 'OF ' || (v_row ->> 'of_number')
    when 'invoices' then 'NF ' || (v_row ->> 'invoice_number')
      || coalesce(' — ' || public.brl((v_row ->> 'amount')::numeric), '')
    when 'payments' then 'Pagamento de ' || public.brl((v_row ->> 'amount')::numeric)
      || coalesce(' em ' || to_char((v_row ->> 'payment_date')::date, 'DD/MM/YYYY'), '')
      || coalesce(' (NF ' || (select i.invoice_number from public.invoices i where i.id = (v_row ->> 'invoice_id')::uuid) || ')', '')
    when 'documents' then (v_row ->> 'kind') || ' — ' || (v_row ->> 'file_name') || ' (versão ' || (v_row ->> 'version') || ')'
    when 'historical_statuses' then 'Situação informada: ' || (v_row ->> 'reported_status') || ' por ' || (v_row ->> 'informed_by')
    when 'profiles' then 'Usuário ' || (v_row ->> 'full_name') || ' (' || (v_row ->> 'role') || ')'
    when 'suppliers' then 'Fornecedor ' || (v_row ->> 'name')
    else null
  end;

  select p.full_name, p.role::text into v_name, v_role from public.profiles p where p.id = v_actor;

  insert into public.audit_logs (
    actor_id, actor_name, actor_role, action, entity_type, entity_id, invoice_id,
    summary, reason, changed_fields, old_data, new_data, request_id
  ) values (
    v_actor, v_name, v_role, v_action, tg_table_name, (v_row ->> 'id')::uuid, v_invoice,
    v_summary, public.app_reason(), v_changed, v_old, v_new, nullif(current_setting('app.request_id', true), '')
  );
  return null;
end;
$$;

create trigger audit_processes after insert or update on public.administrative_processes
  for each row execute function public.tg_audit_row();
create trigger audit_supply_orders after insert or update on public.supply_orders
  for each row execute function public.tg_audit_row();
create trigger audit_invoices after insert or update on public.invoices
  for each row execute function public.tg_audit_row();
create trigger audit_payments after insert or update on public.payments
  for each row execute function public.tg_audit_row();
create trigger audit_documents after insert or update on public.documents
  for each row execute function public.tg_audit_row();
create trigger audit_historical after insert on public.historical_statuses
  for each row execute function public.tg_audit_row();
create trigger audit_profiles after insert or update on public.profiles
  for each row execute function public.tg_audit_row();
create trigger audit_suppliers after insert or update on public.suppliers
  for each row execute function public.tg_audit_row();

-- Auditoria é somente-inserção.
create or replace function public.tg_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'O histórico de auditoria não pode ser alterado ou excluído.' using errcode = '42501', hint = 'AUDITORIA_IMUTAVEL';
end;
$$;

create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.tg_audit_immutable();

-- ---------------------------------------------------------------------------
-- Proibição de exclusões físicas
-- ---------------------------------------------------------------------------
create trigger no_delete_processes before delete on public.administrative_processes
  for each row execute function public.tg_prevent_delete();
create trigger no_delete_supply_orders before delete on public.supply_orders
  for each row execute function public.tg_prevent_delete();
create trigger no_delete_invoices before delete on public.invoices
  for each row execute function public.tg_prevent_delete();
create trigger no_delete_payments before delete on public.payments
  for each row execute function public.tg_prevent_delete();
create trigger no_delete_documents before delete on public.documents
  for each row execute function public.tg_prevent_delete();
create trigger no_delete_historical before delete on public.historical_statuses
  for each row execute function public.tg_prevent_delete();
create trigger no_delete_suppliers before delete on public.suppliers
  for each row execute function public.tg_prevent_delete();
