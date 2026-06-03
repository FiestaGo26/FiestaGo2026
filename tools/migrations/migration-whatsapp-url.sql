-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · URL de WhatsApp detectada en la web del proveedor
-- El scraper extrae wa.me/api.whatsapp.com links embebidos y los
-- guarda aquí. El botón 💬 del admin prefiere esta URL sobre el
-- teléfono fijo cuando existe (el negocio ya tiene un WhatsApp
-- dedicado a clientes).
-- ═════════════════════════════════════════════════════════════════

alter table providers add column if not exists whatsapp_url text;

create index if not exists providers_whatsapp_url_idx
  on providers(whatsapp_url) where whatsapp_url is not null;

notify pgrst, 'reload schema';

-- Verificación
select count(*) filter (where whatsapp_url is not null) as con_wa_url,
       count(*) filter (where phone is not null)        as con_telefono
from providers;
