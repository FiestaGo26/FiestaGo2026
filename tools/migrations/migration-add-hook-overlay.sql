-- Añade campo hook_overlay para texto que va sobre el vídeo/imagen en TikTok/IG.
-- Pega y ejecuta en Supabase → SQL Editor.

alter table social_posts
  add column if not exists hook_overlay text;
