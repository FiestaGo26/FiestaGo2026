-- ═══════════════════════════════════════════════════════════════════════════
-- GOOGLE CALENDAR — sincronización en dos sentidos (ocupado/libre) por proveedor
-- Ejecutar en Supabase (SQL Editor) del proyecto FiestaGo (borcqxgnmwtztuvdgzjx).
-- ═══════════════════════════════════════════════════════════════════════════

-- Conexión OAuth de Google Calendar de cada proveedor
create table if not exists google_calendar_connections (
  provider_id        uuid primary key references providers(id) on delete cascade,
  google_email       text,
  calendar_id        text default 'primary',
  access_token       text,
  refresh_token      text,                         -- token permanente (offline)
  token_expiry       timestamptz,
  -- Notificaciones push (watch): para sincronizar casi en tiempo real
  watch_channel_id   text,
  watch_resource_id  text,
  watch_expiration   timestamptz,
  last_synced_at     timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists gcal_watch_channel_idx
  on google_calendar_connections(watch_channel_id);

-- service_availability: distinguir bloqueos manuales de los importados de Google
alter table service_availability
  add column if not exists source text not null default 'manual'
    check (source in ('manual','google'));

-- bookings: guardar el id del evento creado en Google (para poder borrarlo)
alter table bookings
  add column if not exists google_event_id text;

alter table google_calendar_connections enable row level security;
-- Acceso solo vía service_role (servidor). Sin políticas públicas.

notify pgrst, 'reload schema';
