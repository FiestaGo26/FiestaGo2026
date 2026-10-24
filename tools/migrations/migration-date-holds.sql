-- Primer paso sin pagar: "bloquea tu fecha 48 h gratis" o "pide presupuesto".
-- kind = 'hold'  → bloquea la fecha del servicio 48 h (service_availability, source 'hold')
-- kind = 'quote' → solo petición de presupuesto, no bloquea nada
-- Solo acceso de servidor: RLS activado y sin políticas.
create table if not exists public.date_holds (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  kind          text not null check (kind in ('hold', 'quote')),
  status        text not null default 'active' check (status in ('active', 'expired', 'converted', 'released')),
  provider_id   uuid references public.providers(id) on delete cascade,
  service_id    uuid,
  event_date    date,
  expires_at    timestamptz,
  client_name   text not null,
  client_email  text not null,
  client_phone  text,
  event_type    text,
  guests        int,
  message       text,
  acquisition   jsonb
);
create index if not exists date_holds_active_idx on public.date_holds (status, expires_at);
alter table public.date_holds enable row level security;

-- Los bloqueos de 48 h se guardan en service_availability con source 'hold'
alter table public.service_availability drop constraint if exists service_availability_source_check;
alter table public.service_availability add constraint service_availability_source_check
  check (source = any (array['manual', 'google', 'hold']));
