# FiestaGo · Email Worker (Cloudflare)

Auto-respuesta de emails entrantes con IA.

## Qué hace

Cuando un proveedor responde a un email tuyo (a `contacto@fiestago.es`
o cualquier alias `*@fiestago.es`), el flujo es:

```
Provider responde ──► Cloudflare Email Routing
                       │
                       ▼
               Email Worker (este script)
                       │ POST JSON
                       ▼
   fiestago.es/api/webhooks/email-inbound
                       │
                       ├─ Identifica proveedor
                       ├─ Detecta opt-out → "te quito de la lista"
                       ├─ Si no: Claude redacta respuesta
                       └─ Resend envía respuesta automática
                       │
                       ▼
            Todo el hilo se guarda en BD
       (visible en /admin-tools/conversaciones)
```

**Coste:** 0€. Cloudflare Email Routing es gratis hasta 200 emails/día
para destinatarios verificados. Workers gratis hasta 100k invocaciones/día.

## Setup (10 min)

### 1. Configurar Email Routing en Cloudflare

1. Entra en `dash.cloudflare.com` → tu dominio `fiestago.es`.
2. Sidebar izquierdo → **Email** → **Email Routing**.
3. Botón **Get started** → te dará registros DNS MX + SPF para añadir
   al DNS (si ya tienes Cloudflare como DNS, los añade automáticamente).
4. Una vez activado, verás "Routing rules".

### 2. Crear el Worker

1. Sidebar → **Workers & Pages** → **Create application** →
   **Create Worker** → nómbralo `fiestago-email-inbound`.
2. Sustituye el código por el contenido de `email-inbound-worker.js`.
3. **IMPORTANTE — instalar dependencia `postal-mime`:**
   - En el editor del Worker, abre `package.json` (si no existe,
     créalo con: `{ "name": "worker", "type": "module" }`).
   - En `dependencies` añade `"postal-mime": "^2.4.0"`.
   - Pulsa **Save and deploy**. Cloudflare instala `postal-mime`
     automáticamente.
   - Alternativa local con `wrangler`: `wrangler init --type javascript`
     + `npm install postal-mime` + `wrangler deploy`.

### 3. Añadir secrets al Worker

En el Worker → **Settings** → **Variables** → **Add variable**:

| Nombre | Valor |
|---|---|
| `SITE_URL` | `https://fiestago.es` |
| `INBOUND_EMAIL_SECRET` | Genera 1 string aleatorio largo (ej. con `openssl rand -hex 32`) y guárdalo |

Marca ambos como **Encrypt** (✓).

### 4. Añadir el mismo secret en Netlify

En `app.netlify.com/projects/fiestago` → **Site settings** →
**Environment variables** → **Add a variable**:

- Key: `INBOUND_EMAIL_SECRET`
- Value: el mismo string que pusiste en el Worker

Trigger un deploy para que la env se aplique.

### 5. Crear la regla de routing

Cloudflare → tu dominio → **Email Routing** → **Routing rules** →
**Create address**:

- **Custom address**: `respuestas@fiestago.es` (o tu alias preferido)
- **Action**: **Send to a Worker**
- **Worker**: `fiestago-email-inbound`
- **Save**

**Opcional pero recomendado** — catch-all para capturar las respuestas
a `contacto@fiestago.es` también:
- **Catch-all address** → **Send to a Worker** → `fiestago-email-inbound`.

### 6. Probar

Manda un email desde tu Gmail a `respuestas@fiestago.es` con asunto
"Re: Tu negocio en FiestaGo" y cuerpo "¿Cuál es vuestra comisión?".

- Si el email viene de un email registrado en `providers.email`,
  Claude debería responderte en ~10 seg con un mensaje sobre la
  Garantía de Éxito.
- Si viene de un email desconocido, no responde (anti-spam).

Verifica en:
- **Worker** → pestaña **Logs**: deberías ver "POST /api/webhooks/email-inbound 200"
- **Netlify** → **Functions logs**: deberías ver `[email-inbound] action: replied`
- **fiestago.es/admin-tools/conversaciones**: nueva conversación con
  badge "📧 email" y el hilo completo (incoming + respuesta IA).

## Cómo desactivar momentáneamente

Si quieres pausar las auto-respuestas (ej. en vacaciones):

- **Cloudflare** → **Email Routing** → **Routing rules** → desactiva
  la regla. Los emails caerán al "catch-all" de tu inbox personal.

O directamente en BD:
```sql
update provider_conversations set status = 'paused'
where channel = 'email' and status = 'active';
```
