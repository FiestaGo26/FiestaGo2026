-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Eventos del usuario + progreso del checklist
-- Permite a un cliente registrar su evento (tipo + fecha + ciudad +
-- invitados) y ver una cuenta atrás + checklist personalizado que
-- crece según se acerca el día.
-- ═════════════════════════════════════════════════════════════════

create table if not exists user_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  event_type   text not null,                   -- 'boda' | 'cumpleanos' | 'comunion' | 'corporativo' | 'otro'
  event_date   date not null,
  city         text,
  guests       int,
  name         text,                            -- "Boda Marta & Juan", opcional
  vibe         text,
  budget_total int,                             -- presupuesto total estimado
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists user_events_user_id_idx on user_events(user_id);
create index if not exists user_events_date_idx    on user_events(event_date);

-- Progreso del checklist: qué items ha marcado completados el usuario.
-- Los items en sí son una lista fija definida en lib/checklist.ts —
-- aquí solo guardamos cuáles ha tachado.
create table if not exists user_checklist_progress (
  id            uuid primary key default gen_random_uuid(),
  user_event_id uuid not null references user_events(id) on delete cascade,
  item_key      text not null,                  -- key del item en la lista de constants
  done_at       timestamptz default now(),
  notes         text,                           -- "Reservé con Marta Photo"
  unique (user_event_id, item_key)
);

create index if not exists user_checklist_progress_event_idx on user_checklist_progress(user_event_id);

-- Trigger updated_at
create or replace function tg_user_events_updated() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists user_events_updated_at on user_events;
create trigger user_events_updated_at
  before update on user_events
  for each row execute function tg_user_events_updated();

-- RLS: cada usuario solo ve y modifica SUS eventos
alter table user_events                 enable row level security;
alter table user_checklist_progress     enable row level security;

drop policy if exists user_events_select on user_events;
create policy user_events_select on user_events
  for select using (user_id = auth.uid());

drop policy if exists user_events_modify on user_events;
create policy user_events_modify on user_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists progress_select on user_checklist_progress;
create policy progress_select on user_checklist_progress
  for select using (
    exists (select 1 from user_events where id = user_event_id and user_id = auth.uid())
  );

drop policy if exists progress_modify on user_checklist_progress;
create policy progress_modify on user_checklist_progress
  for all using (
    exists (select 1 from user_events where id = user_event_id and user_id = auth.uid())
  ) with check (
    exists (select 1 from user_events where id = user_event_id and user_id = auth.uid())
  );

select 'OK · user_events + user_checklist_progress + RLS' as resultado;
