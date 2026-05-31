-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Galerías de eventos reales
-- Inspiración visual: bodas, comuniones, cumples y eventos reales
-- llevados a cabo por proveedores del catálogo. El cliente clica
-- y reserva los mismos proveedores.
-- ═════════════════════════════════════════════════════════════════

create table if not exists event_galleries (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,                    -- "Boda íntima en una masía de Valencia"
  slug            text unique not null,             -- "boda-intima-masia-valencia"
  event_type      text not null,                    -- 'boda' | 'cumpleanos' | 'comunion' | 'corporativo' | 'otro'
  city            text not null,
  date_held       date,
  guests          int,
  vibe            text,                             -- 'rustico' | 'moderno' | 'clasico' | 'lujo' | 'intimo'
  description     text,                             -- 1-2 párrafos descriptivos
  cover_photo_url text not null,                    -- foto principal
  photos          text[] default '{}'::text[],      -- resto de fotos
  provider_ids    uuid[] default '{}'::uuid[],      -- proveedores que participaron
  featured        boolean default false,            -- destacado en home
  status          text default 'published',         -- 'draft' | 'published' | 'archived'
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists event_galleries_status_idx     on event_galleries(status);
create index if not exists event_galleries_featured_idx   on event_galleries(featured) where featured = true;
create index if not exists event_galleries_event_type_idx on event_galleries(event_type);
create index if not exists event_galleries_city_idx       on event_galleries(city);
create index if not exists event_galleries_created_idx    on event_galleries(created_at desc);

-- Trigger para auto-actualizar updated_at
create or replace function tg_event_galleries_updated() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists event_galleries_updated_at on event_galleries;
create trigger event_galleries_updated_at
  before update on event_galleries
  for each row execute function tg_event_galleries_updated();

select 'OK · tabla event_galleries + índices + trigger' as resultado;
