-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Verificación documental del proveedor
-- El proveedor sube DNI/CIF/seguro RC → el admin lo revisa → si aprueba,
-- providers.verified pasa a true y el sello "Verificado" aparece en la
-- ficha pública.
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists verification_status text default 'none'
    check (verification_status in ('none','pending','approved','rejected')),
  add column if not exists verification_doc_path text,
  add column if not exists verification_doc_type text,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_notes text;

create index if not exists providers_verification_pending_idx
  on providers(verification_status) where verification_status = 'pending';

-- IMPORTANTE: además ejecuta en el dashboard de Supabase → Storage:
-- New bucket → nombre "verification-docs", público = NO (privado).
-- O ejecuta el siguiente SQL (requiere permisos sobre storage.buckets):
insert into storage.buckets (id, name, public)
  values ('verification-docs', 'verification-docs', false)
  on conflict (id) do nothing;

select 'OK · columnas de verificación + bucket privado' as resultado;
