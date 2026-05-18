-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Extras opcionales por servicio
-- Cada servicio puede tener hasta ~10 extras (álbum, drone, etc.)
-- que el cliente añade al reservar. Lo que elige se guarda con la
-- reserva para que ambas partes sepan qué incluye exactamente.
-- ═════════════════════════════════════════════════════════════════

alter table provider_services
  add column if not exists addons jsonb default '[]'::jsonb;

alter table bookings
  add column if not exists selected_addons jsonb default '[]'::jsonb;

select 'OK · addons + selected_addons creados' as resultado;
