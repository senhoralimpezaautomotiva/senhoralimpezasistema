-- PORTAL-001: autenticação real e isolamento de dados do Portal do Cliente.
-- Esta migração pressupõe o schema remoto confirmado pela baseline da DB-001.

begin;

create table if not exists public.portal_client_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  cliente_id uuid not null unique references public.clientes(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.portal_client_identities is
  'Vínculo exclusivo entre uma identidade do Supabase Auth e um cadastro de cliente.';

alter table public.portal_client_identities enable row level security;

create or replace function public.portal_normalize_phone(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when length(regexp_replace(value, '\D', '', 'g')) in (10, 11)
      then '55' || regexp_replace(value, '\D', '', 'g')
    else regexp_replace(value, '\D', '', 'g')
  end
$$;

create or replace function public.portal_current_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select identity_row.cliente_id
  from public.portal_client_identities as identity_row
  where identity_row.auth_user_id = auth.uid()
$$;

create or replace function public.portal_is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios
    where auth_user_id = auth.uid()
      and status = 'ativo'
  )
$$;

revoke all on function public.portal_normalize_phone(text) from public, anon, authenticated;
revoke all on function public.portal_current_cliente_id() from public, anon;
revoke all on function public.portal_is_active_staff() from public, anon;
grant execute on function public.portal_current_cliente_id() to authenticated;
grant execute on function public.portal_is_active_staff() to authenticated;

drop policy if exists portal_identity_select_own on public.portal_client_identities;
create policy portal_identity_select_own
on public.portal_client_identities
for select
to authenticated
using (auth_user_id = auth.uid() or public.portal_is_active_staff());

revoke all on table public.portal_client_identities from anon;
revoke insert, update, delete on table public.portal_client_identities from authenticated;
grant select on table public.portal_client_identities to authenticated;

create or replace function public.portal_claim_existing_cliente()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_auth_user auth.users%rowtype;
  normalized_phone text;
  matched_cliente_id uuid;
  match_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select *
  into current_auth_user
  from auth.users
  where id = auth.uid();

  if current_auth_user.phone is null or current_auth_user.phone_confirmed_at is null then
    raise exception using errcode = '42501', message = 'PHONE_NOT_VERIFIED';
  end if;

  select cliente_id
  into matched_cliente_id
  from public.portal_client_identities
  where auth_user_id = auth.uid();

  if matched_cliente_id is not null then
    return matched_cliente_id;
  end if;

  normalized_phone := public.portal_normalize_phone(current_auth_user.phone);
  perform pg_advisory_xact_lock(hashtext('portal-client:' || normalized_phone));

  select count(*), (array_agg(id order by id))[1]
  into match_count, matched_cliente_id
  from public.clientes
  where public.portal_normalize_phone(telefone) = normalized_phone;

  if match_count > 1 then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_CUSTOMER_PHONE';
  end if;

  if matched_cliente_id is null then
    return null;
  end if;

  insert into public.portal_client_identities (auth_user_id, cliente_id)
  values (auth.uid(), matched_cliente_id)
  on conflict (auth_user_id) do update
    set cliente_id = excluded.cliente_id;

  return matched_cliente_id;
exception
  when unique_violation then
    raise exception using errcode = '42501', message = 'CUSTOMER_ALREADY_LINKED';
end;
$$;

create or replace function public.portal_create_cliente(
  p_nome text,
  p_data_aniversario date,
  p_origem text default 'Portal do Cliente',
  p_email text default null,
  p_referral_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_auth_user auth.users%rowtype;
  normalized_phone text;
  existing_cliente_id uuid;
  created_cliente_id uuid;
  clean_name text;
  clean_origin text;
  clean_email text;
  clean_referral text;
  referrer_id uuid;
  metadata jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select *
  into current_auth_user
  from auth.users
  where id = auth.uid();

  if current_auth_user.phone is null or current_auth_user.phone_confirmed_at is null then
    raise exception using errcode = '42501', message = 'PHONE_NOT_VERIFIED';
  end if;

  select cliente_id
  into existing_cliente_id
  from public.portal_client_identities
  where auth_user_id = auth.uid();

  if existing_cliente_id is not null then
    return existing_cliente_id;
  end if;

  clean_name := left(regexp_replace(trim(coalesce(p_nome, '')), '[[:cntrl:]]', '', 'g'), 160);
  if length(clean_name) < 2 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;
  if p_data_aniversario is null or p_data_aniversario > current_date then
    raise exception using errcode = '22023', message = 'INVALID_BIRTH_DATE';
  end if;

  clean_origin := left(regexp_replace(trim(coalesce(p_origem, 'Portal do Cliente')), '[[:cntrl:]]', '', 'g'), 80);
  clean_email := nullif(left(lower(trim(coalesce(p_email, ''))), 254), '');
  clean_referral := nullif(upper(regexp_replace(trim(coalesce(p_referral_code, '')), '[^A-Z0-9-]', '', 'g')), '');
  normalized_phone := public.portal_normalize_phone(current_auth_user.phone);

  perform pg_advisory_xact_lock(hashtext('portal-client:' || normalized_phone));

  existing_cliente_id := public.portal_claim_existing_cliente();
  if existing_cliente_id is not null then
    return existing_cliente_id;
  end if;

  if clean_referral is not null then
    select id
    into referrer_id
    from public.clientes
    where nome like '%"referralCode":"' || clean_referral || '"%'
    limit 1;

    if referrer_id is null then
      raise exception using errcode = '22023', message = 'INVALID_REFERRAL_CODE';
    end if;
  end if;

  metadata := jsonb_strip_nulls(jsonb_build_object(
    'email', clean_email,
    'status', 'ativo',
    'origin', clean_origin,
    'notes', 'Cadastrado via Portal do Cliente',
    'referredBy', referrer_id
  ));

  insert into public.clientes (nome, telefone, data_aniversario)
  values (
    clean_name || ' [meta:' || metadata::text || ']',
    normalized_phone,
    p_data_aniversario
  )
  returning id into created_cliente_id;

  insert into public.portal_client_identities (auth_user_id, cliente_id)
  values (auth.uid(), created_cliente_id);

  return created_cliente_id;
exception
  when unique_violation then
    raise exception using errcode = '42501', message = 'CUSTOMER_ALREADY_LINKED';
end;
$$;

create or replace function public.portal_validate_referral_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clientes
    where nome like '%"referralCode":"' ||
      upper(regexp_replace(trim(coalesce(p_code, '')), '[^A-Z0-9-]', '', 'g')) ||
      '"%'
      and id is distinct from public.portal_current_cliente_id()
  )
$$;

revoke all on function public.portal_claim_existing_cliente() from public, anon;
revoke all on function public.portal_create_cliente(text, date, text, text, text) from public, anon;
revoke all on function public.portal_validate_referral_code(text) from public, anon;
grant execute on function public.portal_claim_existing_cliente() to authenticated;
grant execute on function public.portal_create_cliente(text, date, text, text, text) to authenticated;
grant execute on function public.portal_validate_referral_code(text) to authenticated;

-- Dados operacionais: nenhuma leitura ou escrita anônima.
alter table public.clientes enable row level security;
alter table public.veiculos enable row level security;
alter table public.agendamentos enable row level security;

revoke all on table public.clientes from anon;
revoke all on table public.veiculos from anon;
revoke all on table public.agendamentos from anon;

grant select, insert, update, delete on table public.clientes to authenticated;
grant select, insert, update, delete on table public.veiculos to authenticated;
grant select, insert, update, delete on table public.agendamentos to authenticated;

drop policy if exists clientes_staff_all on public.clientes;
create policy clientes_staff_all
on public.clientes
for all
to authenticated
using (public.portal_is_active_staff())
with check (public.portal_is_active_staff());

drop policy if exists clientes_portal_select_own on public.clientes;
create policy clientes_portal_select_own
on public.clientes
for select
to authenticated
using (id = public.portal_current_cliente_id());

drop policy if exists veiculos_staff_all on public.veiculos;
create policy veiculos_staff_all
on public.veiculos
for all
to authenticated
using (public.portal_is_active_staff())
with check (public.portal_is_active_staff());

drop policy if exists veiculos_portal_select_own on public.veiculos;
create policy veiculos_portal_select_own
on public.veiculos
for select
to authenticated
using (cliente_id = public.portal_current_cliente_id());

drop policy if exists veiculos_portal_insert_own on public.veiculos;
create policy veiculos_portal_insert_own
on public.veiculos
for insert
to authenticated
with check (cliente_id = public.portal_current_cliente_id());

drop policy if exists veiculos_portal_update_own on public.veiculos;
create policy veiculos_portal_update_own
on public.veiculos
for update
to authenticated
using (cliente_id = public.portal_current_cliente_id())
with check (cliente_id = public.portal_current_cliente_id());

drop policy if exists agendamentos_staff_all on public.agendamentos;
create policy agendamentos_staff_all
on public.agendamentos
for all
to authenticated
using (public.portal_is_active_staff())
with check (public.portal_is_active_staff());

drop policy if exists agendamentos_portal_select_own on public.agendamentos;
create policy agendamentos_portal_select_own
on public.agendamentos
for select
to authenticated
using (cliente_id = public.portal_current_cliente_id());

create or replace function public.portal_busy_intervals(p_date date)
returns table (hora_agendamento time, tempo_estimado_minutos integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.hora_agendamento, greatest(coalesce(a.tempo_real, 60), 1)
  from public.agendamentos as a
  where a.data_agendamento = p_date
    and a.status <> 'Cancelado'
    and p_date between current_date and (current_date + 90)
$$;

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
as $$
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
      total_duration := total_duration + coalesce((service_meta->>'time')::integer, 60);
    end if;
  end loop;

  select coalesce(
    substring(nome from '\[meta:(\{.*\})\]\s*$')::jsonb,
    '{}'::jsonb
  )
  into customer_meta
  from public.clientes
  where id = current_cliente_id;

  if coalesce((customer_meta->>'referralDiscountAvailable')::boolean, false) then
    -- O schema remoto atual não possui configuração pública normalizada.
    -- Mantém o percentual oficial já usado pelo sistema até a tarefa de banco.
    discount_percent := 10;
    discount_value := round(total_value * discount_percent / 100, 2);
  end if;

  clean_notes := left(regexp_replace(trim(coalesce(p_observacoes, 'Agendado pelo Portal do Cliente')), '[[:cntrl:]]', ' ', 'g'), 1000);
  stored_notes := clean_notes || ' [meta:' || jsonb_build_object(
    'employeeId', 'Gabriel',
    'discount', discount_value,
    'addition', 0,
    'serviceIds', p_service_ids,
    'portalCreated', true
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
    greatest(total_value - discount_value, 0),
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

  return inserted_row;
end;
$$;

create or replace function public.portal_cancel_agendamento(p_agendamento_id uuid)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_cliente_id uuid;
  appointment_row public.agendamentos%rowtype;
begin
  current_cliente_id := public.portal_current_cliente_id();
  if current_cliente_id is null then
    raise exception using errcode = '42501', message = 'CUSTOMER_LINK_REQUIRED';
  end if;

  select *
  into appointment_row
  from public.agendamentos
  where id = p_agendamento_id
    and cliente_id = current_cliente_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'APPOINTMENT_NOT_ALLOWED';
  end if;
  if appointment_row.status in ('Cancelado', 'Concluído') then
    raise exception using errcode = '22023', message = 'APPOINTMENT_NOT_CANCELLABLE';
  end if;
  if (appointment_row.data_agendamento + appointment_row.hora_agendamento) <=
      (localtimestamp + interval '24 hours') then
    raise exception using errcode = '22023', message = 'CANCELLATION_WINDOW_CLOSED';
  end if;

  update public.agendamentos
  set status = 'Cancelado',
      updated_at = now()
  where id = p_agendamento_id
  returning * into appointment_row;

  return appointment_row;
end;
$$;

revoke all on function public.portal_busy_intervals(date) from public, anon;
revoke all on function public.portal_create_agendamento(uuid, uuid[], date, time, text) from public, anon;
revoke all on function public.portal_cancel_agendamento(uuid) from public, anon;
grant execute on function public.portal_busy_intervals(date) to authenticated;
grant execute on function public.portal_create_agendamento(uuid, uuid[], date, time, text) to authenticated;
grant execute on function public.portal_cancel_agendamento(uuid) to authenticated;

-- Catálogos podem ser lidos, mas nunca alterados, pelo navegador anônimo.
alter table public.servicos_disponiveis enable row level security;
alter table public.servicos_precos enable row level security;
alter table public.marcas_veiculos enable row level security;
alter table public.modelos_veiculos enable row level security;

revoke all on table public.servicos_disponiveis from anon;
revoke all on table public.servicos_precos from anon;
revoke all on table public.marcas_veiculos from anon;
revoke all on table public.modelos_veiculos from anon;
grant select on table public.servicos_disponiveis to anon, authenticated;
grant select on table public.servicos_precos to anon, authenticated;
grant select on table public.marcas_veiculos to anon, authenticated;
grant select on table public.modelos_veiculos to anon, authenticated;
grant insert, update, delete on table public.servicos_disponiveis to authenticated;
grant insert, update, delete on table public.servicos_precos to authenticated;
grant insert, update, delete on table public.marcas_veiculos to authenticated;
grant insert, update, delete on table public.modelos_veiculos to authenticated;

drop policy if exists servicos_catalog_read on public.servicos_disponiveis;
create policy servicos_catalog_read on public.servicos_disponiveis
for select to anon, authenticated using (coalesce(ativo, true));
drop policy if exists servicos_staff_write on public.servicos_disponiveis;
create policy servicos_staff_write on public.servicos_disponiveis
for all to authenticated
using (public.portal_is_active_staff())
with check (public.portal_is_active_staff());

drop policy if exists servicos_precos_catalog_read on public.servicos_precos;
create policy servicos_precos_catalog_read on public.servicos_precos
for select to anon, authenticated using (true);
drop policy if exists servicos_precos_staff_write on public.servicos_precos;
create policy servicos_precos_staff_write on public.servicos_precos
for all to authenticated
using (public.portal_is_active_staff())
with check (public.portal_is_active_staff());

drop policy if exists marcas_catalog_read on public.marcas_veiculos;
create policy marcas_catalog_read on public.marcas_veiculos
for select to anon, authenticated using (coalesce(ativo, true));
drop policy if exists marcas_staff_write on public.marcas_veiculos;
create policy marcas_staff_write on public.marcas_veiculos
for all to authenticated
using (public.portal_is_active_staff())
with check (public.portal_is_active_staff());

drop policy if exists modelos_catalog_read on public.modelos_veiculos;
create policy modelos_catalog_read on public.modelos_veiculos
for select to anon, authenticated using (coalesce(ativo, true));
drop policy if exists modelos_staff_write on public.modelos_veiculos;
create policy modelos_staff_write on public.modelos_veiculos
for all to authenticated
using (public.portal_is_active_staff())
with check (public.portal_is_active_staff());

commit;
