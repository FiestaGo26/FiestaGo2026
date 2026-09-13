-- ═════════════════════════════════════════════════════════════════════════
-- FiestaGo · Infraestructura de evidencia anti-chargeback
--
-- Problema que resuelve:
--   El cliente paga un anticipo del 25-30% al cerrar la reserva y el resto
--   dos meses antes del evento. Entre el primer cargo y la fecha del
--   servicio pueden pasar 6-8 meses. El plazo de reclamación de
--   Visa/Mastercard cuenta desde la FECHA DEL SERVICIO, no desde el cobro,
--   así que la exposición real llega a los 120 días posteriores al evento.
--   La evidencia tiene que sobrevivir a todo ese periodo (hasta 14 meses
--   desde el cobro) y tiene que ser inmutable para valer como prueba.
--
-- Cuatro tablas, todas registros probatorios:
--   · terms_versions        — versiona el texto legal (nunca se edita)
--   · booking_consents      — una fila por aceptación del cliente
--   · service_confirmations — el proveedor certifica que prestó el servicio
--   · dispute_events        — traza de cada disputa y de lo que se envió
--
-- Reglas de integridad:
--   · RLS activado en las cuatro. Escritura y lectura solo service_role
--     (los endpoints usan createAdminClient, que bypassa RLS). Ningún
--     cliente anon/authenticated escribe ni lee directamente.
--   · Triggers BEFORE UPDATE / BEFORE DELETE que lanzan excepción en
--     terms_versions, booking_consents y service_confirmations. Una fila
--     que se puede editar no vale como prueba ante el emisor.
--   · dispute_events SÍ es actualizable: es un expediente vivo (Stripe
--     manda updates del estado, Mariano edita la evidencia antes de
--     enviarla). Lo inmutable ahí es lo que ya se envió, que queda
--     congelado en evidence_payload al llamar a submit.
--
-- Ejecutar en: supabase.com → proyecto → SQL Editor → New query
-- ═════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── 1 · TERMS_VERSIONS ─────────────────────────────────────────────────
-- Versiona el texto legal. Nunca se edita una versión publicada; se crea
-- otra. El hash SHA-256 del contenido se calcula en el servidor (trigger
-- BEFORE INSERT) para que nadie pueda declarar un hash que no corresponda
-- al texto guardado.

create table if not exists terms_versions (
  id             uuid primary key default gen_random_uuid(),
  version_label  text not null,                       -- ej. '2026-09-a'
  document_type  text not null check (document_type in ('terms','guarantee','privacy')),
  content        text not null,                       -- el texto literal completo
  content_hash   text,                                -- SHA-256 hex de content (lo pone el trigger)
  published_at   timestamptz not null default now(),
  is_current     boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (document_type, version_label)
);

create index if not exists terms_versions_current_idx
  on terms_versions(document_type, published_at desc);

-- Hash calculado siempre en el servidor. Si el llamante manda un hash
-- que no cuadra con el contenido, la inserción falla: preferimos romper
-- el alta a guardar una prueba incoherente.
create or replace function terms_versions_set_hash()
returns trigger as $$
declare
  computed text;
begin
  computed := encode(digest(new.content, 'sha256'), 'hex');
  if new.content_hash is not null and lower(new.content_hash) <> computed then
    raise exception 'content_hash no corresponde al contenido (esperado %, recibido %)',
      computed, new.content_hash;
  end if;
  new.content_hash := computed;
  return new;
end;
$$ language plpgsql;

drop trigger if exists terms_versions_hash on terms_versions;
create trigger terms_versions_hash
  before insert on terms_versions
  for each row execute function terms_versions_set_hash();

-- ─── 2 · BOOKING_CONSENTS ───────────────────────────────────────────────
-- Una fila por aceptación. Es la pieza central del expediente: prueba QUÉ
-- texto vio el cliente, CUÁNDO lo aceptó y DESDE DÓNDE.
--
-- displayed_clause_text guarda el texto literal de la cláusula de pérdida
-- del adelanto tal y como se renderizó en pantalla — no una referencia a
-- un documento que después podría cambiar.

create table if not exists booking_consents (
  id                       uuid primary key default gen_random_uuid(),
  booking_id               uuid not null references bookings(id) on delete restrict,
  user_id                  uuid references auth.users(id) on delete no action,
  terms_version_id         uuid not null references terms_versions(id) on delete restrict,
  content_hash             text not null,   -- copiado de la versión aceptada
  displayed_clause_text    text not null,   -- literal mostrado en pantalla
  advance_forfeit_accepted boolean not null default false,
  accepted_at              timestamptz not null default now(),
  ip_address               inet,
  user_agent               text,
  page_url                 text,
  accepted_locale          text,
  created_at               timestamptz not null default now()
);

