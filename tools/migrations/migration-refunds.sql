-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Refund tracking en cancelaciones
-- Cuando una reserva se cancela, se guarda el % y el importe a
-- devolver según la cancellation_policy del servicio.
-- ═════════════════════════════════════════════════════════════════

alter table bookings
  add column if not exists refund_percent numeric(5,2),
  add column if not exists refund_amount  numeric(10,2),
  add column if not exists refund_processed_at timestamptz,
  add column if not exists refund_stripe_id text;

select 'OK · columnas de refund añadidas' as resultado;
