-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Estado de WhatsApp (validez + entrega)
-- 1. providers.whatsapp_invalid — marca números que no son E.164
--    válidos o que Meta ha rechazado como inexistentes. Evita
--    reintentos.
-- 2. providers.whatsapp_invalid_reason — texto opcional con el
--    motivo (p.ej. "número no E.164 válido" o "Meta: number does
--    not exist on WhatsApp").
-- 3. whatsapp_messages — añade estados de entrega (delivered/read/
--    failed) y la marca de timestamp de cada paso. Los eventos
--    llegan en value.statuses[] del webhook.
-- ═════════════════════════════════════════════════════════════════

alter table providers add column if not exists whatsapp_invalid boolean default false;
alter table providers add column if not exists whatsapp_invalid_reason text;

create index if not exists providers_whatsapp_invalid_idx
  on providers(whatsapp_invalid) where whatsapp_invalid = true;

alter table whatsapp_messages add column if not exists delivered_at timestamptz;
alter table whatsapp_messages add column if not exists read_at      timestamptz;
alter table whatsapp_messages add column if not exists failed_at    timestamptz;
alter table whatsapp_messages add column if not exists error_code   int;
alter table whatsapp_messages add column if not exists error_detail text;

create index if not exists whatsapp_messages_wa_id_idx
  on whatsapp_messages(wa_message_id) where wa_message_id is not null;

notify pgrst, 'reload schema';
