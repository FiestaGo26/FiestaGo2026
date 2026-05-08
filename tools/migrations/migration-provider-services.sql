-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Servicios por proveedor (con foto/vídeo)
-- Pega en Supabase → SQL Editor → New query → Run
-- ═════════════════════════════════════════════════════════════════

create table if not exists provider_services (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),

  provider_id  uuid not null references providers(id) on delete cascade,

  name         text not null,
  description  text,
  price        numeric(10,2),
  price_unit   text default 'por evento',
  duration     text,
  max_guests   int,

  -- Media
  media_type   text check (media_type in ('image', 'video', 'none')) default 'none',
  media_url    text,
  thumbnail_url text,

  -- Estado y orden
  status       text default 'active' check (status in ('active', 'paused')),
  sort_order   int default 0
);

create index if not exists provider_services_provider_idx on provider_services(provider_id, status);
create index if not exists provider_services_sort_idx     on provider_services(provider_id, sort_order);

-- Bucket de Storage (puede coexistir con social-posts)
insert into storage.buckets (id, name, public) values ('provider-media', 'provider-media', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'provider_media_public_read' and tablename = 'objects') then
    create policy provider_media_public_read on storage.objects for select using (bucket_id = 'provider-media');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'provider_media_service_write' and tablename = 'objects') then
    create policy provider_media_service_write on storage.objects for insert to service_role with check (bucket_id = 'provider-media');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'provider_media_service_update' and tablename = 'objects') then
    create policy provider_media_service_update on storage.objects for update to service_role using (bucket_id = 'provider-media');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'provider_media_service_delete' and tablename = 'objects') then
    create policy provider_media_service_delete on storage.objects for delete to service_role using (bucket_id = 'provider-media');
  end if;
end $$;

-- Migrar servicios existentes que estaban en agent_notes (si existen)
do $$
declare
  rec record;
  svcs jsonb;
  s    jsonb;
  ord  int;
begin
  for rec in select id, agent_notes from providers where agent_notes is not null and agent_notes like '%services:%' loop
    begin
      svcs := substring(rec.agent_notes from 'services:(.*)\|');
      svcs := svcs::jsonb;
      ord := 0;
      for s in select * from jsonb_array_elements(svcs) loop
        insert into provider_services (provider_id, name, description, price, duration, max_guests, sort_order)
        values (
          rec.id,
          coalesce(s->>'name', 'Servicio sin nombre'),
          s->>'description',
          (s->>'price')::numeric,
          s->>'duration',
          (s->>'maxGuests')::int,
          ord
        )
        on conflict do nothing;
        ord := ord + 1;
      end loop;
    exception when others then
      -- Si el JSON es inválido para este provider, lo saltamos
      raise notice 'Skipping provider %: %', rec.id, sqlerrm;
    end;
  end loop;
end $$;

-- Verificación
select
  (select count(*) from provider_services) as total_servicios,
  (select count(distinct provider_id) from provider_services) as proveedores_con_servicios;
