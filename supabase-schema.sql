-- ═══════════════════════════════════════════════════════════════════════════
-- FIEGAGO — SUPABASE SCHEMA
-- Ejecuta esto en: supabase.com → tu proyecto → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensiones necesarias
create extension if not exists "uuid-ossp";

-- ─── ENUM TYPES ─────────────────────────────────────────────────────────────

create type provider_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type booking_status  as enum ('pending', 'confirmed', 'cancelled', 'completed', 'disputed');
create type event_type      as enum ('boda', 'cumpleanos', 'bautizo', 'comunion', 'fiesta_privada', 'evento_corporativo', 'otro');
create type category_id     as enum ('foto','catering','espacios','musica','flores','pastel','belleza','animacion','transporte','papeleria','planner','joyeria');
create type source_type     as enum ('web','instagram','tiktok','manual','referral');
create type pack_status     as enum ('active','inactive','draft');

-- ─── PROVIDERS ──────────────────────────────────────────────────────────────

create table providers (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  -- Info básica
  name            text not null,
  slug            text unique,
  category        category_id not null,
  city            text not null,
  address         text,
  description     text,
  short_desc      text,

  -- Contacto
  email           text,
  phone           text,
  website         text,
  instagram       text,
  tiktok          text,

  -- Negocio
  price_base      numeric(10,2),
  price_unit      text default 'por evento',
  years_active    int,
  specialties     text[],
  tag             text,

  -- Social (para proveedores de Instagram/TikTok)
  social_handle   text,
  social_platform text,
  social_url      text,
  followers       int default 0,

  -- Métricas FiestaGo
  rating          numeric(3,2) default 0,
  total_reviews   int default 0,
  total_bookings  int default 0,
  total_revenue   numeric(12,2) default 0,
  commission_paid numeric(12,2) default 0,

  -- Estado y flags
  status          provider_status default 'pending',
  featured        boolean default false,
  verified        boolean default false,
  photo_url       text,
  photo_idx       int default 0,

  -- Captación (agente IA)
  source          source_type default 'manual',
  agent_score     char(1),
  agent_notes     text,
  agent_fit_score int,
  conversion_prob int,
  outreach_sent   boolean default false,
  outreach_at     timestamptz,
  outreach_email  text,

  -- Auth (si se registra como usuario)
  user_id         uuid references auth.users(id) on delete set null
);

-- Índices
create index providers_category_idx on providers(category);
create index providers_city_idx     on providers(city);
create index providers_status_idx   on providers(status);
create index providers_featured_idx on providers(featured) where featured = true;

-- Trigger: actualizar updated_at automáticamente
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger providers_updated_at
  before update on providers
  for each row execute function update_updated_at();

-- Auto-generar slug
create or replace function generate_slug()
returns trigger as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(regexp_replace(new.name, '[^a-zA-Z0-9\s]', '', 'g'));
    new.slug := regexp_replace(new.slug, '\s+', '-', 'g');
    new.slug := new.slug || '-' || substr(new.id::text, 1, 6);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger providers_slug
  before insert on providers
  for each row execute function generate_slug();

-- ─── PACKS ──────────────────────────────────────────────────────────────────

create table packs (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  name        text not null,
  slug        text unique,
  emoji       text,
  description text,
  highlight   text,
  price_base  numeric(10,2) not null,
  price_note  text,
  duration    text,
  max_guests  int,
  includes    text[],
  status      pack_status default 'active',
  photo_seed  text,
  color       text,
  sort_order  int default 0,

  total_bookings int default 0,
  total_revenue  numeric(12,2) default 0
);

create trigger packs_updated_at
  before update on packs for each row execute function update_updated_at();

-- Packs iniciales
insert into packs (name, emoji, description, highlight, price_base, duration, max_guests, includes, photo_seed, color, sort_order) values
('Pack Cumple Básico',   '🎂', 'Todo lo esencial para una fiesta de cumpleaños perfecta sin complicaciones.',
  'El más popular', 199, '3 horas', 15, ARRAY['Decoración temática','Tarta personalizada','Globos y guirnaldas','Coordinador de evento'],
  'kids', '#E8553E', 1),
('Pack Cumple Premium',  '🎉', 'La experiencia completa con animación, foto y catering para un cumpleaños de lujo.',
  'Experiencia completa', 449, '5 horas', 30, ARRAY['Todo lo del Básico','Animador profesional','Fotógrafo 2 horas','Catering snacks & bebidas','Photocall temático'],
  'party', '#8B5CF6', 2),
('Pack Fiesta en Casa',  '🏠', 'Montamos la fiesta en tu domicilio. Tú solo abres la puerta.',
  'Sin desplazamientos', 299, '4 horas', 25, ARRAY['Montaje en tu domicilio','Decoración personalizada','DJ o música ambiente','Servicio de catering básico'],
  'kids', '#3D7A52', 3),
('Pack Boda Íntima',     '💍', 'La boda perfecta para hasta 50 personas con todo coordinado.',
  'Recuerdos para siempre', 899, 'Todo el día', 50, ARRAY['Espacio exclusivo','Fotógrafo y vídeo','Decoración floral','Catering premium','Wedding planner'],
  'espacios', '#C8860A', 4);

-- ─── BOOKINGS ───────────────────────────────────────────────────────────────

