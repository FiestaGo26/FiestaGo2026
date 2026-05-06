# Configuración de envío de emails (Resend)

El botón "Enviar email" en el panel admin ahora envía emails reales via Resend.

## Variables de entorno necesarias en Netlify

En **Netlify → Site settings → Environment variables**, añade:

| Nombre | Valor | Descripción |
|--------|-------|-------------|
| `RESEND_API_KEY` | `re_xxx...` | API key de tu cuenta Resend (requerido) |
| `OUTREACH_FROM` | `contacto@fiestago.es` | Dirección remitente (debe estar en un dominio verificado en Resend) |
| `OUTREACH_FROM_NAME` | `FiestaGo` | Nombre que verá el destinatario (opcional, default "FiestaGo") |
| `OUTREACH_REPLY_TO` | `FIESTAGO@outlook.es` | Dirección a la que llegan las respuestas (opcional) |

## Verificación de dominio en Resend (una sola vez)

1. Resend → Domains → Add Domain → `fiestago.es`
2. Resend muestra 3 registros DNS (1 SPF/TXT, 2 DKIM, 1 DMARC opcional).
3. GoDaddy → My Products → fiestago.es → DNS → Add Record. Copia-pega los registros tal cual los muestra Resend.
4. Espera 5-30 min y vuelve a Resend → click "Verify" en el dominio.
5. Cuando ponga "Verified" en verde, ya puedes enviar.

## Cómo funciona

- El draft del email se genera al ejecutar `node fiegago-agent.mjs` y se guarda en `providers.outreach_email`.
- El admin edita el draft si quiere (textarea en el modal).
- Click "Enviar email" → POST a `/api/admin/send-outreach`.
- El endpoint guarda primero el draft editado, luego lo envía via Resend.
- Marca `outreach_sent=true` y `outreach_at=now()` al éxito.
- El botón cambia a "✓ Reenviar email" después.

## Solución de problemas

- **"RESEND_API_KEY no configurada"**: añade la variable en Netlify y redespliega.
- **"Domain not verified"**: el dominio en `OUTREACH_FROM` no está verificado en Resend.
- **Email no llega**: revisa el dashboard de Resend → Logs para ver el estado del envío.
