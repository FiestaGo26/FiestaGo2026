-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Tracking de aceptación de Compromisos del Proveedor
-- Versión + timestamp + dirección IP (audit trail).
-- Si en el futuro actualizamos los Compromisos, comparamos terms_version
-- contra la versión actual; si difieren, pedimos re-aceptación antes
-- de que pueda seguir aceptando reservas.
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists terms_accepted_at  timestamptz,
  add column if not exists terms_version      text,
  add column if not exists terms_accepted_ip  text;

select 'OK · columnas de compromisos añadidas' as resultado;
