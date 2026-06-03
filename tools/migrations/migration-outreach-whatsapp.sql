-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Outreach por WhatsApp + web del proveedor
-- Añade columna outreach_whatsapp con el mensaje preescrito que el
-- admin envía con 1 clic vía wa.me. La columna contacted_via ya existe
-- (migration-contacted-via.sql) y admite 'whatsapp'.
-- ═════════════════════════════════════════════════════════════════

alter table providers add column if not exists outreach_whatsapp text;

-- Ampliar el CHECK de contacted_via para incluir 'web_form' (formulario web).
-- La columna ya existe (migration-contacted-via.sql) con: email, instagram,
-- tiktok, whatsapp, phone. Añadimos web_form como canal nuevo.
alter table providers drop constraint if exists providers_contacted_via_check;
alter table providers add constraint providers_contacted_via_check
  check (contacted_via in ('email', 'instagram', 'tiktok', 'whatsapp', 'phone', 'web_form'));

notify pgrst, 'reload schema';

-- Verificación
select count(*) filter (where phone is not null) as con_telefono,
       count(*) filter (where outreach_whatsapp is not null) as con_borrador_wa
from providers;
