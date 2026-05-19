-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Tracking de follow-ups del outreach
-- Permite detectar proveedores contactados hace días sin respuesta
-- y volver a escribirles sin pasarse (cap en 2 follow-ups).
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists followup_sent_at timestamptz,
  add column if not exists followup_count   int default 0;

-- Índice para localizar rápido los candidatos
create index if not exists providers_followup_candidates_idx
  on providers(status, outreach_sent, followup_count)
  where status = 'pending' and outreach_sent = true and followup_count < 2;

select 'OK · columnas followup_sent_at + followup_count' as resultado;
