-- Propuesta escrita (embudo completo, 6.ª simulación): el proveedor responde
-- a una petición con un precio cerrado para ESE cliente (sus invitados, su
-- fecha), qué incluye y la señal. El cliente la ve en /propuesta/<token>,
-- la comparte con su pareja/familia y reserva desde ahí.
alter table public.date_holds add column if not exists quote_total       numeric;
alter table public.date_holds add column if not exists quote_includes    text;
alter table public.date_holds add column if not exists quote_deposit_pct int;
alter table public.date_holds add column if not exists proposal_token    text;
alter table public.date_holds add column if not exists proposal_viewed_at timestamptz;
-- Seguimiento de ayuda (no de presión) a mitad del bloqueo de 48 h
alter table public.date_holds add column if not exists followup_sent_at  timestamptz;
create unique index if not exists date_holds_proposal_token_idx on public.date_holds (proposal_token);

-- Opiniones de Google de los proveedores (lib/google-reviews.ts)
alter table public.providers add column if not exists google_reviews    jsonb;
alter table public.providers add column if not exists google_reviews_at timestamptz;
-- Simulación: segunda decisión tras el bloqueo de 48 h
alter table public.sim_runs add column if not exists round_close2 jsonb;

-- Preguntas del cliente al proveedor desde la propuesta, con su respuesta
-- por escrito: [{ q, asked_at, a, answered_at }]
alter table public.date_holds add column if not exists questions jsonb not null default '[]'::jsonb;

-- Referencias de clientes del proveedor (con su consentimiento; contacto solo para FiestaGo)
alter table public.providers add column if not exists client_references jsonb not null default '[]'::jsonb;
create table if not exists public.reference_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider_id uuid references public.providers(id) on delete cascade,
  reference_id text not null,
  proposal_token text,
  client_name text, client_email text,
  status text not null default 'pending'
);
alter table public.reference_requests enable row level security;
