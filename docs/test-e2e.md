# Guía de test end-to-end · FiestaGo

Recorrido paso a paso para probar el flujo completo desde 0 sin necesidad de Stripe activo ni datos fiscales reales. Todo funciona en modo test (env var `FIESTAGO_TEST_MODE=true` en Netlify).

Marca los pasos con ✓ mientras avanzas.

## Preparativos (una vez)

- [ ] Verifica en Netlify que las 4 env vars TEST están configuradas:
  - `FIESTAGO_TAX_ID = X0000000T`
  - `FIESTAGO_TAX_NAME = FiestaGo (modo prueba ...)`
  - `FIESTAGO_TAX_ADDRESS = Calle Prueba 1, 46001 Valencia, España`
  - `FIESTAGO_TEST_MODE = true`
- [ ] Abre la consola de test: `https://fiestago.es/admin-tools/test-mode` (login con tu ADMIN_PASSWORD)
- [ ] Ten a mano 2 pestañas: una como admin (`/admin-tools/test-mode`), otra en incógnito para simular ser cliente.

---

## Fase 1 · Alta del proveedor

- [ ] En incógnito, abre `/registro-proveedor` y crea una cuenta de prueba (usa un email real tuyo tipo `mariano+prov1@gmail.com`)
- [ ] Verifica que llega el email de bienvenida a esa cuenta
- [ ] En `/admin` como admin, aprueba el proveedor
- [ ] Como el proveedor ya aprobado, entra a `/proveedor/panel`

## Fase 2 · Configuración del panel del proveedor

- [ ] **Mi perfil**: rellena descripción, foto, teléfono, y activa el toggle verde **"Ofrezco videollamada gratuita antes de reservar"**. Guarda.
- [ ] **Datos fiscales**: completa NIF ficticio (X1234567L), nombre, dirección; elige régimen "Autónomo por días puntuales"; marca los DOS compromisos (fiscal + facturación delegada). Guarda.
- [ ] **Mis servicios**: crea un servicio con precio 1.000€ y anticipo del 30%. Guarda.
- [ ] Verifica que en la ficha pública del proveedor (`/proveedores/{slug}`) aparece:
  - El bloque verde de videollamada preventa
  - El servicio con badge "Requiere anticipo del 30%"

## Fase 3 · Solicitud de videollamada preventa (cliente potencial)

- [ ] Desde la pestaña incógnito, abre la ficha del proveedor
- [ ] Pulsa **"Pedir videollamada gratuita"** y rellena el formulario
- [ ] Verifica que ves confirmación "Solicitud enviada"
- [ ] Como el proveedor en `/proveedor/panel → 📹 Videollamadas`, verifica que aparece la solicitud
- [ ] Pulsa **"Aceptar y crear sala"** → se genera link Jitsi
- [ ] Copia el link y verifica que abre bien (Jitsi Meet debería funcionar en cualquier navegador)

## Fase 4 · Reserva

- [ ] En la pestaña incógnito, en la ficha del proveedor selecciona el servicio y rellena el formulario de reserva
- [ ] Verifica que llegan 3 emails: al cliente (reserva recibida), al proveedor (nueva reserva) y al admin
- [ ] En `/admin-tools/test-mode → 📋 Reservas` debe aparecer la reserva con:
  - 1er pago: **PENDING**
  - 2º pago: **PENDING** (si evento >60 días) o **N/A** (si <=60d)

## Fase 5 · Simular el primer pago

- [ ] En `/admin-tools/test-mode`, en la fila de la reserva, pulsa **"Simular 1er pago"**
- [ ] Verifica que el status cambia a PAID
- [ ] Como el proveedor en `/proveedor/panel → 📋 Reservas`, pulsa **"✓ Confirmar reserva"**
- [ ] Verifica que se emiten AUTOMÁTICAMENTE las 2 facturas Verifactu:
  - Ve a `/admin-tools/test-mode → 📄 Facturas` — deben aparecer 2 nuevas filas
  - Abre cada PDF (botón "Abrir ↗") y verifica: numeración correlativa, QR, hash, datos fiscales
  - La factura A (COMISIÓN) va de FiestaGo → cliente por el 8%
  - La factura B (DELEGADA) va del proveedor → cliente por el precio del servicio, emitida en su nombre

## Fase 6 · Chat post-reserva

