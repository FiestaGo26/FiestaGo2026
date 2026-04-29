# 🎉 FiestaGo — Guía de despliegue completa

Marketplace de celebraciones con base de datos real, panel de admin con notificaciones en tiempo real y agente de IA para captación de proveedores.

---

## Stack técnico

| Capa | Tecnología | Para qué |
|------|-----------|---------|
| Frontend | Next.js 14 + React | Web pública + Admin |
| Base de datos | Supabase (PostgreSQL) | Datos + Realtime |
| Pagos | Stripe | Reservas y comisiones |
| Emails | EmailJS | Outreach de proveedores |
| Scraping | Apify | Instagram + TikTok |
| IA | Anthropic Claude | Agente + web_search |
| Deploy | Vercel | Hosting |

---

## PASO 1 — Supabase (base de datos)

1. Ve a **supabase.com** → "New project"
2. Pon nombre: `fiegago`, elige región: `eu-central-1` (Frankfurt)
3. Espera ~2 min a que arranque
4. Ve a **SQL Editor** → "New query"
5. Copia TODO el contenido de `supabase-schema.sql` y ejecútalo
6. Ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ nunca lo expongas al cliente

---

## PASO 2 — Anthropic API

1. Ve a **console.anthropic.com** → API Keys → "Create Key"
2. Copia la key → `ANTHROPIC_API_KEY`

---

## PASO 3 — EmailJS (envío de emails al contactar proveedores)

1. Ve a **emailjs.com** → Create Account
2. "Add New Service" → Gmail → conecta tu cuenta de Google
3. "Create New Template":
   - Añade variables: `{{to_email}}`, `{{to_name}}`, `{{subject}}`, `{{message}}`, `{{from_name}}`
4. Ve a Account → "API Keys" y copia:
   - Service ID → `NEXT_PUBLIC_EMAILJS_SERVICE_ID`
   - Template ID → `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`
   - Public Key → `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`

---

## PASO 4 — Apify (Instagram + TikTok)

1. Ve a **apify.com** → Create Account (gratis, incluye $5/mes)
2. Settings → Integrations → "API Key" → copiar
3. Pega en `APIFY_API_KEY`

---

## PASO 5 — GitHub

1. Ve a **github.com** → "New repository"
2. Nombre: `fiegago`, privado o público
3. En tu terminal:

```bash
cd fiegago
git init
git add .
git commit -m "FiestaGo inicial"
git remote add origin https://github.com/TU_USUARIO/fiegago.git
git push -u origin main
```

---

## PASO 6 — Vercel (despliegue)

1. Ve a **vercel.com** → "Add New Project"
2. Importa tu repositorio `fiegago` de GitHub
3. Framework: **Next.js** (lo detecta automáticamente)
4. Ve a "Environment Variables" y añade TODAS las variables de `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
ANTHROPIC_API_KEY               = sk-ant-...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
STRIPE_SECRET_KEY               = sk_live_...
STRIPE_WEBHOOK_SECRET           = whsec_...
NEXT_PUBLIC_EMAILJS_SERVICE_ID  = service_...
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID = template_...
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY  = ...
APIFY_API_KEY                   = apify_api_...
ADMIN_PASSWORD                  = TU_CONTRASEÑA_SEGURA
ADMIN_EMAIL                     = admin@fiegago.es
NEXT_PUBLIC_APP_URL             = https://fiegago.vercel.app
```

5. Click "Deploy" → en 2-3 minutos tienes la web en vivo

---

## URLs una vez desplegado

| URL | Qué es |
|-----|--------|
| `https://fiegago.vercel.app` | Marketplace público (lo ve todo el mundo) |
| `https://fiegago.vercel.app/admin` | Panel de admin (solo tú, con contraseña) |
| `https://fiegago.vercel.app/registro-proveedor` | Formulario de alta de proveedores |
| `https://fiegago.vercel.app/proveedores` | Listado de proveedores aprobados |

---

## Cómo funciona el flujo completo

```
Proveedor se registra en /registro-proveedor
           ↓
Se guarda en Supabase con status = 'pending'
           ↓
Supabase dispara trigger → inserta notificación
           ↓
Tu panel de admin recibe notificación en TIEMPO REAL (Supabase Realtime)
           ↓
Ves el badge "1 nueva" en la campana del admin
           ↓ (opcionalmente)
Ejecutas el agente IA → busca más proveedores en Instagram/TikTok/web
           ↓
Apruebas, rechazas o editas cada proveedor desde el panel
           ↓
Los aprobados aparecen en el marketplace público
```

---

## Comandos de desarrollo local

```bash
# Instalar dependencias
npm install

# Crear .env.local con tus variables (copia .env.example)
cp .env.example .env.local

# Arrancar en local
npm run dev
# → http://localhost:3000

# Build de producción
npm run build
npm start
```

---

## Precios estimados mensuales en producción

| Servicio | Plan | Coste |
|---------|------|-------|
| Vercel | Pro | $20/mes |
| Supabase | Free (500MB) | $0 |
| Anthropic | Pay-as-you-go | ~$5-20/mes |
| EmailJS | Free (200 emails/mes) | $0 |
| Apify | Free ($5 créditos) | $0 |
| **Total inicial** | | **~$20-40/mes** |

Supabase Free aguanta hasta ~50.000 filas y 2GB de transferencia. Más que suficiente para el lanzamiento.

---

## Soporte

Si tienes dudas durante el setup, cualquier error que veas en Vercel o Supabase es fácil de resolver — los logs son muy claros. Los errores más comunes son variables de entorno mal copiadas (espacios extra o comillas).
