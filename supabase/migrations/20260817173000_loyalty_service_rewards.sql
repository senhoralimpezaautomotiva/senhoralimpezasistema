begin;

alter table public.loyalty_card_entries
  drop constraint if exists loyalty_card_entries_source_check,
  add constraint loyalty_card_entries_source_check
    check (source in ('referral', 'own_service', 'reward_redeem', 'manual_add', 'manual_remove'));

alter table public.loyalty_card_entries
  drop constraint if exists loyalty_card_entries_delta_check,
  add constraint loyalty_card_entries_delta_check
    check (delta in (-10, -1, 1));

create unique index if not exists loyalty_card_entries_one_own_service_per_appointment
  on public.loyalty_card_entries (appointment_id)
  where source = 'own_service' and appointment_id is not null;

create table if not exists public.loyalty_reward_credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.clientes(id) on delete cascade,
  service_id uuid not null references public.servicos_disponiveis(id) on delete restrict,
  status text not null default 'available'
    check (status in ('available', 'redeemed', 'cancelled')),
  earned_from_entry_id uuid references public.loyalty_card_entries(id) on delete set null,
  redeemed_appointment_id uuid references public.agendamentos(id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create index if not exists loyalty_reward_credits_customer_available
  on public.loyalty_reward_credits (customer_id, created_at)
  where status = 'available';

alter table public.loyalty_reward_credits enable row level security;
drop policy if exists loyalty_reward_credits_staff_select on public.loyalty_reward_credits;
create policy loyalty_reward_credits_staff_select on public.loyalty_reward_credits
  for select to authenticated using (public.portal_is_active_staff());
revoke all on public.loyalty_reward_credits from anon;
revoke insert, update, delete on public.loyalty_reward_credits from authenticated;
grant select on public.loyalty_reward_credits to authenticated;

create or replace function public.loyalty_normalize_service_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select regexp_replace(
    lower(translate(coalesce(p_value, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    )),
    '\s+', ' ', 'g'
  );
$function$;

create or replace function public.loyalty_is_eligible_own_service(p_service_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  normalized text;
begin
  select public.loyalty_normalize_service_name(nome_servico || ' ' || coalesce(categoria, '') || ' ' || coalesce(observacao, ''))
  into normalized
  from public.servicos_disponiveis
  where id = p_service_id;

  if normalized is null then
    return false;
  end if;

  if normalized ~ '(polimento|higienizacao|motor|cristalizacao|vidro|plastic|farol|vitrificacao)' then
    return false;
  end if;

  return normalized like '%manutencao e protecao%'
    or normalized like '%manutencao%'
    or normalized like '%limpeza tecnica%';
end;
$function$;

create or replace function public.loyalty_reward_service_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select service.id
  from public.servicos_disponiveis service
  where coalesce(service.ativo, true)
    and public.loyalty_normalize_service_name(service.nome_servico) like '%manutencao e protecao%'
    and public.loyalty_normalize_service_name(service.nome_servico) not like '%motor%'
  order by
    case
      when public.loyalty_normalize_service_name(service.nome_servico) = 'limpeza de manutencao e protecao' then 0
      else 1
    end,
    service.nome_servico
  limit 1;
$function$;

create or replace function public.issue_loyalty_reward_if_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_balance integer;
  target_service_id uuid;
begin
  if new.delta <= 0 then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('loyalty:' || new.customer_id::text));

  select greatest(0, coalesce(sum(delta), 0))
  into current_balance
  from public.loyalty_card_entries
  where customer_id = new.customer_id;

  if current_balance < 10 then
    return new;
  end if;

  target_service_id := public.loyalty_reward_service_id();
  if target_service_id is null then
    return new;
  end if;

  insert into public.loyalty_reward_credits(customer_id, service_id, earned_from_entry_id)
  values (new.customer_id, target_service_id, new.id);

  insert into public.loyalty_card_entries(customer_id, delta, source, note, actor_name)
  values (
    new.customer_id,
    -10,
    'reward_redeem',
    'Cartão fidelidade completo: crédito de Limpeza de manutenção e proteção gerado',
    'Sistema'
  );

  return new;
end;
$function$;

drop trigger if exists trg_issue_loyalty_reward_if_complete on public.loyalty_card_entries;
create trigger trg_issue_loyalty_reward_if_complete
after insert on public.loyalty_card_entries
for each row execute function public.issue_loyalty_reward_if_complete();

create or replace function public.award_own_service_loyalty_mark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  appointment_meta jsonb := '{}'::jsonb;
  service_ids uuid[] := array[]::uuid[];
  service_id uuid;
begin
  if replace(lower(coalesce(new.status, '')), 'í', 'i') not in ('finalizado', 'entregue', 'concluido')
     or replace(lower(coalesce(old.status, '')), 'í', 'i') in ('finalizado', 'entregue', 'concluido') then
    return new;
  end if;

  begin
    appointment_meta := coalesce(
      substring(coalesce(new.observacoes, '') from '\[meta:(\{.*\})\]\s*$')::jsonb,
      '{}'::jsonb
    );
  exception when others then
    appointment_meta := '{}'::jsonb;
  end;

  if jsonb_typeof(appointment_meta->'serviceIds') = 'array' then
    select array_agg(value::uuid)
    into service_ids
    from jsonb_array_elements_text(appointment_meta->'serviceIds') as selected(value)
    where selected.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  end if;

  if coalesce(array_length(service_ids, 1), 0) = 0 and new.servico_id is not null then
    service_ids := array[new.servico_id];
  end if;

  foreach service_id in array service_ids loop
    if public.loyalty_is_eligible_own_service(service_id) then
      insert into public.loyalty_card_entries
        (customer_id, delta, source, appointment_id, note, actor_name)
      values
        (new.cliente_id, 1, 'own_service', new.id, 'Marcação automática por limpeza elegível concluída', 'Sistema')
      on conflict (appointment_id) where source = 'own_service' and appointment_id is not null do nothing;
      return new;
    end if;
  end loop;

  return new;
end;
$function$;

drop trigger if exists trg_award_own_service_loyalty_mark on public.agendamentos;
create trigger trg_award_own_service_loyalty_mark
after update of status on public.agendamentos
for each row execute function public.award_own_service_loyalty_mark();

create or replace function public.portal_available_loyalty_credits()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  earned_from_entry_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select credit.id, credit.customer_id, credit.service_id, credit.earned_from_entry_id, credit.created_at
  from public.loyalty_reward_credits credit
  where credit.customer_id = public.portal_current_cliente_id()
    and credit.status = 'available'
  order by credit.created_at;
$function$;

revoke all on function public.portal_available_loyalty_credits() from public, anon;
grant execute on function public.portal_available_loyalty_credits() to authenticated;

create or replace function public.portal_create_agendamento(
  p_veiculo_id uuid,
  p_service_ids uuid[],
  p_data date,
  p_hora time,
  p_observacoes text default null
)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_cliente_id uuid;
  selected_vehicle public.veiculos%rowtype;
  service_id uuid;
  service_row public.servicos_disponiveis%rowtype;
  price_row public.servicos_precos%rowtype;
  service_meta jsonb;
  total_value numeric(10,2) := 0;
  total_duration integer := 0;
  clean_notes text;
  stored_notes text;
  inserted_row public.agendamentos%rowtype;
  available_credit public.loyalty_reward_credits%rowtype;
  credit_discount_value numeric(10,2) := 0;
begin
  current_cliente_id := public.portal_current_cliente_id();
  if current_cliente_id is null then
    raise exception using errcode = '42501', message = 'CUSTOMER_LINK_REQUIRED';
  end if;

  if p_data is null or p_hora is null or p_data < current_date or p_data > current_date + 90 then
    raise exception using errcode = '22023', message = 'INVALID_APPOINTMENT_DATE';
  end if;
  if coalesce(array_length(p_service_ids, 1), 0) < 1 or array_length(p_service_ids, 1) > 12 then
    raise exception using errcode = '22023', message = 'INVALID_SERVICES';
  end if;

  select *
  into selected_vehicle
  from public.veiculos
  where id = p_veiculo_id
    and cliente_id = current_cliente_id;

  if not found then
    raise exception using errcode = '42501', message = 'VEHICLE_NOT_ALLOWED';
  end if;

  select *
  into available_credit
  from public.loyalty_reward_credits credit
  where credit.customer_id = current_cliente_id
    and credit.status = 'available'
    and credit.service_id = any(p_service_ids)
  order by credit.created_at
  limit 1
  for update skip locked;

  foreach service_id in array p_service_ids loop
    select *
    into service_row
    from public.servicos_disponiveis
    where id = service_id and coalesce(ativo, true);

    if not found then
      raise exception using errcode = '22023', message = 'INVALID_SERVICE';
    end if;

    select *
    into price_row
    from public.servicos_precos
    where servico_id = service_id
      and porte = coalesce(selected_vehicle.porte, 'Médio')
    limit 1;

    service_meta := '{}'::jsonb;
    begin
      service_meta := coalesce(
        substring(coalesce(service_row.observacao, '') from '\[meta:(\{.*\})\]\s*$')::jsonb,
        '{}'::jsonb
      );
    exception when others then
      service_meta := '{}'::jsonb;
    end;

    if price_row.id is not null then
      total_value := total_value + price_row.preco;
      if available_credit.id is not null and available_credit.service_id = service_id then
        credit_discount_value := price_row.preco;
      end if;
      total_duration := total_duration + price_row.tempo_estimado_minutos;
    else
      total_value := total_value + coalesce(
        case selected_vehicle.porte
          when 'Pequeno' then (service_meta->>'priceP')::numeric
          when 'Grande' then (service_meta->>'priceG')::numeric
          else (service_meta->>'priceM')::numeric
        end,
        (service_meta->>'price')::numeric,
        0
      );
      if available_credit.id is not null and available_credit.service_id = service_id then
        credit_discount_value := coalesce(
          case selected_vehicle.porte
            when 'Pequeno' then (service_meta->>'priceP')::numeric
            when 'Grande' then (service_meta->>'priceG')::numeric
            else (service_meta->>'priceM')::numeric
          end,
          (service_meta->>'price')::numeric,
          0
        );
      end if;
      total_duration := total_duration + coalesce((service_meta->>'time')::integer, 60);
    end if;
  end loop;

  if available_credit.id is not null and available_credit.service_id is distinct from public.loyalty_reward_service_id() then
    raise exception using errcode = '22023', message = 'INVALID_LOYALTY_CREDIT_SERVICE';
  end if;

  clean_notes := left(regexp_replace(trim(coalesce(p_observacoes, 'Agendado pelo Portal do Cliente')), '[[:cntrl:]]', ' ', 'g'), 1000);
  stored_notes := clean_notes || ' [meta:' || jsonb_build_object(
    'employeeId', 'Gabriel',
    'discount', coalesce(credit_discount_value, 0),
    'addition', 0,
    'serviceIds', p_service_ids,
    'portalCreated', true,
    'loyaltyCreditId', available_credit.id
  )::text || ']';

  perform pg_advisory_xact_lock(hashtext('portal-slot:' || p_data::text || ':' || p_hora::text));
  if (
    select count(*)
    from public.agendamentos
    where data_agendamento = p_data
      and hora_agendamento = p_hora
      and status <> 'Cancelado'
  ) >= 2 then
    raise exception using errcode = 'P0001', message = 'TIME_SLOT_UNAVAILABLE';
  end if;

  insert into public.agendamentos (
    cliente_id,
    veiculo_id,
    servico_id,
    data_agendamento,
    hora_agendamento,
    tempo_real,
    valor_servico,
    status,
    observacoes,
    updated_at
  )
  values (
    current_cliente_id,
    selected_vehicle.id,
    p_service_ids[1],
    p_data,
    p_hora,
    greatest(total_duration, 1),
    greatest(total_value - coalesce(credit_discount_value, 0), 0),
    'Agendado',
    stored_notes,
    now()
  )
  returning * into inserted_row;

  if available_credit.id is not null then
    update public.loyalty_reward_credits
    set status = 'redeemed',
        redeemed_appointment_id = inserted_row.id,
        redeemed_at = now()
    where id = available_credit.id;
  end if;

  return inserted_row;
end;
$function$;

commit;
