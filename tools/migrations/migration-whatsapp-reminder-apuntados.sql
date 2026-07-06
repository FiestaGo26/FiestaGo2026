-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Recordatorio a los "Me apunto" y víctimas del cooldown-bug
-- Contador separado del followup/followup2/outreach para no mezclar canales.
-- Cap 1 por proveedor (máximo un recordatorio de este tipo).
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists whatsapp_reminder_apuntados_sent_at timestamptz,
  add column if not exists whatsapp_reminder_apuntados_count   int default 0;

-- Índice parcial para localizar rápido a los candidatos al recordatorio:
-- pendientes de alta, sin recordatorio previo, no marcados whatsapp_invalid.
create index if not exists providers_wa_reminder_apuntados_idx
  on providers(status, whatsapp_reminder_apuntados_count, whatsapp_invalid)
  where status <> 'approved'
    and (whatsapp_reminder_apuntados_count is null or whatsapp_reminder_apuntados_count = 0)
    and (whatsapp_invalid is null or whatsapp_invalid = false);

select 'OK · columnas whatsapp_reminder_apuntados_sent_at + whatsapp_reminder_apuntados_count' as resultado;
