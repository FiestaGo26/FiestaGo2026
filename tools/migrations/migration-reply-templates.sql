-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Plantillas de respuesta del proveedor a reseñas
-- Array de objetos {label, body}. La variable {nombre} se sustituye
-- por el nombre de pila del cliente al aplicar la plantilla en el panel.
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists reply_templates jsonb default '[]'::jsonb;

select 'OK · reply_templates añadido a providers' as resultado;
