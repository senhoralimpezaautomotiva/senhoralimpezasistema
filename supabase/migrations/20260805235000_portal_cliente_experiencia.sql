begin;

alter table public.configuracoes_empresa
  add column if not exists portal_catalog_source text not null default 'system',
  add column if not exists whatsapp_catalog_url text not null default '',
  add column if not exists loyalty_referral_target integer not null default 10;

alter table public.configuracoes_empresa
  drop constraint if exists configuracoes_empresa_portal_catalog_source_check,
  add constraint configuracoes_empresa_portal_catalog_source_check
    check (portal_catalog_source in ('system', 'whatsapp')),
  drop constraint if exists configuracoes_empresa_loyalty_referral_target_check,
  add constraint configuracoes_empresa_loyalty_referral_target_check
    check (loyalty_referral_target between 1 and 50),
  drop constraint if exists configuracoes_empresa_whatsapp_catalog_url_check,
  add constraint configuracoes_empresa_whatsapp_catalog_url_check
    check (whatsapp_catalog_url = '' or whatsapp_catalog_url ~ '^https://');

create or replace function public.portal_referral_progress()
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select count(distinct referred.id)::integer
  from public.clientes referred
  where public.portal_customer_metadata(referred.nome)->>'referredBy' = public.portal_current_cliente_id()::text
    and exists (
      select 1
      from public.agendamentos appointment
      where appointment.cliente_id = referred.id
        and appointment.status in ('finalizado', 'entregue')
    );
$function$;

revoke all on function public.portal_referral_progress() from public, anon;
grant execute on function public.portal_referral_progress() to authenticated;

comment on function public.portal_referral_progress() is
  'Retorna somente a contagem agregada de indicacoes concluidas do cliente autenticado.';

insert into supabase_migrations.schema_migrations(version, statements, name)
values (
  '20260805235000',
  array['portal_cliente_experiencia'],
  'portal_cliente_experiencia'
)
on conflict (version) do nothing;

commit;
