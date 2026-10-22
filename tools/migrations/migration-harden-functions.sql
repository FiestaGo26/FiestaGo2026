-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Endurecimiento de funciones (asesor de seguridad Supabase)
-- Aplicada en producción el 18-10-2026.
-- ═════════════════════════════════════════════════════════════════

-- search_path fijo: evita que una función resuelva tablas/funciones
-- de un esquema distinto al esperado.
alter function public.calculate_commission(uuid, numeric)       set search_path = public, pg_temp;
alter function public.dispute_events_touch()                     set search_path = public, pg_temp;
alter function public.evidence_row_is_immutable()                set search_path = public, pg_temp;
alter function public.sync_provider_categories()                 set search_path = public, pg_temp;
alter function public.terms_versions_guard_update()              set search_path = public, pg_temp;
-- Estas dos usan digest() de pgcrypto, instalada en el esquema extensions.
alter function public.terms_versions_set_hash()                  set search_path = public, extensions, pg_temp;
alter function public.publish_terms_version(text, text, text)    set search_path = public, extensions, pg_temp;

-- notify_admin solo la llaman los triggers on_provider_insert y
-- on_booking_insert (SECURITY DEFINER, propietario postgres).
-- Ningún usuario con sesión debe poder crear notificaciones de admin vía /rpc.
revoke execute on function public.notify_admin(text, text, text, jsonb, text) from public, anon, authenticated;