create table bookings (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  -- Tipo: provider o pack
  booking_type    text not null check (booking_type in ('provider','pack')),
  provider_id     uuid references providers(id) on delete set null,
  pack_id         uuid references packs(id) on delete set null,

  -- Cliente
  client_name     text not null,
  client_email    text not null,
  client_phone    text,
  user_id         uuid references auth.users(id) on delete set null,

  -- Evento
  event_date      date not null,
  event_type      event_type default 'otro',
  city            text,
  guests          int,
  message         text,

  -- Económico
  total_amount    numeric(10,2) not null,
  commission_rate numeric(5,4) default 0.08,
  commission_amt  numeric(10,2) default 0,
  provider_earns  numeric(10,2),
  is_free_txn     boolean default false,

  -- Estado y pagos
  status          booking_status default 'pending',
  stripe_session_id   text,
  stripe_payment_intent text,
  paid_at         timestamptz,
  confirmed_at    timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,

  -- Reseña
  review_rating   int check (review_rating between 1 and 5),
  review_text     text,
  reviewed_at     timestamptz
);

create index bookings_provider_idx on bookings(provider_id);
create index bookings_client_idx   on bookings(client_email);
create index bookings_date_idx     on bookings(event_date);
create index bookings_status_idx   on bookings(status);

create trigger bookings_updated_at
  before update on bookings for each row execute function update_updated_at();

-- ─── NOTIFICATIONS (panel admin en tiempo real) ──────────────────────────────

create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  read        boolean default false,
  type        text not null, -- 'new_provider' | 'new_booking' | 'new_review' | 'payment' | 'agent_result'
  title       text not null,
  message     text,
  data        jsonb,
  action_url  text
);

create index notifications_read_idx on notifications(read) where read = false;

-- ─── AGENT SESSIONS (registro de ejecuciones del agente) ────────────────────

create table agent_sessions (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz default now(),
  completed_at timestamptz,

  category     category_id not null,
  city         text not null,
  sources      text[],
  target_count int,
  tone         text,

  -- Resultados
  found_count    int default 0,
  qualified_count int default 0,
  added_count    int default 0,
  emailed_count  int default 0,
  score_a        int default 0,
  score_b        int default 0,

  status       text default 'running', -- running | completed | error
  error_msg    text,
  providers_found uuid[]
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────

alter table providers   enable row level security;
alter table packs       enable row level security;
alter table bookings    enable row level security;
alter table notifications enable row level security;
alter table agent_sessions enable row level security;

-- Proveedores aprobados: visibles para todos
create policy "providers_public_read" on providers
  for select using (status = 'approved');

-- Admin: acceso total (via service role key, nunca expuesto al cliente)
-- Las rutas /api/admin/* usan SUPABASE_SERVICE_ROLE_KEY

-- Packs activos: visibles para todos
create policy "packs_public_read" on packs
  for select using (status = 'active');

-- Reservas: solo el cliente puede ver las suyas
create policy "bookings_own_read" on bookings
  for select using (auth.jwt() ->> 'email' = client_email);

create policy "bookings_insert" on bookings
  for insert with check (true);

-- ─── REALTIME (para notificaciones live en el admin) ────────────────────────

alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table providers;
alter publication supabase_realtime add table bookings;

-- ─── FUNCIÓN: calcular comisión ──────────────────────────────────────────────

create or replace function calculate_commission(
  p_provider_id uuid,
  p_amount numeric
) returns jsonb as $$
declare
  txn_count int;
  commission_rate numeric;
  commission_amt  numeric;
begin
  select total_bookings into txn_count
  from providers where id = p_provider_id;

  if txn_count = 0 then
    commission_rate := 0;
    commission_amt  := 0;
  else
    commission_rate := 0.08;
    commission_amt  := round(p_amount * 0.08, 2);
  end if;

  return jsonb_build_object(
    'rate',         commission_rate,
    'amount',       commission_amt,
    'provider_earns', p_amount - commission_amt,
    'is_free',      commission_rate = 0
  );
end;
$$ language plpgsql security definer;

-- ─── FUNCIÓN: crear notificación ─────────────────────────────────────────────

create or replace function notify_admin(
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb default '{}'::jsonb,
  p_action_url text default null
) returns void as $$
begin
  insert into notifications (type, title, message, data, action_url)
  values (p_type, p_title, p_message, p_data, p_action_url);
end;
$$ language plpgsql security definer;

-- ─── TRIGGER: notificar admin cuando llega proveedor nuevo ───────────────────

create or replace function on_provider_insert()
returns trigger as $$
begin
  perform notify_admin(
    'new_provider',
    'Nuevo proveedor registrado',
    new.name || ' · ' || new.city || ' · ' || new.category,
    jsonb_build_object('provider_id', new.id, 'name', new.name, 'city', new.city, 'category', new.category, 'source', new.source),
    '/admin/providers/' || new.id
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger providers_notify_admin
  after insert on providers
  for each row execute function on_provider_insert();

-- ─── TRIGGER: notificar admin cuando llega reserva nueva ────────────────────

create or replace function on_booking_insert()
returns trigger as $$
begin
  perform notify_admin(
    'new_booking',
    'Nueva reserva',
    new.client_name || ' · ' || new.event_date || ' · ' || new.total_amount || '€',
    jsonb_build_object('booking_id', new.id, 'client', new.client_name, 'amount', new.total_amount, 'date', new.event_date),
    '/admin/bookings/' || new.id
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger bookings_notify_admin
  after insert on bookings
  for each row execute function on_booking_insert();
