-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Comisión siempre 8% (eliminar "primera reserva gratis")
--
-- El modelo económico es: el cliente paga base + 8% como "Garantía de
-- Éxito" en TODA reserva. El proveedor SIEMPRE cobra el 100% de su
-- precio base. Sin excepciones.
--
-- Cambios:
--   1. Función calculate_commission ya no devuelve 0% para la primera
--      reserva del proveedor. Siempre 8%.
--   2. La columna bookings.is_free_txn se mantiene por compatibilidad
--      pero ya no se setea a true desde aquí (default false).
-- ═════════════════════════════════════════════════════════════════

create or replace function calculate_commission(
  p_provider_id uuid,
  p_amount      numeric
)
returns table (
  commission_rate numeric,
  commission_amt  numeric,
  provider_earns  numeric,
  is_free_txn     boolean
)
language plpgsql
as $$
declare
  comm_rate numeric;
  comm_amt  numeric;
begin
  -- Siempre 8%. Sin excepción de "primera reserva gratis".
  comm_rate := 0.08;
  comm_amt  := round(p_amount * comm_rate, 2);

  return query
    select comm_rate,
           comm_amt,
           p_amount,  -- proveedor cobra el 100% de su precio base
           false;     -- ya nunca es "free txn"
end;
$$;

notify pgrst, 'reload schema';
