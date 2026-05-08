-- ─── Migración: añadir flags y draft de DM a la tabla providers ───────────
-- Pega esto en Supabase → SQL Editor → New query → Run
-- Es idempotente: lo puedes ejecutar varias veces sin problema.

alter table providers
  add column if not exists contactable boolean default false,
  add column if not exists outreach_dm text;

-- Recalcular contactable para los proveedores existentes.
-- TRUE si tienen cualquier canal: email, tel, web, instagram o tiktok.
update providers
  set contactable = (
    coalesce(email,     '') <> '' or
    coalesce(phone,     '') <> '' or
    coalesce(website,   '') <> '' or
    coalesce(instagram, '') <> '' or
    coalesce(tiktok,    '') <> ''
  );

-- Índice para filtrar rápidamente en el admin
create index if not exists providers_contactable_idx on providers(contactable);

-- Comprobación
select
  count(*) filter (where contactable)     as con_canal,
  count(*) filter (where not contactable) as sin_canal,
  count(*) filter (where coalesce(email,'') <> '')     as con_email,
  count(*) filter (where coalesce(instagram,'') <> '') as con_instagram,
  count(*) filter (where coalesce(website,'') <> '')   as con_web,
  count(*)                                              as total
from providers;
