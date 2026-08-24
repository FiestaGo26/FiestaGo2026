# Crons de FiestaGo · configuración

Este documento lista los endpoints tipo cron que FiestaGo tiene y cómo programarlos externamente. Se ejecutan mediante llamadas HTTP POST desde un servicio externo (Netlify Scheduled Functions, cron-job.org, GitHub Actions, EasyCron, etc.).

Todos los endpoints requieren autenticación via header `x-cron-secret` con el valor de la env var `CRON_SECRET` (ya configurada en Netlify).

## Lista de crons activos

### 1 · Contenido diario para redes

- **Endpoint**: `POST https://fiestago.es/api/cron/content-daily-generate`
- **Frecuencia**: 1 vez al día · 06:00 UTC (08:00 hora Madrid en verano)
- **Qué hace**: elige pilar del día, Claude redacta guion, HeyGen arranca generación del vídeo.

### 2 · Polling del vídeo generado

- **Endpoint**: `POST https://fiestago.es/api/cron/content-daily-poll`
- **Frecuencia**: cada 15 min · desde las 06:00 UTC hasta las 10:00 UTC
- **Qué hace**: descarga el vídeo cuando HeyGen termina.

### 3 · Recordatorios del segundo pago + cancelación automática

- **Endpoint**: `POST https://fiestago.es/api/cron/second-payment-reminders`
- **Frecuencia**: 1 vez al día · 08:00 hora Madrid (06:00 UTC verano / 07:00 UTC invierno)
- **Qué hace**:
  - Envía recordatorio al cliente cuando faltan 7, 3 y 0 días para el segundo pago
  - Marca la reserva como `overdue` un día después del vencimiento
  - Cancela automáticamente la reserva tras 7 días de gracia sin pago
  - Al cancelar: anticipo va al proveedor como compensación, se libera la fecha, se avisa a ambas partes por email
- **Idempotente**: se puede ejecutar varias veces al día sin duplicar envíos.

## Cómo configurar el cron (2 opciones)

### Opción A · Netlify Scheduled Functions (recomendada)

Requiere crear un archivo `netlify/functions/second-payment-reminders.mts` que llame al endpoint HTTP interno. Netlify garantiza la ejecución diaria y factura solo por invocación (dentro del plan gratuito hasta 125k/mes).

Alternativa más simple si aún no usas scheduled functions: **Opción B**.

### Opción B · cron-job.org (gratis, 5 minutos de setup)

1. Crea cuenta en [https://cron-job.org](https://cron-job.org)
2. Crea un cronjob nuevo:
   - **URL**: `https://fiestago.es/api/cron/second-payment-reminders`
   - **Schedule**: `0 8 * * *` (todos los días a las 08:00)
   - **Method**: `POST`
   - **Headers**: añadir `x-cron-secret: <valor de CRON_SECRET>`
3. Guardar

Repetir para los otros 2 crons con sus respectivas frecuencias.

## Testear un cron manualmente

Desde el navegador con la contraseña de admin, GET al endpoint:

```
https://fiestago.es/api/cron/second-payment-reminders
Header: x-admin-password: <ADMIN_PASSWORD>
```

O con curl:

```bash
curl -X POST https://fiestago.es/api/cron/second-payment-reminders \
  -H "x-cron-secret: $CRON_SECRET"
```

Devuelve un JSON con `stats` (d7, d3, d0, marked_overdue, cancelled, errors) y `logs` (una línea por reserva procesada).

## Ver historial de ejecuciones

Los eventos importantes (cancelaciones automáticas por impago, errores) se registran en la tabla `notifications` con tipo `booking_cancelled_nonpayment` y aparecen en la campana del panel admin.
