-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Row Level Security en las 9 tablas restantes
--
-- Situación previa: 9 tablas con RLS deshabilitado. Cualquiera con la
-- anon key podía leer/modificar todo. Riesgo real antes de que WOW
-- empiece a traer proveedores reales al panel.
--
-- Enfoque:
--   · Tablas donde el acceso es exclusivamente server-side con
--     service_role (createAdminClient) → RLS habilitado SIN policies.
--     El admin client bypassa RLS, así que los endpoints siguen
--     funcionando. Los clientes anon/authenticated quedan bloqueados
--     por defecto — principio de mínimo privilegio.
--
--   · Tablas con acceso desde el navegador (anon key + cookies):
--     user_events + user_checklist_progress. /api/user-event usa
--     createServerClient con anon key, que NO bypassa RLS. Necesitan
--     policies del tipo "el usuario autenticado solo ve/edita las
--     filas cuyo user_id coincide con auth.uid()".
-- ═════════════════════════════════════════════════════════════════

-- 1. Tablas admin-only (7): RLS habilitado, sin policies.
alter table marketing_posts             enable row level security;
alter table content_videos              enable row level security;
alter table event_proposals             enable row level security;
alter table provider_quotes             enable row level security;
alter table provider_quick_replies      enable row level security;
alter table provider_gmb_posts          enable row level security;
alter table provider_quote_prefs        enable row level security;

-- 2. Tablas con acceso cliente (2): RLS + policies por auth.uid()
alter table user_events             enable row level security;
alter table user_checklist_progress enable row level security;

-- user_events: el usuario ve/edita/inserta/borra solo las suyas.
drop policy if exists "users_own_their_events" on user_events;
create policy "users_own_their_events" on user_events
  for all
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

-- user_checklist_progress: filas encadenadas a un evento del usuario.
-- El subselect a user_events también atraviesa RLS y por eso solo
-- devuelve eventos del usuario logueado — la anidación es segura.
drop policy if exists "users_own_their_checklist" on user_checklist_progress;
create policy "users_own_their_checklist" on user_checklist_progress
  for all
  to authenticated
  using      (user_event_id in (select id from user_events where user_id = auth.uid()))
  with check (user_event_id in (select id from user_events where user_id = auth.uid()));

select 'OK · RLS activado en las 9 tablas' as resultado;
