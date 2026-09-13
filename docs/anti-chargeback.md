# Infraestructura de evidencia anti-chargeback

Qué se captura por cada reserva, dónde vive, y cómo llega a Stripe cuando el
cliente reclama el cargo a su banco.

## El problema

El cliente paga un anticipo del 25-30% al cerrar la reserva y el resto dos meses
antes del evento. Entre el primer cargo y el servicio pueden pasar 6-8 meses.
Cuando el cargo aparece en su extracto puede que ya no lo recuerde, y el plazo de
reclamación de Visa/Mastercard cuenta **desde la fecha del servicio**: la
exposición real llega a los 120 días posteriores al evento.

Para ganar una disputa por "servicio no prestado" o "no conforme" hace falta
demostrar tres cosas, con fecha:

1. Que el cliente aceptó unas condiciones concretas, y cuáles.
2. Que el servicio se prestó.
3. Que se le avisó de todo por escrito antes de cobrarle.

## Las cuatro tablas

Migración: `tools/migrations/migration-anti-chargeback.sql`.

| Tabla | Qué prueba | Mutable |
|---|---|---|
| `terms_versions` | El texto legal vigente en cada momento, con su hash SHA-256 | No (salvo bajar `is_current`) |
| `booking_consents` | Qué texto vio el cliente, cuándo, desde qué IP y navegador | No |
| `service_confirmations` | Que el proveedor certificó haber prestado el servicio | No |
| `dispute_events` | La disputa y copia exacta de lo enviado a Stripe | Sí (expediente vivo) |

Las tres primeras tienen triggers `BEFORE UPDATE`/`BEFORE DELETE` que lanzan
excepción. No se saltan ni con `service_role`: una fila que se puede editar no
vale como prueba, y poder declarar eso ante el emisor es parte del argumento.

RLS activado en las cuatro, sin políticas: solo `service_role` (los endpoints del
servidor) entra.

## Captura del consentimiento

Ocurre en `/pago-inicial/[bookingId]` y `/pago-restante/[bookingId]`:

- La cláusula de pérdida del anticipo se renderiza **visible en la página**
  (`CheckoutConsentForm`), con los importes y fechas reales de esa reserva. No va
  detrás de un enlace ni de un modal: lo que se defiende después es que el texto
  estaba en el DOM en el momento del pago.
- **Dos checkboxes separados**, ninguno premarcado: condiciones generales +
  privacidad por un lado, política de reembolso y pérdida del anticipo por otro.
- Al enviar, el Server Action `startBookingPayment` escribe la fila en
  `booking_consents` **antes** de crear el PaymentIntent. Si el consentimiento
  falla, no se cobra.
- El texto que el navegador renderizó viaja de vuelta y se compara con el que el
  servidor reconstruye. Si no coinciden (la reserva cambió con la página
  abierta), se rechaza el pago y se pide recargar.

### IP real detrás de Netlify

`lib/net/client-ip.ts`. Orden: `x-nf-client-connection-ip`, luego
`x-forwarded-for` (**primer** valor de la lista, no el último), luego
`x-real-ip`. El user agent se guarda entero, sin truncar. Si la IP no es pública
se registra un `console.warn` — una evidencia con `::1` no prueba nada.

## PaymentIntent

`lib/payments/payment-intent.ts`:

- `statement_descriptor_suffix: 'FIESTAGO'` — el cliente tiene que reconocer el
  cargo ocho meses después; si ve el nombre de la SL, abre disputa por fraude sin
  pensarlo.
- `metadata`: `booking_id`, `consent_id`, `service_date`, `payment_stage`,
  `provider_id`, `client_email`. Es el único hilo del charge al expediente.
- `payment_method_options.card.request_three_d_secure: 'any'` en los dos tramos.

**El segundo plazo se cobra on-session.** Nunca off-session con la tarjeta
guardada: sin SCA no hay traslado de responsabilidad al emisor y una disputa por
fraude se pierde de oficio. El cron de recordatorios manda el enlace al checkout
del saldo por email y por WhatsApp; el cliente autentica con su banco.

## Webhook

`app/api/webhooks/stripe/route.ts`, firma verificada con `STRIPE_WEBHOOK_SECRET`.

