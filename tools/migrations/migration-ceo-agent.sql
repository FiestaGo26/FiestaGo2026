-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Agente CEO
-- Un agente IA con rol de CEO que cada mañana revisa el negocio
-- (proveedores, reservas, incidencias, waitlist, marketing, alertas)
-- y cada lunes manda un informe semanal. Nunca ejecuta nada que salga
-- a la gente (emails, pagos, publicaciones): lo deja como PROPUESTA
-- para que Mariano la apruebe desde /admin → 🧠 CEO.
-- ═════════════════════════════════════════════════════════════════

create table if not exists ceo_reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  kind          text not null check (kind in ('daily', 'weekly')),
  headline      text,                 -- titular de una línea
  summary       text,                 -- mensaje del CEO al dueño
  highlights    jsonb default '[]',   -- [{label, value, trend}]
  issues        jsonb default '[]',   -- [{severity, title, detail}]
  snapshot      jsonb,                -- métricas crudas que vio el agente
  model         text,
  emailed       boolean default false,
  error         text
);

create index if not exists ceo_reports_created_idx on ceo_reports(created_at desc);

create table if not exists ceo_proposals (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  report_id     uuid references ceo_reports(id) on delete cascade,
  area          text,                 -- 'captacion' | 'seo' | 'newsletter' | 'bugs' | ...
  title         text not null,
  why           text,
  next_step     text,                 -- qué haría exactamente si lo apruebas
  impact        text check (impact in ('alto', 'medio', 'bajo')),
  effort        text check (effort in ('alto', 'medio', 'bajo')),
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'done')),
  decided_at    timestamptz
);

create index if not exists ceo_proposals_status_idx on ceo_proposals(status, created_at desc);

-- Solo el service_role (APIs del admin) accede; sin políticas públicas.
alter table ceo_reports   enable row level security;
alter table ceo_proposals enable row level security;
