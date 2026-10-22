-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Motor de crecimiento del Agente CEO
-- 1. Origen (UTM) de cada proveedor, email y reserva
-- 2. Cuaderno de experimentos de marketing
-- 3. Ajustes nuevos del CEO: presupuesto de anuncios, umbral de oferta
--    y freno automático de WhatsApp
-- Aplicada en producción el 22-10-2026.
-- ═════════════════════════════════════════════════════════════════

-- 1 · Atribución: { first: {...utm, landing, referrer, at}, last: {...} }
alter table public.providers add column if not exists acquisition jsonb;
alter table public.waitlist  add column if not exists acquisition jsonb;
alter table public.bookings  add column if not exists acquisition jsonb;

create index if not exists providers_acq_campaign_idx on public.providers ((acquisition->'last'->>'utm_campaign'));
create index if not exists waitlist_acq_campaign_idx  on public.waitlist  ((acquisition->'last'->>'utm_campaign'));
create index if not exists bookings_acq_campaign_idx  on public.bookings  ((acquisition->'last'->>'utm_campaign'));

-- 2 · Experimentos
create table if not exists public.marketing_experiments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  slug        text not null unique,          -- también es el utm_campaign
  audience    text not null check (audience in ('proveedores', 'clientes')),
  channel     text not null check (channel in ('whatsapp', 'email', 'instagram', 'tiktok', 'meta_ads', 'tiktok_ads', 'seo', 'otro')),
  format      text not null default '',      -- reel, carrusel, story, plantilla WA, artículo…
  hypothesis  text not null,
  variant     text not null default '',      -- ángulo o mensaje que se prueba
  city        text not null default '',
  category    text not null default '',
  status      text not null default 'running'
              check (status in ('proposed', 'running', 'won', 'lost', 'stopped', 'rejected')),
  started_at  timestamptz,
  ends_at     timestamptz,
  closed_at   timestamptz,
  budget_eur  numeric not null default 0,    -- solo anuncios; lo aprueba y paga Mariano
  metrics     jsonb not null default '{}'::jsonb,
  learning    text not null default '',      -- qué aprendimos (memoria del CEO)
  report_id   uuid references public.ceo_reports(id) on delete set null
);
create index if not exists marketing_experiments_status_idx on public.marketing_experiments (status, created_at desc);
alter table public.marketing_experiments enable row level security;

-- Las acciones del CEO pueden pertenecer a un experimento
alter table public.ceo_proposals add column if not exists experiment_slug text;

-- 3 · Ajustes
alter table public.ceo_settings add column if not exists ads_budget_eur   numeric not null default 50;
alter table public.ceo_settings add column if not exists supply_threshold integer not null default 3;
alter table public.ceo_settings add column if not exists wa_brake_optout  numeric not null default 0.05;
alter table public.ceo_settings add column if not exists wa_brake_failed  numeric not null default 0.20;
alter table public.ceo_settings add column if not exists wa_braked_at     timestamptz;
alter table public.ceo_settings add column if not exists wa_brake_reason  text;

-- Qué experimento hizo el primer contacto con cada proveedor
alter table public.providers add column if not exists outreach_experiment text;
create index if not exists providers_outreach_experiment_idx on public.providers (outreach_experiment) where outreach_experiment is not null;
