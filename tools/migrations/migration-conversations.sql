-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Agente conversacional de captación (WhatsApp)
-- Guarda el hilo de conversación con cada proveedor para que la IA
-- pueda mantener el contexto y decidir si responde sola (casos claros)
-- o escala a un humano (casos sensibles). "Red de seguridad".
-- ═════════════════════════════════════════════════════════════════

-- 1. Columnas de estado de conversación en providers
alter table providers
  add column if not exists whatsapp            text,
  add column if not exists conversation_status text default 'none',  -- none | active | escalated | registered | stopped
  add column if not exists conversation_intent text,                 -- último intent detectado por la IA
  add column if not exists last_inbound_at      timestamptz,
  add column if not exists last_outbound_at     timestamptz,
  add column if not exists conversation_unread  int default 0;       -- mensajes entrantes sin atender por el admin

-- 2. Hilo de mensajes (entrantes y salientes) por proveedor
create table if not exists provider_conversations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  provider_id   uuid references providers(id) on delete cascade,
  channel       text not null default 'whatsapp',               -- whatsapp | email | instagram
  direction     text not null check (direction in ('in', 'out')),
  body          text not null,
  ai_generated  boolean default false,   -- lo redactó la IA
  autosent      boolean default false,   -- la IA lo envió sola (sin aprobación humana)
  intent        text,                    -- intent detectado en el mensaje entrante
  needs_human   boolean default false,   -- la IA marcó que requiere intervención
  reason        text,                    -- por qué escaló / por qué autorespondió
  wa_message_id text,                    -- id del mensaje en la API de WhatsApp (dedupe)
  -- número crudo del remitente cuando aún no hay proveedor asociado
  from_phone    text
);

create index if not exists provider_conversations_provider_idx
  on provider_conversations(provider_id, created_at);
create index if not exists provider_conversations_wamid_idx
  on provider_conversations(wa_message_id) where wa_message_id is not null;
create index if not exists providers_conversation_status_idx
  on providers(conversation_status) where conversation_status in ('active', 'escalated');

select 'OK · provider_conversations + columnas de conversación en providers' as resultado;
