-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Auto-respuesta del proveedor al recibir una solicitud
-- Texto opcional que se envía por email al cliente nada más reservar.
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists auto_reply_message text;

select 'OK · auto_reply_message añadido a providers' as resultado;
