begin;

alter table public.configuracoes_empresa
  add column if not exists instagram_url text not null default '',
  add column if not exists google_maps_url text not null default '';

alter table public.configuracoes_empresa
  drop constraint if exists configuracoes_empresa_instagram_url_check,
  add constraint configuracoes_empresa_instagram_url_check
    check (instagram_url = '' or instagram_url ~ '^https://'),
  drop constraint if exists configuracoes_empresa_google_maps_url_check,
  add constraint configuracoes_empresa_google_maps_url_check
    check (google_maps_url = '' or google_maps_url ~ '^https://');

insert into supabase_migrations.schema_migrations(version, statements, name)
values (
  '20260818193000',
  array['portal_social_location_links'],
  'portal_social_location_links'
)
on conflict (version) do nothing;

commit;
