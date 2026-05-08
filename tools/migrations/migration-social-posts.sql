-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Marketing Agent · Migración Supabase
-- 
-- Crea la tabla `social_posts` (cola de aprobación) y el bucket de
-- Supabase Storage `social-posts` (para servir las imágenes/vídeos
-- desde una URL pública en el admin y, futuro, desde la web).
--
-- Pega TODO esto en Supabase → SQL Editor → New query → Run.
-- Es idempotente (puedes correrlo varias veces sin problema).
-- ═════════════════════════════════════════════════════════════════

-- 1. Tabla social_posts
create table if not exists social_posts (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),

  -- Tipo y origen
  template_id     text not null,                -- p.ej. "inspiration_video"
  template_label  text,                         -- p.ej. "Inspiración (vídeo hook)"
  media_type      text not null check (media_type in ('image', 'video')),

  -- Plataforma
  platform        text default 'both' check (platform in ('instagram','tiktok','both')),

  -- Categoría/ciudad opcionales (para targeting)
  category        text,
  city            text,

  -- Contenido generado
  prompt_used     text,
  scene           text,
  topic           text,
  context         jsonb,

  -- Media (URLs públicas en Supabase Storage)
  media_url       text,
  thumbnail_url   text,
  local_path      text,                         -- ruta en el PC del operador (referencia)

  -- Texto
  caption_instagram text,
  caption_tiktok    text,
  hashtags        text[] default '{}',

  -- Workflow
  status          text default 'pending' check (status in ('pending','approved','rejected','published','scheduled')),
  scheduled_for   timestamptz,
  published_at    timestamptz,
  published_to_ig boolean default false,
  published_to_tt boolean default false,

  -- Auditoría
  rejected_reason text,
  approved_at     timestamptz,
  approved_by     text,

  -- Métricas (rellenas tras publicar)
  metric_likes    int default 0,
  metric_comments int default 0,
  metric_shares   int default 0,
  metric_views    int default 0,
  metric_clicks   int default 0,
  metrics_last_synced_at timestamptz
);

create index if not exists social_posts_status_idx     on social_posts(status);
create index if not exists social_posts_created_at_idx on social_posts(created_at desc);
create index if not exists social_posts_scheduled_idx  on social_posts(scheduled_for) where status='scheduled';
create index if not exists social_posts_template_idx   on social_posts(template_id);

-- 2. Bucket de Supabase Storage para los archivos
insert into storage.buckets (id, name, public)
values ('social-posts', 'social-posts', true)
on conflict (id) do update set public = excluded.public;

-- 3. Policies del bucket
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'social_posts_public_read' and tablename = 'objects') then
    create policy social_posts_public_read on storage.objects for select
      using (bucket_id = 'social-posts');
  end if;

  if not exists (select 1 from pg_policies where policyname = 'social_posts_service_write' and tablename = 'objects') then
    create policy social_posts_service_write on storage.objects for insert to service_role
      with check (bucket_id = 'social-posts');
  end if;

  if not exists (select 1 from pg_policies where policyname = 'social_posts_service_update' and tablename = 'objects') then
    create policy social_posts_service_update on storage.objects for update to service_role
      using (bucket_id = 'social-posts');
  end if;

  if not exists (select 1 from pg_policies where policyname = 'social_posts_service_delete' and tablename = 'objects') then
    create policy social_posts_service_delete on storage.objects for delete to service_role
      using (bucket_id = 'social-posts');
  end if;
end $$;

-- 4. Verificación
select
  (select count(*) from social_posts) as total_posts,
  (select count(*) from social_posts where status='pending')   as pendientes,
  (select count(*) from social_posts where status='approved')  as aprobados,
  (select count(*) from social_posts where status='published') as publicados;
