# Retención de la evidencia anti-chargeback

## La regla

**No se borran ni se anonimizan filas de `booking_consents`, `service_confirmations`
ni `dispute_events` antes de 14 meses desde `service_date`** (la fecha del evento).
`terms_versions` se conserva indefinidamente: sin el texto original, las
aceptaciones que apuntan a él dejan de probar nada.

## Por qué 14 meses y no seis

El cliente paga el anticipo al cerrar la reserva y el resto dos meses antes del
evento. Entre el primer cargo y la prestación del servicio pueden pasar 6-8 meses.

El plazo de reclamación de Visa y Mastercard **cuenta desde la fecha del servicio,
no desde el cobro**: hasta 120 días después del evento. Sumando:

```
8 meses (reserva → evento) + 4 meses (ventana de reclamación) ≈ 12 meses
+ margen para arbitraje y prerrequisitos            ≈ 14 meses
```

Una evidencia borrada a los seis meses del cobro se borra justo antes de hacer
falta.

## Base legal (RGPD)

Interés legítimo del responsable, art. 6.1.f RGPD: **defensa frente a
reclamaciones**. Es una finalidad distinta de la ejecución del contrato, con su
propio plazo, y así está declarada en la política de privacidad
(`app/(public)/privacidad/page.tsx`, apartado 5).

El derecho de supresión sobre estos registros se atiende mediante **bloqueo**
(no accesibilidad ordinaria) hasta el vencimiento del plazo, igual que ya se hace
con las facturas por obligación fiscal.

## Qué protege la base de datos por su cuenta

La migración `tools/migrations/migration-anti-chargeback.sql` instala triggers
`BEFORE UPDATE` y `BEFORE DELETE` que lanzan excepción en `booking_consents`,
`service_confirmations` y `terms_versions`. No se saltan con `service_role`: un
`DELETE` desde un script de limpieza falla, no borra a medias.

`dispute_events` sí admite `UPDATE` — es un expediente vivo (Stripe manda cambios
de estado, el panel edita el borrador de evidencia). Lo que queda congelado ahí es
`evidence_payload` en el momento del envío.

Las claves foráneas hacia `bookings`, `providers` y `auth.users` son
`on delete restrict` / `no action` a propósito: borrar una reserva o un proveedor
con evidencia asociada falla en vez de llevarse la prueba por delante.

## Tareas de limpieza

A día de hoy el proyecto **no tiene ninguna tarea de borrado o anonimización
periódica**. Si se añade una (cron de limpieza, script de mantenimiento,
anonimización de cuentas dadas de baja), debe excluir explícitamente:

```
terms_versions
booking_consents
service_confirmations
dispute_events
```

y, de `bookings`, las columnas `service_confirmed_at`, `first_payment_intent_id`
y `second_payment_intent_id`, que son el índice que lleva de un cargo disputado a
su expediente.

Para purgar lo que ya ha cumplido el plazo, la consulta correcta es por fecha del
servicio, no por fecha de creación:

```sql
-- Candidatas a purga: evidencia de eventos celebrados hace más de 14 meses
select bc.id, b.event_date
  from booking_consents bc
  join bookings b on b.id = bc.booking_id
 where b.event_date < (current_date - interval '14 months')
   and not exists (
     select 1 from dispute_events de
      where de.booking_id = b.id
        and de.outcome is null          -- disputa abierta: no se toca
   );
```

Ejecutar esa purga requiere deshabilitar temporalmente los triggers de
inmutabilidad, que es exactamente la fricción que se buscaba: nadie borra
evidencia sin saber que la está borrando.
