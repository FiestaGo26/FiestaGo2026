-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Tracking de recordatorios del segundo pago
-- Aplicado en Supabase. Guardado aquí por trazabilidad.
--
-- Necesario para el cron /api/cron/second-payment-reminders que
-- gestiona el ciclo D-7 → D-3 → D0 → overdue → cancelación
-- automática tras 7 días de gracia.
-- ═════════════════════════════════════════════════════════════════

alter table bookings
  add column if not exists second_payment_reminder_d7_sent_at timestamptz,
  add column if not exists second_payment_reminder_d3_sent_at timestamptz,
  add column if not exists second_payment_reminder_d0_sent_at timestamptz,
  add column if not exists second_payment_overdue_since       timestamptz,
  add column if not exists second_payment_cancelled_at        timestamptz;

comment on column bookings.second_payment_overdue_since is
  'Fecha en la que la reserva pasó a overdue. Inicia el reloj del grace period. La cancelación automática ocurre a los second_payment_grace_days días.';

select 'OK · columnas de tracking del segundo pago añadidas' as resultado;
