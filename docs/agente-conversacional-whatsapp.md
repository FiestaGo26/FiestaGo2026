# Agente conversacional de captación (WhatsApp) + Equipo Valencia

Dos piezas nuevas para captar proveedores:

1. **Equipo Valencia** — busca proveedores reales en las 12 categorías de Valencia de una pasada.
2. **Agente conversacional WhatsApp** — cuando un proveedor responde, la IA conversa con él para que se dé de alta. Responde sola los casos claros y **escala a un humano** los sensibles (modo "automático con red de seguridad").

---

## 1. Equipo Valencia

Barre las 12 categorías de Valencia llamando al agente de búsqueda web (`/api/admin/agent`) una categoría tras otra. Cada llamada se mantiene bajo el límite de 30 s de la función serverless; entre categorías hay una pausa de 30 s para no saturar el rate limit de Anthropic.

### Desde el panel
`Admin → Agente IA → 🏆 EQUIPO VALENCIA (12 cats)`. Tarda varios minutos; no cierres la pestaña. Los proveedores quedan como **pending** para que los apruebes en *Proveedores*.

### Desde la terminal (desatendido)
```bash
cd tools/fiegago-agent
APP_URL=https://fiestago.es ADMIN_PASSWORD=xxxx node valencia-team.mjs
# solo algunas categorías:
node valencia-team.mjs foto,catering,musica
# otra ciudad / nº por categoría:
CITY=Alicante COUNT=3 node valencia-team.mjs
```
No necesita claves de Anthropic ni Supabase en local: reutiliza el endpoint desplegado.

---

## 2. Agente conversacional WhatsApp

### Flujo
```
Proveedor responde por WhatsApp
        ↓
Meta llama a /api/whatsapp/webhook (POST)
        ↓
Se guarda el mensaje en provider_conversations
        ↓
La IA (lib/conversation.ts) lee el hilo + datos del proveedor
        ↓
┌─ Caso claro  → responde y ENVÍA sola (Cloud API)
└─ Caso sensible → guarda borrador + marca 'escalated' + notifica al admin
        ↓
El admin revisa en Admin → 💬 Conversaciones, edita y envía
```

### Red de seguridad
La IA escala (no envía) cuando: hay queja/enfado/amenaza legal, piden negociar condiciones fuera de lo estándar, piden hablar con una persona, o la pregunta no tiene respuesta segura en la base de conocimiento. Todo lo demás (dudas de precio, comisión, cómo darse de alta, sello, garantía, objeciones típicas) lo responde sola.

### Configuración de Meta (una vez)
1. **developers.facebook.com** → crea una App tipo *Business* → añade el producto **WhatsApp**.
2. En *API Setup* copia el **Phone Number ID** → `WHATSAPP_PHONE_ID` y genera un **token permanente** → `WHATSAPP_TOKEN`.
3. Inventa una cadena secreta → `WHATSAPP_VERIFY_TOKEN`.
4. En *Configuration → Webhook*:
   - Callback URL: `https://fiestago.es/api/whatsapp/webhook`
   - Verify token: el mismo `WHATSAPP_VERIFY_TOKEN`
   - Suscríbete al campo **messages**.
5. Añade las 4 variables (`WHATSAPP_*`) en Vercel/Netlify y `ANTHROPIC_API_KEY` (ya la tienes).

### Iniciar conversación
La Cloud API solo permite texto libre dentro de la ventana de 24 h desde el último mensaje del proveedor. Para iniciar tú (fuera de ventana) hace falta una **plantilla aprobada** por Meta — usa `sendWhatsAppTemplate()` en `lib/whatsapp.ts`. Lo habitual: el primer contacto va por email/IG con tu WhatsApp, el proveedor escribe y a partir de ahí el agente conversa libremente.

### Base de datos
Aplica `tools/migrations/migration-conversations.sql` (tabla `provider_conversations` + columnas de estado en `providers`).

### Variables de entorno
Ver bloque `WHATSAPP` y `CONVERSATION_MODEL` en `.env.example`.
