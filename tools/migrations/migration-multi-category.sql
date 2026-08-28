-- ═══════════════════════════════════════════════════════════════════════════
-- MULTI-CATEGORY · una cuenta de proveedor puede pertenecer a N categorías
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Añadimos providers.categories (category_id[]) como fuente de verdad para
-- las categorías del proveedor. Mantenemos providers.category como la
-- categoría "principal" (la representativa, para hero photo, labels, etc.)
-- que sigue funcionando exactamente igual para todo el código existente.
--
-- El trigger sincroniza ambas: si el proveedor edita el array, la primera
-- entrada se convierte automáticamente en la principal.
--
-- IDEMPOTENTE — se puede correr varias veces sin efectos secundarios.

-- 1. Columna nueva ─────────────────────────────────────────────────────
alter table providers
  add column if not exists categories category_id[] not null default '{}';

-- 2. Backfill de datos existentes ───────────────────────────────────────
--    Los proveedores que ya existen quedan con categories = [category]
update providers
   set categories = ARRAY[category]::category_id[]
 where categories = '{}' or categories is null;

-- 3. Constraint: al menos una categoría siempre ────────────────────────
alter table providers
  drop constraint if exists providers_categories_not_empty;
alter table providers
  add  constraint providers_categories_not_empty
       check (array_length(categories, 1) >= 1);

-- 4. Índice GIN para búsquedas por contenido ───────────────────────────
create index if not exists providers_categories_gin_idx
  on providers using gin (categories);

-- 5. Trigger de sincronización ─────────────────────────────────────────
--    - Al INSERT/UPDATE:
--        · si categories está vacío pero category existe → categories = [category]
--        · si categories tiene items → category = categories[1] (primaria)
create or replace function sync_provider_categories()
returns trigger as $$
begin
  -- categories vacío pero category presente → poblar categories
  if (new.categories is null or array_length(new.categories, 1) is null)
     and new.category is not null then
    new.categories := ARRAY[new.category]::category_id[];
  end if;

  -- categories tiene items → mantener category = primer elemento
  if new.categories is not null and array_length(new.categories, 1) >= 1 then
    new.category := new.categories[1];
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists providers_sync_categories on providers;
create trigger providers_sync_categories
  before insert or update of category, categories on providers
  for each row execute function sync_provider_categories();

-- 6. Verificación ──────────────────────────────────────────────────────
--    Debería devolver 0 filas si todo se ha migrado bien.
select id, name, category, categories
  from providers
 where array_length(categories, 1) is null
    or categories[1] <> category
 limit 5;

-- Debería devolver >= 1 (la fila que se ha creado en el select anterior no
-- cuenta; esta consulta lista una muestra de proveedores con múltiples cats).
select id, name, category, categories
  from providers
 where array_length(categories, 1) > 1
 limit 5;
