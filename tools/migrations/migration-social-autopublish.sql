-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Publicación automática en Instagram/TikTok (Upload-Post)
-- Aplicada en producción el 23-10-2026.
-- ═════════════════════════════════════════════════════════════════

alter table public.social_posts add column if not exists uploadpost_request_id text;
alter table public.social_posts add column if not exists publish_error text;
alter table public.social_posts add column if not exists publish_attempts integer not null default 0;
alter table public.social_posts add column if not exists published_urls jsonb;
alter table public.social_posts add column if not exists review jsonb;   -- revisión automática de marca

alter table public.content_videos add column if not exists uploadpost_request_id text;
alter table public.content_videos add column if not exists publish_error text;
alter table public.content_videos add column if not exists publish_attempts integer not null default 0;
alter table public.content_videos add column if not exists published_urls jsonb;
alter table public.content_videos add column if not exists metrics jsonb;
alter table public.content_videos add column if not exists metrics_last_synced_at timestamptz;
alter table public.content_videos add column if not exists experiment text;

alter table public.ceo_settings add column if not exists social_autopublish boolean not null default true;
alter table public.ceo_settings add column if not exists social_max_per_day integer not null default 2;
