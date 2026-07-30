-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Alta en 2 etapas: datos fiscales previos al primer cobro
--
-- El alta inicial no exige datos fiscales — el proveedor entra con
-- NIF opcional, publica ficha, recibe consultas. Cuando llega su
-- primera reserva, completa este wizard fiscal y firma el compromiso
-- de responsabilidad. Cumple DAC7 sin quemar la palanca de captación.
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists tax_id                  text,
  add column if not exists tax_name                text,
  add column if not exists tax_address             text,
  add column if not exists tax_regime              text,
  add column if not exists tax_iva_regime          text,
  add column if not exists tax_agreement_signed_at timestamptz,
  add column if not exists tax_agreement_version   text,
  add column if not exists tax_ready               boolean default false;

create index if not exists providers_tax_ready_idx
  on providers(tax_ready)
  where tax_ready = false;

select 'OK · 8 columnas fiscales + índice creados' as resultado;
