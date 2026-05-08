-- Recalcula contactable para proveedores que se registraron antes del fix.
-- TRUE si tienen al menos un canal real.

update providers
set contactable = (
  coalesce(email,     '') <> '' or
  coalesce(phone,     '') <> '' or
  (coalesce(website,  '') <> '' and website not similar to '%instagram.com%' and website not similar to '%tiktok.com%') or
  coalesce(instagram, '') <> '' or
  coalesce(tiktok,    '') <> ''
)
where contactable = false or contactable is null;

-- Cuántos quedan ahora con/sin canal:
select
  count(*) filter (where contactable)     as con_canal,
  count(*) filter (where not contactable) as sin_canal,
  count(*)                                 as total
from providers;
