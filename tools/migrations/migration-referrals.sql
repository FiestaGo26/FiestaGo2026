-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Sistema de referidos para proveedores
-- Cada proveedor puede tener un "padrino" (referred_by) que lo invitó.
-- Cuando alguien se registra vía /registro-proveedor?ref=ID, se guarda quién le invitó.
-- ═════════════════════════════════════════════════════════════════

alter table providers add column if not exists referred_by uuid references providers(id) on delete set null;
create index if not exists providers_referred_by_idx on providers(referred_by);

-- Verificación
select 'OK · campo referred_by creado en providers' as resultado;
