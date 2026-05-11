-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Disponibilidad por servicio
-- Cada fila = un día BLOQUEADO para un servicio concreto.
-- Por defecto los días están disponibles; el proveedor solo marca los bloqueados.
-- Pega en Supabase → SQL Editor → New query → Run
-- ═════════════════════════════════════════════════════════════════

create table if not exists service_availability (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  service_id   uuid not null references provider_services(id) on delete cascade,
  blocked_date date not null,
  reason       text,
  unique (service_id, blocked_date)
);

create index if not exists service_availability_service_idx on service_availability(service_id, blocked_date);
create index if not exists service_availability_date_idx    on service_availability(blocked_date);

-- Verificación
select 'OK · Tabla service_availability creada' as resultado;
