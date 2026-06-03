-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Conversaciones con proveedores
-- Tabla que guarda el hilo de mensajes con cada proveedor por canal
-- (WhatsApp, Instagram, email). Permite a Claude redactar respuestas
-- coherentes con el historial completo.
-- ═════════════════════════════════════════════════════════════════

create table if not exists provider_conversations (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null references providers(id) on delete cascade,
  channel         text not null check (channel in ('whatsapp','instagram','email','other')),
  messages        jsonb not null default '[]'::jsonb,
  status          text not null default 'active' check (status in ('active','won','lost','paused')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create index if not exists provider_conversations_provider_idx
  on provider_conversations(provider_id);

create index if not exists provider_conversations_active_idx
  on provider_conversations(status, last_message_at desc)
  where status = 'active';

-- Forma de cada elemento en messages JSONB:
--   {
--     "role": "us" | "them",          -- quién mandó el mensaje
--     "content": "texto",
--     "at": "2026-06-03T11:00:00Z",
--     "generated_by_ai": true | false  -- si lo redactó Claude
--   }

notify pgrst, 'reload schema';

-- Verificación
select count(*) as conversaciones_existentes from provider_conversations;
