-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Follow-ups específicos de WhatsApp
-- Permite detectar proveedores contactados por WA que NO respondieron
-- y mandarles una segunda plantilla. Separado de followup_count
-- (que cuenta los de email + IG) para no mezclar canales.
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists whatsapp_followup_sent_at timestamptz,
  add column if not exists whatsapp_followup_count   int default 0;

-- Índice parcial para localizar rápido los candidatos al follow-up de WA:
-- contactados por WA, perfil pendiente, sin pasarse del cap, número válido.
create index if not exists providers_wa_followup_candidates_idx
  on providers(status, outreach_sent, contacted_via, whatsapp_followup_count, whatsapp_invalid)
  where status = 'pending'
    and outreach_sent = true
    and contacted_via = 'whatsapp'
    and (whatsapp_followup_count is null or whatsapp_followup_count < 2)
    and (whatsapp_invalid is null or whatsapp_invalid = false);

select 'OK · columnas whatsapp_followup_sent_at + whatsapp_followup_count' as resultado;
