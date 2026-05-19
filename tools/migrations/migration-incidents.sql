-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Sistema de incidencias
-- El cliente reporta un problema con una reserva → admin lo gestiona
-- (sustituto, reembolso, mediación) según los criterios de la
-- Garantía de Éxito. El SLA se calcula en el endpoint según la
-- proximidad del evento.
-- ═════════════════════════════════════════════════════════════════

create table if not exists incidents (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  booking_id    uuid not null references bookings(id) on delete cascade,
  reporter_role text not null check (reporter_role in ('client','provider','admin')),
  reporter_email text,

  -- Tipo de incidencia. Determina la acción típica de la garantía.
  type          text not null check (type in (
    'cancelled_by_provider',
    'no_show',
    'quality',
    'wrong_service',
    'payment',
    'other'
  )),
  description   text not null,
  evidence_urls jsonb default '[]'::jsonb,

  -- Workflow del admin
  status        text default 'open' check (status in (
    'open',           -- recién reportada, espera asignación
    'investigating',  -- admin la está mirando
    'resolved',       -- compensación ejecutada
    'rejected'        -- no procede (con motivo)
  )),
  resolution      text,
  compensation_amount numeric(10,2),
  resolved_at     timestamptz,
  resolved_by     text,
  rejected_reason text,

  -- SLA: deadline en el que la incidencia debería estar resuelta.
  -- Se calcula al insertar en función de la proximidad del evento.
  sla_target_at   timestamptz
);

create index if not exists incidents_status_idx
  on incidents(status) where status in ('open', 'investigating');
create index if not exists incidents_booking_idx on incidents(booking_id);
create index if not exists incidents_created_idx on incidents(created_at desc);

-- Trigger updated_at
create or replace function update_incidents_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists incidents_updated_at on incidents;
create trigger incidents_updated_at
  before update on incidents
  for each row execute function update_incidents_updated_at();

select 'OK · tabla incidents creada' as resultado;
