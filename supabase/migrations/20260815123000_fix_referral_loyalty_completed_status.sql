begin;

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
  if replace(lower(coalesce(new.status, '')), 'í', 'i') not in ('finalizado', 'entregue', 'concluido')
     or replace(lower(coalesce(old.status, '')), 'í', 'i') in ('finalizado', 'entregue', 'concluido') then
    return new;
  end if;
  if exists (
    select 1 from public.agendamentos previous
    where previous.cliente_id = new.cliente_id
      and previous.id <> new.id
      and replace(lower(previous.status), 'í', 'i') in ('finalizado', 'entregue', 'concluido')
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

commit;
