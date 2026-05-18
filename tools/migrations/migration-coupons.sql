-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Cupones de descuento por proveedor
-- Cada proveedor crea sus propios códigos (PROMOJUNIO, AMIGO20…) con un
-- porcentaje, opcionalmente con límite de usos y fecha de expiración.
-- El cliente los aplica en el formulario de reserva y el descuento se
-- guarda en la propia reserva.
-- ═════════════════════════════════════════════════════════════════

create table if not exists coupons (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),

  provider_id  uuid not null references providers(id) on delete cascade,
  code         text not null,                  -- normalizado a uppercase
  description  text,
  percent_off  int  not null check (percent_off between 1 and 100),
  max_uses     int,                            -- null = sin límite
  used_count   int  default 0,
  expires_at   timestamptz,
  active       boolean default true
);

create unique index if not exists coupons_provider_code_unique
  on coupons(provider_id, code);
create index if not exists coupons_provider_idx on coupons(provider_id, active);

alter table bookings
  add column if not exists coupon_code    text,
  add column if not exists coupon_percent int,
  add column if not exists coupon_amount  numeric(10,2);

select 'OK · tabla coupons + columnas en bookings' as resultado;