- [ ] Como el cliente en `/mi-cuenta`, abre el chat con el proveedor
- [ ] Envía un mensaje de texto → verifica que el proveedor lo ve en su panel
- [ ] Como el proveedor:
  - Envía un mensaje de texto
  - Pulsa **📹 Videollamada** → verifica que sale la card verde en el chat
  - Pulsa **📎 Adjuntar** → sube un audio corto (o imagen) desde el móvil
  - Verifica que el cliente ve el reproductor/imagen en su chat
- [ ] Como el cliente, pulsa el enlace de videollamada y verifica que abre Jitsi

## Fase 7 · Recordatorios del segundo pago (con time-travel)

- [ ] En `/admin-tools/test-mode`, en la fila de la reserva pulsa **⏩ +5 días** → simula que faltan 2 días para el vencimiento
- [ ] Pulsa **▶ Disparar cron ahora**
- [ ] Verifica que el cliente recibe el email "vence en 3 días" (revisa spam si tarda)
- [ ] Verifica en `/admin-tools/test-mode` que la fecha `d3_sent_at` se ha marcado (para evitar duplicados)
- [ ] Repite time-travel con +5 días más (para llegar a D0) y vuelve a disparar el cron
- [ ] Verifica email "vence hoy"

## Fase 8 · Pago del segundo tramo

- [ ] Como cliente, abre el email recibido y pulsa el enlace del pago
- [ ] Debe cargar `/pago-restante/{bookingId}?email=...` con el importe y botón "Pagar"
- [ ] Pulsa el botón (modo TEST → simula el cobro instantáneamente)
- [ ] Verifica en `/admin-tools/test-mode` que el segundo pago está PAID y que se ha emitido una nueva factura delegada por el resto

## Fase 9 · Cancelación automática por impago (test aparte)

- [ ] Crea otra reserva de prueba (o duplica una existente)
- [ ] Simula primer pago pero **NO simules el segundo**
- [ ] En `/admin-tools/test-mode`, pulsa **⏩ +8 días (cancela)** en esa reserva
- [ ] Pulsa **▶ Disparar cron ahora**
- [ ] Verifica que:
  - La reserva pasa a `status='cancelled'`
  - El cliente recibe email "reserva cancelada por impago"
  - El proveedor recibe email "fecha libre, anticipo va para ti"
  - La notificación aparece en la campana del admin

## Fase 10 · Facturas del cliente

- [ ] Como cliente, entra a `/mi-cuenta/facturas`
- [ ] Verifica que ves las facturas ordenadas por fecha
- [ ] Abre alguna en PDF y verifica que el QR es legible

## ✓ Test completo

Si todos los pasos pasan, el sistema está listo para operar de verdad — solo falta que sustituyas:

1. Env vars fiscales TEST → tus datos reales cuando tengas la ampliación IAE del gestor
2. Endpoints `/api/mock/pay-*` → se retirarán cuando integres Stripe Checkout
3. `FIESTAGO_TEST_MODE=true` → cámbialo a `false` cuando salgas a producción real
4. Configurar el cron externo (cron-job.org) para que `/api/cron/second-payment-reminders` corra diariamente sin necesidad de pulsar "Disparar cron ahora"

---

## Referencia rápida de URLs

| Rol | URL | Requiere |
|---|---|---|
| Admin · consola test | `/admin-tools/test-mode` | ADMIN_PASSWORD |
| Admin · notificaciones | `/admin` | ADMIN_PASSWORD |
| Cliente · mis facturas | `/mi-cuenta/facturas` | login cliente |
| Cliente · pago restante | `/pago-restante/{bookingId}?email=...` | email en URL |
| Proveedor · panel | `/proveedor/panel` | login proveedor |
| Proveedor · datos fiscales | `/proveedor/panel?tab=fiscal` | login proveedor |

---

## Troubleshooting

**Las facturas salen con emisor "PENDIENTE"** → alguna env var `FIESTAGO_TAX_*` no está configurada en Netlify.

**Los emails no llegan** → verifica en Resend que la API key funciona y que el dominio `fiestago.es` está verificado.

**El botón "Simular pago" da 403** → falta `FIESTAGO_TEST_MODE=true` en Netlify. Añádelo y espera 1 min al redeploy.

**El cron dice `scanned: 0`** → no hay reservas con `second_payment_status='pending'` en la ventana ±30d respecto a hoy. Usa el time-travel para acercar la fecha.
