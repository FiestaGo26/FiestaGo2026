-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Añadir columna user_prompt a social_posts
-- Para almacenar el prompt del admin cuando se genera un post a medida.
-- Pega en Supabase → SQL Editor → New query → Run
-- ═════════════════════════════════════════════════════════════════

alter table social_posts add column if not exists user_prompt text;
alter table social_posts add column if not exists hook_overlay text;
alter table social_posts add column if not exists visual_prompt text;

-- Verificación
select column_name, data_type
from information_schema.columns
where table_name = 'social_posts' and table_schema = 'public'
order by ordinal_position;
