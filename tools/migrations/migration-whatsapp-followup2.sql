-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · 3er toque WhatsApp (plantilla prueba social)
-- Contador y timestamp separados del followup normal para no
-- pisarlos: el followup normal usa plantilla "seguimiento_proveedores"
-- (ángulo demanda), y este usa "prueba_social_proveedores"
-- (ángulo prueba social de proveedores reales de su zona).
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists whatsapp_followup2_sent_at timestamptz,
  add column if not exists whatsapp_followup2_count   int default 0;

create index if not exists providers_wa_followup2_candidates_idx
  on providers(status, contacted_via, outreach_sent, whatsapp_followup2_count, whatsapp_invalid)
  where status = 'pending'
    and outreach_sent = true
    and contacted_via = 'whatsapp'
    and (whatsapp_followup2_count is null or whatsapp_followup2_count = 0)
    and (whatsapp_invalid is null or whatsapp_invalid = false);

select 'OK · columnas whatsapp_followup2_sent_at + whatsapp_followup2_count' as resultado;
