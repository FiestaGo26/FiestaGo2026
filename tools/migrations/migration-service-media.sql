-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Galería multi-imagen por servicio
-- Hasta 10 imágenes/vídeos por servicio, con orden y marcador de
-- portada. La columna media_url de provider_services sigue existiendo
-- como puntero a la imagen principal (la marcada is_primary=true) para
-- compatibilidad con los listados que ya consultan ese campo.
-- ═════════════════════════════════════════════════════════════════

create table if not exists service_media (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),

  service_id   uuid not null references provider_services(id) on delete cascade,
  provider_id  uuid not null references providers(id) on delete cascade,

  url          text not null,
  thumbnail_url text,
  media_type   text not null check (media_type in ('image', 'video')),
  storage_path text,                  -- ruta dentro del bucket provider-media
  sort_order   int default 0,
  is_primary   boolean default false
);

create index if not exists service_media_service_idx on service_media(service_id, sort_order);
create index if not exists service_media_primary_idx on service_media(service_id) where is_primary = true;

-- Solo una imagen primaria por servicio
create unique index if not exists service_media_one_primary
  on service_media(service_id) where is_primary = true;

select 'OK · service_media creado' as resultado;
