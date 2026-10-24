-- Simulaciones de clientes (lib/client-sim.ts). Solo acceso de servidor:
-- RLS activado y sin políticas.
create table if not exists public.sim_runs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  status      text not null default 'queued',
  config      jsonb,
  personas    jsonb,
  round1      jsonb,
  round2      jsonb,
  aggregates  jsonb,
  report      text,
  usage       jsonb,
  error       text
);
alter table public.sim_runs enable row level security;
