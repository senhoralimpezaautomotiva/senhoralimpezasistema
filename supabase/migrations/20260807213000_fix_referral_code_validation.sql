begin;

-- Atualizar normalização e busca por código de indicação nas funções RPC do portal do cliente.
-- Correção do bug onde a regex '[^A-Z0-9-]' removia letras minúsculas antes da conversão para maiúsculas (upper),
-- fazendo com que códigos válidos digitados em minúsculas/mistas fossem desfigurados e rejeitados como inválidos.

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
    where upper(public.portal_customer_metadata(nome)->>'referralCode') =
      upper(regexp_replace(trim(coalesce(p_code, '')), '[^a-zA-Z0-9-]', '', 'g'))
      and nullif(upper(regexp_replace(trim(coalesce(p_code, '')), '[^a-zA-Z0-9-]', '', 'g')), '') is not null
      and id is distinct from public.portal_current_cliente_id()
  )
$$;

create or replace function public.portal_create_cliente(
  p_nome text,
  p_data_aniversario date,
  p_origem text default null,
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
  resolved_identity record;
  resolved_provider text;
  resolved_value text;
  clean_name text;
  clean_origin text;
  clean_email text;
  clean_phone text;
  clean_referral text;
  referrer_id uuid;
  metadata jsonb;
  created_cliente_id uuid;
  existing_cliente_id uuid;
begin
  select provider, identity_value
  into resolved_identity
  from public.portal_resolve_auth_identity();

  resolved_provider := resolved_identity.provider;
  resolved_value := resolved_identity.identity_value;

  if resolved_provider = 'email' then
    select cliente_id
    into existing_cliente_id
    from public.clientes
    where lower(public.portal_customer_metadata(nome)->>'email') = resolved_value
    limit 1;
  elsif resolved_provider = 'phone' then
    select cliente_id
    into existing_cliente_id
    from public.clientes
    where telefone = resolved_value
    limit 1;
  end if;

  if existing_cliente_id is not null then
    insert into public.portal_client_identities (
      auth_user_id,
      cliente_id,
      identity_provider,
      identity_value
    )
    values (
      auth.uid(),
      existing_cliente_id,
      resolved_provider,
      resolved_value
    )
    on conflict (auth_user_id) do update
      set cliente_id = excluded.cliente_id,
          identity_provider = excluded.identity_provider,
          identity_value = excluded.identity_value;

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
        '[^a-zA-Z0-9-]',
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
    where upper(public.portal_customer_metadata(nome)->>'referralCode') = clean_referral
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

revoke all on function public.portal_validate_referral_code(text) from public, anon;
grant execute on function public.portal_validate_referral_code(text) to authenticated;

commit;
