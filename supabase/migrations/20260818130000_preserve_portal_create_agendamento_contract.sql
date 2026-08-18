begin;

-- Correcao de compatibilidade: preserva integralmente o contrato historico de
-- portal_create_agendamento e adiciona apenas o consumo de credito fidelidade.

create table if not exists public.loyalty_reward_credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.clientes(id) on delete cascade,
  service_id uuid not null references public.servicos_disponiveis(id) on delete restrict,
  status text not null default 'available',
  earned_from_entry_id uuid references public.loyalty_card_entries(id) on delete set null,
  redeemed_appointment_id uuid references public.agendamentos(id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

alter table public.loyalty_reward_credits
  add column if not exists customer_id uuid references public.clientes(id) on delete cascade,
  add column if not exists service_id uuid references public.servicos_disponiveis(id) on delete restrict,
  add column if not exists status text not null default 'available',
  add column if not exists earned_from_entry_id uuid references public.loyalty_card_entries(id) on delete set null,
  add column if not exists redeemed_appointment_id uuid references public.agendamentos(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists redeemed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loyalty_reward_credits_status_check'
      and conrelid = 'public.loyalty_reward_credits'::regclass
  ) then
    alter table public.loyalty_reward_credits
      add constraint loyalty_reward_credits_status_check
      check (status in ('available', 'redeemed', 'cancelled'));
  end if;
end $$;

create index if not exists loyalty_reward_credits_customer_available
  on public.loyalty_reward_credits (customer_id, created_at)
  where status = 'available';

create or replace function public.portal_available_loyalty_credits()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  earned_from_entry_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if public.portal_password_change_required() then
    raise exception using errcode = '42501', message = 'PASSWORD_CHANGE_REQUIRED';
  end if;

  return query
  select credit.id, credit.customer_id, credit.service_id, credit.earned_from_entry_id, credit.created_at
  from public.loyalty_reward_credits credit
  where credit.customer_id = public.portal_current_cliente_id()
    and credit.status = 'available'
  order by credit.created_at;
end;
$function$;

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
  customer_meta jsonb := '{}'::jsonb;
  total_value numeric(10,2) := 0;
  total_duration integer := 0;
  discount_percent numeric := 0;
  discount_value numeric := 0;
  clean_notes text;
  stored_notes text;
  inserted_row public.agendamentos%rowtype;
  available_credit public.loyalty_reward_credits%rowtype;
  credit_discount_value numeric(10,2) := 0;
  total_discount_value numeric(10,2) := 0;
begin
  if public.portal_password_change_required() then
    raise exception using errcode = '42501', message = 'PASSWORD_CHANGE_REQUIRED';
  end if;

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

  select coalesce(
    substring(nome from '\[meta:(\{.*\})\]\s*$')::jsonb,
    '{}'::jsonb
  )
  into customer_meta
  from public.clientes
  where id = current_cliente_id;

  select *
  into available_credit
  from public.loyalty_reward_credits credit
  where credit.customer_id = current_cliente_id
    and credit.status = 'available'
    and credit.service_id = any(p_service_ids)
  order by credit.created_at
  limit 1
  for update skip locked;

  if available_credit.id is not null and available_credit.service_id is distinct from public.loyalty_reward_service_id() then
    raise exception using errcode = '22023', message = 'INVALID_LOYALTY_CREDIT_SERVICE';
  end if;

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

  if coalesce((customer_meta->>'referralDiscountAvailable')::boolean, false) then
    discount_percent := 10;
    discount_value := round(total_value * discount_percent / 100, 2);
  end if;

  total_discount_value := least(total_value, coalesce(credit_discount_value, 0) + coalesce(discount_value, 0));

  clean_notes := left(regexp_replace(trim(coalesce(p_observacoes, 'Agendado pelo Portal do Cliente')), '[[:cntrl:]]', ' ', 'g'), 1000);
  stored_notes := clean_notes || ' [meta:' || jsonb_build_object(
    'employeeId', 'Gabriel',
    'discount', total_discount_value,
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
    greatest(total_value - total_discount_value, 0),
    'Agendado',
    stored_notes,
    now()
  )
  returning * into inserted_row;

  if discount_value > 0 then
    customer_meta := customer_meta ||
      jsonb_build_object(
        'referralDiscountAvailable', false,
        'referralDiscountUsed', true
      );
    update public.clientes
    set nome = regexp_replace(nome, '\s*\[meta:\{.*\}\]\s*$', '') ||
      ' [meta:' || customer_meta::text || ']'
    where id = current_cliente_id;
  end if;

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

revoke all on function public.portal_available_loyalty_credits() from public, anon;
grant execute on function public.portal_available_loyalty_credits() to authenticated;
revoke all on function public.portal_create_agendamento(uuid, uuid[], date, time, text) from public, anon;
grant execute on function public.portal_create_agendamento(uuid, uuid[], date, time, text) to authenticated;

notify pgrst, 'reload schema';

commit;
