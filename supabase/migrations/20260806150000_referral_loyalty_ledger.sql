begin;

create table if not exists public.loyalty_card_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.clientes(id) on delete cascade,
  delta smallint not null check (delta in (-1, 1)),
  source text not null check (source in ('referral', 'manual_add', 'manual_remove')),
  referred_customer_id uuid references public.clientes(id) on delete set null,
  appointment_id uuid references public.agendamentos(id) on delete set null,
  note text not null default '',
  actor_name text not null default 'Sistema',
  created_at timestamptz not null default now()
);

create unique index if not exists loyalty_card_entries_one_referral_per_customer
  on public.loyalty_card_entries (referred_customer_id)
  where source = 'referral';
create index if not exists loyalty_card_entries_customer_created
  on public.loyalty_card_entries (customer_id, created_at desc);

alter table public.loyalty_card_entries enable row level security;
drop policy if exists loyalty_entries_staff_select on public.loyalty_card_entries;
create policy loyalty_entries_staff_select on public.loyalty_card_entries
  for select to authenticated using (public.portal_is_active_staff());
revoke all on public.loyalty_card_entries from anon;
revoke insert, update, delete on public.loyalty_card_entries from authenticated;
grant select on public.loyalty_card_entries to authenticated;

create or replace function public.award_referral_loyalty_mark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  customer_meta jsonb;
  referrer_id uuid;
begin
  if lower(coalesce(new.status, '')) not in ('finalizado', 'entregue')
     or lower(coalesce(old.status, '')) in ('finalizado', 'entregue') then
    return new;
  end if;
  if exists (
    select 1 from public.agendamentos previous
    where previous.cliente_id = new.cliente_id
      and previous.id <> new.id
      and lower(previous.status) in ('finalizado', 'entregue')
  ) then return new; end if;

  customer_meta := public.portal_customer_metadata((select nome from public.clientes where id = new.cliente_id));
  begin referrer_id := nullif(customer_meta->>'referredBy', '')::uuid;
  exception when others then referrer_id := null; end;
  if referrer_id is null or referrer_id = new.cliente_id then return new; end if;

  insert into public.loyalty_card_entries
    (customer_id, delta, source, referred_customer_id, appointment_id, note, actor_name)
  values
    (referrer_id, 1, 'referral', new.cliente_id, new.id, 'Marcação automática por indicação concluída', 'Sistema')
  on conflict (referred_customer_id) where source = 'referral' do nothing;
  return new;
end;
$function$;

drop trigger if exists trg_award_referral_loyalty_mark on public.agendamentos;
create trigger trg_award_referral_loyalty_mark
after update of status on public.agendamentos
for each row execute function public.award_referral_loyalty_mark();

insert into public.loyalty_card_entries
  (customer_id, delta, source, referred_customer_id, appointment_id, note, actor_name, created_at)
select
  case
    when (public.portal_customer_metadata(referred.nome)->>'referredBy') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (public.portal_customer_metadata(referred.nome)->>'referredBy')::uuid
  end,
  1,
  'referral',
  referred.id,
  first_finished.id,
  'Marcação recuperada de indicação já concluída',
  'Migração do sistema',
  coalesce(first_finished.updated_at, first_finished.created_at, now())
from public.clientes referred
cross join lateral (
  select appointment.id, appointment.updated_at, appointment.created_at
  from public.agendamentos appointment
  where appointment.cliente_id = referred.id
    and lower(appointment.status) in ('finalizado', 'entregue')
  order by appointment.updated_at nulls last, appointment.created_at nulls last
  limit 1
) first_finished
where (public.portal_customer_metadata(referred.nome)->>'referredBy') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (referred_customer_id) where source = 'referral' do nothing;

create or replace function public.admin_adjust_loyalty_mark(
  p_customer_id uuid,
  p_delta smallint,
  p_actor_name text default 'Usuário do sistema'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  entry_id uuid;
  current_balance integer;
begin
  if not public.portal_is_active_staff() then raise exception 'STAFF_ACCESS_REQUIRED'; end if;
  if p_delta not in (-1, 1) then raise exception 'INVALID_LOYALTY_DELTA'; end if;
  perform pg_advisory_xact_lock(hashtext('loyalty:' || p_customer_id::text));
  select greatest(0, coalesce(sum(delta), 0)) into current_balance
  from public.loyalty_card_entries where customer_id = p_customer_id;
  if p_delta = -1 and current_balance = 0 then raise exception 'LOYALTY_BALANCE_EMPTY'; end if;
  insert into public.loyalty_card_entries(customer_id, delta, source, note, actor_name)
  values (p_customer_id, p_delta, case when p_delta = 1 then 'manual_add' else 'manual_remove' end,
    case when p_delta = 1 then 'Marcação adicionada manualmente' else 'Marcação removida manualmente' end,
    left(coalesce(nullif(trim(p_actor_name), ''), 'Usuário do sistema'), 120))
  returning id into entry_id;
  return entry_id;
end;
$function$;

revoke all on function public.admin_adjust_loyalty_mark(uuid, smallint, text) from public;
grant execute on function public.admin_adjust_loyalty_mark(uuid, smallint, text) to authenticated;

create or replace function public.portal_referral_progress()
returns integer language sql stable security definer set search_path = ''
as $function$
  select greatest(0, coalesce(sum(entry.delta), 0))::integer
  from public.loyalty_card_entries entry
  where entry.customer_id = public.portal_current_cliente_id();
$function$;

update public.clientes
set nome = regexp_replace(nome, '\s*\[meta:\{.*\}\]\s*$', '') || ' [meta:' ||
  (public.portal_customer_metadata(nome)
    - 'referralDiscountAvailable' - 'referralDiscountUsed'
    - 'referralServiceValue' - 'referralBonusPercentUsed' - 'referralBonusAmount')::text || ']'
where public.portal_customer_metadata(nome) ?| array[
  'referralDiscountAvailable','referralDiscountUsed','referralServiceValue','referralBonusPercentUsed','referralBonusAmount'
];

alter table public.configuracoes_empresa
  drop column if exists referral_active,
  drop column if exists referral_discount_percent;

insert into supabase_migrations.schema_migrations(version, statements, name)
values ('20260806150000', array['referral_loyalty_ledger'], 'referral_loyalty_ledger')
on conflict (version) do nothing;

commit;
