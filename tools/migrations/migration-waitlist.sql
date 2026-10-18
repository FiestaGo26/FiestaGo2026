-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Lista de clientes interesados
-- Emails que deja la gente en el quiz, la calculadora, etc.
-- Cada inscripción genera un email de confirmación.
-- Aplicada en producción el 18-10-2026 (con RLS activado).
-- ═════════════════════════════════════════════════════════════════

create table if not exists waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  name            text,
  city            text,
  event_type      text,        -- 'boda' | 'cumpleanos' | 'comunion' | 'corporativo' | 'otro'
  event_date      date,        -- fecha tentativa, opcional
  guests          int,         -- nº invitados aproximado, opcional
  source          text,        -- 'home-banner' | 'home-modal' | '/waitlist' | 'campaign-XYZ'
  referred_by     text,        -- código de referido si lo había
  user_agent      text,
  ip              text,
  created_at      timestamptz default now(),
  unsubscribed_at timestamptz,
  notified_launch boolean default false   -- marcado true cuando se le manda el email de lanzamiento
);

-- Email único (case-insensitive) para evitar duplicados
create unique index if not exists waitlist_email_unique on waitlist(lower(email))
  where unsubscribed_at is null;

create index if not exists waitlist_created_at_idx on waitlist(created_at desc);
create index if not exists waitlist_city_idx        on waitlist(city)        where city is not null;
create index if not exists waitlist_event_type_idx  on waitlist(event_type)  where event_type is not null;

-- Solo el servidor (service role) lee y escribe: los emails no son públicos.
alter table waitlist enable row level security;

select 'OK · tabla waitlist + índices creados' as resultado;
