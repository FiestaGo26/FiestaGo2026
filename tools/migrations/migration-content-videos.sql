-- Migración: tabla content_videos
-- Vídeos diarios generados con HeyGen + guion Claude.
-- Se aplicó manualmente en el remoto Supabase, este archivo queda
-- versionado para cualquier entorno nuevo (preview branches, dev local).

CREATE TABLE IF NOT EXISTS content_videos (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz   NOT NULL DEFAULT now(),

  scheduled_for           date          NOT NULL,
  pillar                  text          NOT NULL,
  topic                   text,
  script                  text          NOT NULL,
  caption                 text,
  hashtags                text[],
  cta_url                 text,

  heygen_video_id         text,
  heygen_status           text          NOT NULL DEFAULT 'pending',
  video_url               text,
  thumbnail_url           text,
  duration_seconds        numeric,

  generation_started_at   timestamptz,
  completed_at            timestamptz,
  notified_at             timestamptz,
  published_at            timestamptz,
  published_channels      text[],
  error                   text
);

CREATE INDEX IF NOT EXISTS content_videos_scheduled_for_idx ON content_videos (scheduled_for DESC);
CREATE INDEX IF NOT EXISTS content_videos_status_idx        ON content_videos (heygen_status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_videos_pillar_idx        ON content_videos (pillar, created_at DESC);

COMMENT ON TABLE content_videos IS
  'Vídeos diarios generados automáticamente por cron (Claude redacta guion + HeyGen produce avatar parlante). Visibles en /admin → Contenido.';
