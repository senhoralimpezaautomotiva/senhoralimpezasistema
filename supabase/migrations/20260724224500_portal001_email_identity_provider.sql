-- PORTAL-001: provedor inicial por e-mail/senha e identidade extensível.
-- A migração anterior permanece imutável; esta substitui somente as RPCs de vínculo.

begin;

alter table public.portal_client_identities
  add column if not exists identity_provider text not null default 'email',
  add column if not exists identity_value text;

alter table public.portal_client_identities
  drop constraint if exists portal_client_identities_provider_check;

alter table public.portal_client_identities
  add constraint portal_client_identities_provider_check
  check (identity_provider in ('email', 'phone'));

create index if not exists idx_portal_client_identities_provider_value
  on public.portal_client_identities (identity_provider, identity_value);

create or replace function public.portal_customer_metadata(value text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw_metadata text;
begin
  raw_metadata := substring(coalesce(value, '') from '\[meta:(\{.*\})\]\s*$');
  if raw_metadata is null then
    return '{}'::jsonb;
  end if;
  return raw_metadata::jsonb;
exception when others then
  return '{}'::jsonb;
end;
$$;

create or replace function public.portal_resolve_auth_identity()
returns table (provider text, identity_value text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_auth_user auth.users%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select *
  into current_auth_user
  from auth.users
  where id = auth.uid();

  if current_auth_user.email is not null
     and current_auth_user.email_confirmed_at is not null then
    provider := 'email';
    identity_value := lower(trim(current_auth_user.email));
    return next;
    return;
  end if;

  if current_auth_user.phone is not null
     and current_auth_user.phone_confirmed_at is not null then
    provider := 'phone';
    identity_value := public.portal_normalize_phone(current_auth_user.phone);
    return next;
    return;
  end if;

  raise exception using errcode = '42501', message = 'IDENTITY_NOT_VERIFIED';
end;
$$;

revoke all on function public.portal_customer_metadata(text) from public, anon, authenticated;
revoke all on function public.portal_resolve_auth_identity() from public, anon;
grant execute on function public.portal_resolve_auth_identity() to authenticated;

create or replace function public.portal_claim_existing_cliente()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_provider text;
  resolved_value text;
  matched_cliente_id uuid;
  match_count integer;
begin
  select provider, identity_value
  into resolved_provider, resolved_value
  from public.portal_resolve_auth_identity();

  select cliente_id
  into matched_cliente_id
  from public.portal_client_identities
  where auth_user_id = auth.uid();

  if matched_cliente_id is not null then
    update public.portal_client_identities
    set identity_provider = resolved_provider,
        identity_value = resolved_value
    where auth_user_id = auth.uid();
    return matched_cliente_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('portal-client:' || resolved_provider || ':' || resolved_value)
  );

  if resolved_provider = 'email' then
    select count(*), (array_agg(id order by id))[1]
    into match_count, matched_cliente_id
    from public.clientes
    where lower(public.portal_customer_metadata(nome)->>'email') = resolved_value;
  else
    select count(*), (array_agg(id order by id))[1]
    into match_count, matched_cliente_id
    from public.clientes
    where public.portal_normalize_phone(telefone) = resolved_value;
  end if;

  if match_count > 1 then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_CUSTOMER_IDENTITY';
  end if;
  if matched_cliente_id is null then
    return null;
  end if;

  insert into public.portal_client_identities (
    auth_user_id,
    cliente_id,
    identity_provider,
    identity_value
  )
  values (
    auth.uid(),
    matched_cliente_id,
    resolved_provider,
    resolved_value
  );

  return matched_cliente_id;
exception
  when unique_violation then
    raise exception using errcode = '42501', message = 'CUSTOMER_ALREADY_LINKED';
end;
$$;

drop function if exists public.portal_create_cliente(text, date, text, text, text);

create function public.portal_create_cliente(
  p_nome text,
  p_data_aniversario date,
  p_origem text default 'Portal do Cliente',
  p_email text default null,
  p_referral_code text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_provider text;
  resolved_value text;
  existing_cliente_id uuid;
  created_cliente_id uuid;
  clean_name text;
  clean_origin text;
  clean_email text;
  clean_phone text;
  clean_referral text;
  referrer_id uuid;
  metadata jsonb;
begin
  select provider, identity_value
  into resolved_provider, resolved_value
  from public.portal_resolve_auth_identity();

  select cliente_id
  into existing_cliente_id
  from public.portal_client_identities
  where auth_user_id = auth.uid();

  if existing_cliente_id is not null then
    return existing_cliente_id;
  end if;

  existing_cliente_id := public.portal_claim_existing_cliente();
  if existing_cliente_id is not null then
    return existing_cliente_id;
  end if;

  clean_name := left(
    regexp_replace(trim(coalesce(p_nome, '')), '[[:cntrl:]]', '', 'g'),
    160
  );
  if length(clean_name) < 2 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;
  if p_data_aniversario is null or p_data_aniversario > current_date then
    raise exception using errcode = '22023', message = 'INVALID_BIRTH_DATE';
  end if;

  clean_origin := left(
    regexp_replace(
      trim(coalesce(p_origem, 'Portal do Cliente')),
      '[[:cntrl:]]',
      '',
      'g'
    ),
    80
  );
  clean_email := case
    when resolved_provider = 'email' then resolved_value
    else nullif(left(lower(trim(coalesce(p_email, ''))), 254), '')
  end;
  clean_phone := public.portal_normalize_phone(
    case
      when resolved_provider = 'phone' then resolved_value
      else coalesce(p_phone, '')
    end
  );
  if length(clean_phone) not in (12, 13) then
    raise exception using errcode = '22023', message = 'INVALID_PHONE';
  end if;

  clean_referral := nullif(
    upper(
      regexp_replace(
        trim(coalesce(p_referral_code, '')),
        '[^A-Z0-9-]',
        '',
        'g'
      )
    ),
    ''
  );

  if clean_referral is not null then
    select id
    into referrer_id
    from public.clientes
    where public.portal_customer_metadata(nome)->>'referralCode' = clean_referral
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
    clean_phone,
    p_data_aniversario
  )
  returning id into created_cliente_id;

  insert into public.portal_client_identities (
    auth_user_id,
    cliente_id,
    identity_provider,
    identity_value
  )
  values (
    auth.uid(),
    created_cliente_id,
    resolved_provider,
    resolved_value
  );

  return created_cliente_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'CUSTOMER_IDENTITY_CONFLICT';
end;
$$;

revoke all on function public.portal_claim_existing_cliente() from public, anon;
revoke all on function public.portal_create_cliente(text, date, text, text, text, text)
  from public, anon;
grant execute on function public.portal_claim_existing_cliente() to authenticated;
grant execute on function public.portal_create_cliente(text, date, text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
