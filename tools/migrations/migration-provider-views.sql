-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Tracking de visitas y eventos por proveedor
-- Cada proveedor verá en su panel cuántas vistas, clicks, reservas, etc.
-- ═════════════════════════════════════════════════════════════════

create table if not exists provider_views (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  provider_id  uuid not null references providers(id) on delete cascade,
  event_type   text not null check (event_type in (
    'profile_view',     -- alguien abrió /proveedores/[slug]
    'service_view',     -- click en una card de servicio
    'booking_started',  -- abrió el formulario de reserva
    'booking_completed',-- envió la reserva
    'contact_clicked'   -- click en email/teléfono/web/IG
  )),
  service_id   uuid references provider_services(id) on delete set null,
  session_id   text,
  user_agent   text,
  referrer     text,
  city         text  -- ciudad del cliente si la sabemos
);

create index if not exists provider_views_provider_idx on provider_views(provider_id, created_at desc);
create index if not exists provider_views_event_idx    on provider_views(provider_id, event_type, created_at desc);
create index if not exists provider_views_service_idx  on provider_views(service_id) where service_id is not null;

-- Verificación
select 'OK · Tabla provider_views creada' as resultado;