- `payment_intent.succeeded` → marca el tramo cobrado (`lib/payments/mark-paid.ts`).
- `charge.dispute.created` → registra en `dispute_events`, resuelve el booking
  desde la metadata del PaymentIntent, compila la evidencia, la adjunta y avisa
  por email a `contacto@fiestago.es`.
- `charge.dispute.updated` / `closed` / `funds_withdrawn` → actualiza estado y
  desenlace.

**No se envía con `submit: true` automáticamente.** La evidencia queda como
borrador: el envío es irreversible y una evidencia mal montada no se puede
corregir. Stripe la manda sola al llegar `evidence_due_by`, así que el peor caso
es que se envíe el borrador.

## Paquete de evidencia

`lib/disputes/evidence.ts` + `lib/disputes/documents.ts`.

| Campo Stripe | Origen |
|---|---|
| `service_date` | `service_confirmations.service_date` o `bookings.event_date` |
| `service_documentation` | PDF con reserva, proveedor, evento y confirmación |
| `customer_communication` | PDF con emails, chat de la reserva y WhatsApp |
| `refund_policy` | PDF con el texto literal de la versión aceptada + hash |
| `refund_policy_disclosure` | Dónde y cuándo se mostró, con timestamp e IP |
| `customer_name`, `customer_email_address` | Ficha del cliente |
| `billing_address` | Dirección de la factura emitida, o localidad del evento |
| `customer_purchase_ip` | `booking_consents.ip_address` |
| `product_description` | Categoría, proveedor, fecha e importe |
| `uncategorized_text` | Resumen cronológico completo |

Los PDF se generan con un escritor propio sin dependencias
(`lib/disputes/pdf.ts`): en el runtime de Netlify no hay Chromium, y el webhook
necesita bytes de PDF sin nadie delante. Se suben con
`stripe.files.create({ purpose: 'dispute_evidence' })`.

## Confirmación del proveedor

Panel → Reservas → **"Confirmar servicio prestado"**, habilitado desde el día del
evento (hora de Madrid). Escribe en `service_confirmations` vía Server Action
(`app/(public)/proveedor/panel/actions.ts`) con la IP del proveedor.

Si a las 24 h del evento no ha confirmado, el cron
`/api/cron/service-confirmation-reminders` le manda un email explicándole que sin
esa confirmación se pierde la disputa — y con ella su cobro.

## Panel de admin

`/admin/disputas`:

- Listado con estado, importe y cuenta atrás hasta `evidence_due_by`.
- Detalle con el expediente completo y la evidencia editable campo por campo.
- Botones de recompilar (regenera y readjunta los PDF), guardar borrador y
  **enviar** (`submit: true`, con confirmación).
- Listado de **reservas vulnerables**: eventos celebrados y cobrados sin
  confirmación del proveedor. Hoy no hay disputa; si llega, se pierde.

## Retención

Ver `docs/retencion-evidencia.md`. Resumen: 14 meses desde la fecha del evento,
base legal interés legítimo, declarado en la política de privacidad, y ninguna
tarea de limpieza puede tocar estas tablas.

## Puesta en marcha

1. Aplicar `tools/migrations/migration-anti-chargeback.sql` en Supabase.
2. Configurar en Netlify: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `DISPUTES_ALERT_EMAIL`, `CRON_SECRET` y (opcional)
   `WHATSAPP_SECOND_PAYMENT_TEMPLATE`.
   En Stripe → Settings → Public details hay que dejar configurado el **prefijo
   abreviado del descriptor**; sin él la cuenta rechaza
   `statement_descriptor_suffix` y el cargo aparecería en el extracto con el
   nombre de la sociedad. Si eso pasa, el cobro sigue funcionando (se reintenta
   sin sufijo) pero queda un `console.error` gritándolo en los logs.
3. En Stripe: Developers → Webhooks → `https://fiestago.es/api/webhooks/stripe`
   con los cinco eventos (`payment_intent.succeeded` y los cuatro
   `charge.dispute.*`).
4. Programar el cron `service-confirmation-reminders` (ver `docs/crons.md`).
5. Comprobar la primera reserva de prueba: que `booking_consents` tenga IP
   pública, que un `UPDATE` sobre esa fila falle, y que una disputa simulada
   desde el dashboard de test cree la fila y adjunte los tres PDF.
