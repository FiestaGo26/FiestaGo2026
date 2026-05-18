-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Mensajería 1-a-1 cliente-proveedor por reserva
-- Solo se permite chat sobre reservas confirmadas/completadas (la
-- validación va en el endpoint). Se borran en cascada con la reserva.
-- ═════════════════════════════════════════════════════════════════

create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  booking_id    uuid not null references bookings(id) on delete cascade,
  sender_role   text not null check (sender_role in ('client', 'provider', 'admin')),
  body          text not null,
  read_at       timestamptz
);

create index if not exists messages_booking_idx on messages(booking_id, created_at);
create index if not exists messages_unread_idx  on messages(booking_id, read_at)
  where read_at is null;

select 'OK · tabla messages creada' as resultado;
