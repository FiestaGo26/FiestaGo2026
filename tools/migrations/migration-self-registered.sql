-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Marca de "se ha registrado en la web por sí mismo"
-- Sirve para distinguir scrapeados vs. proveedores que respondieron
-- al outreach y se dieron de alta. Estos pasan al tile destacado
-- "Registrados pendientes de aprobación".
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists self_registered boolean default false,
  add column if not exists self_registered_at timestamptz;

create index if not exists providers_self_registered_idx
  on providers(self_registered, status) where self_registered = true;

-- Verificación
select 'OK · Columnas self_registered + self_registered_at añadidas' as resultado;
