-- Precio según invitados: el proveedor pone su precio, los invitados que
-- incluye (mínimo) y el precio por invitado de más. El total lo calcula el
-- sistema (lib/pricing.ts → priceForGuests) y es el precio final.
alter table public.provider_services add column if not exists included_guests   int;
alter table public.provider_services add column if not exists extra_guest_price numeric;

-- Señal al reservar: siempre entre el 10 % y el 20 % (lo que aceptan los
-- clientes según la 5.ª simulación). Normaliza los servicios existentes.
update public.provider_services
   set deposit_pct = least(greatest(coalesce(deposit_pct, 10), 10), 20);
alter table public.provider_services alter column deposit_pct set default 10;

-- "Te llamamos": nueva clase de solicitud y franja preferida
alter table public.date_holds add column if not exists preferred_time text;
alter table public.date_holds drop constraint if exists date_holds_kind_check;
alter table public.date_holds add constraint date_holds_kind_check
  check (kind = any (array['hold', 'quote', 'call']));
