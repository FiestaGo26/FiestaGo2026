-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Cargo al proveedor en incidencias
-- Separa lo que recibe el cliente (compensation_amount) de lo que se
-- cobra al proveedor (provider_charge). Cuando se integre Stripe
-- Connect, provider_charge se descontará automáticamente del payout
-- del proveedor.
-- ═════════════════════════════════════════════════════════════════

alter table incidents
  add column if not exists provider_charge      numeric(10,2),
  add column if not exists provider_charge_paid boolean default false,
  add column if not exists provider_charge_paid_at timestamptz;

select 'OK · provider_charge añadido a incidents' as resultado;