create index if not exists booking_consents_booking_idx on booking_consents(booking_id);
create index if not exists booking_consents_accepted_idx on booking_consents(accepted_at desc);

-- ─── 3 · SERVICE_CONFIRMATIONS ──────────────────────────────────────────
-- Confirmación del proveedor de que el servicio se prestó. Sin esto, en
-- una disputa por "servicio no prestado" solo tenemos nuestra palabra.

create table if not exists service_confirmations (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete restrict,
  provider_id         uuid references providers(id) on delete no action,
  confirmed_at        timestamptz not null default now(),
  service_date        date not null,
  notes               text,
  ip_address          inet,
  confirmation_method text not null default 'provider_panel'
    check (confirmation_method in ('provider_panel','whatsapp','admin_manual')),
  created_at          timestamptz not null default now()
);

create index if not exists service_confirmations_booking_idx  on service_confirmations(booking_id);
create index if not exists service_confirmations_provider_idx on service_confirmations(provider_id);

-- ─── 4 · DISPUTE_EVENTS ─────────────────────────────────────────────────
-- Traza de cada disputa y de lo que se le mandó a Stripe.

create table if not exists dispute_events (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid references bookings(id) on delete restrict,
  stripe_dispute_id     text not null unique,
  stripe_charge_id      text,
  stripe_payment_intent text,
  amount                integer,               -- en céntimos, tal cual lo manda Stripe
  currency              text,
  reason                text,
  status                text,
  opened_at             timestamptz,
  evidence_due_by       timestamptz,
  evidence_submitted_at timestamptz,
  evidence_payload      jsonb,                 -- copia exacta de lo enviado
  evidence_files        jsonb,                 -- file IDs de Stripe + metadatos
  outcome               text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists dispute_events_dispute_idx  on dispute_events(stripe_dispute_id);
create index if not exists dispute_events_booking_idx  on dispute_events(booking_id);
create index if not exists dispute_events_due_idx      on dispute_events(evidence_due_by)
  where evidence_submitted_at is null;

create or replace function dispute_events_touch()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists dispute_events_updated_at on dispute_events;
create trigger dispute_events_updated_at
  before update on dispute_events
  for each row execute function dispute_events_touch();

-- ─── INMUTABILIDAD ──────────────────────────────────────────────────────
-- Excepción en cualquier UPDATE o DELETE. Aplica también a service_role:
-- los triggers no se saltan con la clave de servicio, que es justo lo que
-- queremos poder declarar ante el emisor de la tarjeta.

create or replace function evidence_row_is_immutable()
returns trigger as $$
begin
  raise exception
    'La tabla % es un registro probatorio inmutable: % no está permitido (fila %)',
    tg_table_name, tg_op, coalesce(old.id::text, '?')
    using hint = 'Para corregir un dato, inserta una fila nueva. Las existentes no se tocan.';
end;
$$ language plpgsql;

drop trigger if exists booking_consents_no_update on booking_consents;
create trigger booking_consents_no_update
  before update on booking_consents
  for each row execute function evidence_row_is_immutable();

drop trigger if exists booking_consents_no_delete on booking_consents;
create trigger booking_consents_no_delete
  before delete on booking_consents
  for each row execute function evidence_row_is_immutable();

drop trigger if exists service_confirmations_no_update on service_confirmations;
create trigger service_confirmations_no_update
  before update on service_confirmations
  for each row execute function evidence_row_is_immutable();

drop trigger if exists service_confirmations_no_delete on service_confirmations;
create trigger service_confirmations_no_delete
  before delete on service_confirmations
  for each row execute function evidence_row_is_immutable();

drop trigger if exists terms_versions_no_delete on terms_versions;
create trigger terms_versions_no_delete
  before delete on terms_versions
  for each row execute function evidence_row_is_immutable();

-- terms_versions · el contenido probatorio (content, content_hash,
-- published_at, version_label, document_type) es intocable. La ÚNICA
-- modificación permitida es bajar is_current de true a false al publicar
-- una versión posterior: es una bandera de publicación, no prueba, y sin
-- ella no se podría versionar nunca el documento. Cualquier otro cambio
-- lanza excepción.
create or replace function terms_versions_guard_update()
returns trigger as $$
begin
  if new.id             is distinct from old.id             or
     new.version_label  is distinct from old.version_label  or
     new.document_type  is distinct from old.document_type  or
     new.content        is distinct from old.content        or
     new.content_hash   is distinct from old.content_hash   or
     new.published_at   is distinct from old.published_at   or
     new.created_at     is distinct from old.created_at     then
    raise exception
      'terms_versions es un registro probatorio: el contenido publicado no se edita (fila %)', old.id
      using hint = 'Publica una versión nueva con publish_terms_version().';
  end if;
  if not (old.is_current and not new.is_current) then
    raise exception
      'terms_versions.is_current solo puede pasar de true a false (fila %)', old.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists terms_versions_no_update on terms_versions;
create trigger terms_versions_no_update
  before update on terms_versions
  for each row execute function terms_versions_guard_update();

-- ─── PUBLICACIÓN DE VERSIONES ───────────────────────────────────────────
-- Inserta la versión nueva y degrada las anteriores del mismo tipo en una
-- sola transacción. Si el contenido es idéntico al de la versión vigente
-- devuelve esa misma fila (idempotente: se puede llamar en cada arranque).

create or replace function publish_terms_version(
  p_document_type text,
  p_version_label text,
  p_content       text
) returns terms_versions as $$
declare
  v_hash    text := encode(digest(p_content, 'sha256'), 'hex');
  v_current terms_versions;
  v_new     terms_versions;
begin
  select * into v_current
    from terms_versions
   where document_type = p_document_type and is_current
   order by published_at desc limit 1;

  if found and v_current.content_hash = v_hash then
    return v_current;
  end if;

  update terms_versions
     set is_current = false
   where document_type = p_document_type and is_current;

  insert into terms_versions (document_type, version_label, content, is_current)
  values (p_document_type, p_version_label, p_content, true)
  returning * into v_new;

  return v_new;
end;
$$ language plpgsql;

-- ─── RLS ────────────────────────────────────────────────────────────────
-- Sin policies: RLS habilitado bloquea a anon y authenticated por defecto.
-- service_role (createAdminClient en el servidor) bypassa RLS y es el
-- único camino de escritura y de lectura. El panel de admin lee a través
-- de endpoints que ya validan x-admin-password.

alter table terms_versions        enable row level security;
alter table booking_consents      enable row level security;
alter table service_confirmations enable row level security;
alter table dispute_events        enable row level security;

-- Si algún día se crea un rol 'admin' de base de datos, esta es la línea
-- que le da lectura (y solo lectura) sin tocar nada más:
--   create policy "admin_reads" on booking_consents for select to admin using (true);

-- ─── RETENCIÓN ──────────────────────────────────────────────────────────
-- No borrar ni anonimizar filas de booking_consents, service_confirmations
-- ni dispute_events antes de 14 meses desde service_date / fecha del
-- evento. Base legal: interés legítimo (defensa frente a reclamaciones).
-- Ver docs/retencion-evidencia.md. Los triggers de arriba ya impiden el
-- borrado accidental de las dos primeras.

comment on table terms_versions is
  'Versiones publicadas del texto legal. Inmutable salvo la bandera is_current. Retención: indefinida.';
comment on table booking_consents is
  'Aceptaciones del cliente en el checkout. Registro probatorio inmutable. Retención mínima: 14 meses desde la fecha del evento.';
comment on table service_confirmations is
  'Confirmación del proveedor de que el servicio se prestó. Registro probatorio inmutable. Retención mínima: 14 meses desde service_date.';
comment on table dispute_events is
  'Expediente de cada disputa de tarjeta y copia exacta de la evidencia enviada a Stripe. Retención mínima: 14 meses desde la apertura.';

-- ─── COLUMNAS AUXILIARES EN BOOKINGS ────────────────────────────────────
-- No son prueba en sí mismas (la prueba está en las cuatro tablas de
-- arriba), son el índice que permite resolver una disputa en minutos:
-- de un charge de Stripe al booking, y del booking a su evidencia.

alter table bookings
  add column if not exists first_payment_intent_id  text,
  add column if not exists second_payment_intent_id text,
  add column if not exists service_confirmed_at     timestamptz,
  add column if not exists service_confirmation_reminder_sent_at timestamptz;

create index if not exists bookings_first_pi_idx  on bookings(first_payment_intent_id);
create index if not exists bookings_second_pi_idx on bookings(second_payment_intent_id);

comment on column bookings.service_confirmed_at is
  'Copia desnormalizada de service_confirmations.confirmed_at para listados y recordatorios. La prueba es la fila de service_confirmations, no esta columna.';

notify pgrst, 'reload schema';

select 'OK · 4 tablas de evidencia anti-chargeback creadas (RLS + inmutabilidad)' as resultado;
