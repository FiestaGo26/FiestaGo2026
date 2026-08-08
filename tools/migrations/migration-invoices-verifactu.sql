-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Sistema de facturación Verifactu
-- Aplicado en Supabase. Guardado aquí por trazabilidad.
--
-- Cumple RD 1007/2023 + Orden HAC/1177/2024 en modo "no verifactu"
-- (guardado con integridad, presentable a AEAT bajo requerimiento).
--
-- Dos tipos de factura:
--   commission_fiestago: FiestaGo → Cliente por el 8% de intermediación
--   delegated_provider:  Proveedor → Cliente (emitida por FiestaGo en su
--                        nombre según art. 5 RD 1619/2012)
-- ═════════════════════════════════════════════════════════════════

alter table providers
  add column if not exists consent_delegated_invoicing        boolean default false,
  add column if not exists consent_delegated_invoicing_at     timestamptz,
  add column if not exists consent_delegated_invoicing_version text,
  add column if not exists invoice_series                     text;

create table if not exists invoice_series (
  series      text not null,
  year        int  not null,
  provider_id uuid references providers(id) on delete cascade,
  last_number int  not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (series, year, provider_id)
);

create table if not exists invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_type      text not null
    check (invoice_type in ('commission_fiestago', 'delegated_provider')),
  issuer_provider_id uuid references providers(id) on delete restrict,
  issuer_tax_id     text not null,
  issuer_tax_name   text not null,
  issuer_tax_address text not null,
  recipient_name    text not null,
  recipient_email   text not null,
  recipient_tax_id  text,
  recipient_address text,
  series            text not null,
  year              int not null,
  number            int not null,
  full_number       text not null,
  issue_date        timestamptz not null default now(),
  concept           text not null,
  booking_id        uuid references bookings(id) on delete restrict,
  items_json        jsonb not null,
  base_amount       numeric(10,2) not null,
  tax_rate          numeric(5,2) not null default 21.00,
  tax_amount        numeric(10,2) not null,
  total_amount      numeric(10,2) not null,
  prev_invoice_hash text,
  invoice_hash      text not null,
  qr_content        text not null,
  verifactu_mode    text not null default 'not_sent'
    check (verifactu_mode in ('not_sent','sent','accepted','rejected')),
  verifactu_sent_at timestamptz,
  verifactu_response jsonb,
  pdf_url           text,
  created_at        timestamptz not null default now(),
  cancelled_at      timestamptz,
  cancelled_by_invoice_id uuid references invoices(id)
);

create unique index if not exists invoices_full_number_issuer_idx
  on invoices(full_number, issuer_tax_id);
create index if not exists invoices_booking_idx
  on invoices(booking_id) where booking_id is not null;
create index if not exists invoices_issuer_provider_idx
  on invoices(issuer_provider_id) where issuer_provider_id is not null;
create index if not exists invoices_recipient_email_idx
  on invoices(recipient_email);

alter table invoices        enable row level security;
alter table invoice_series  enable row level security;

-- RPC atómica para reservar el siguiente número de serie sin race conditions.
create or replace function increment_invoice_series(
  p_series      text,
  p_year        int,
  p_provider_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  insert into invoice_series (series, year, provider_id, last_number)
  values (p_series, p_year, p_provider_id, 0)
  on conflict (series, year, provider_id) do nothing;

  update invoice_series
  set last_number = last_number + 1,
      updated_at  = now()
  where series = p_series
    and year   = p_year
    and provider_id is not distinct from p_provider_id
  returning last_number into v_next;

  return v_next;
end;
$$;

revoke execute on function increment_invoice_series from public;
revoke execute on function increment_invoice_series from authenticated;
revoke execute on function increment_invoice_series from anon;

select 'OK · Sistema Verifactu (tablas + RPC + índices)' as resultado;
