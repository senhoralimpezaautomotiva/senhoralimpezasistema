begin;

alter table public.servicos_disponiveis
  add column if not exists conta_cartao_fidelidade boolean not null default false;

comment on column public.servicos_disponiveis.conta_cartao_fidelidade
  is 'Define explicitamente se o servico concluido conta para o cartao fidelidade.';

update public.servicos_disponiveis service
set conta_cartao_fidelidade = public.loyalty_is_eligible_own_service(service.id)
where service.conta_cartao_fidelidade is false;

create or replace function public.loyalty_is_eligible_own_service(p_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select service.conta_cartao_fidelidade
    from public.servicos_disponiveis service
    where service.id = p_service_id
  ), false);
$function$;

notify pgrst, 'reload schema';

commit;
