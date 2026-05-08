# FiestaGo · Project Handoff

> **Documento maestro del estado del proyecto.** Si abres este repo desde un ordenador nuevo, empieza aquí.

## 0. Resumen ejecutivo

**FiestaGo** es un marketplace de proveedores de eventos en España.

- **Producción**: https://fiestago.es (Netlify)
- **Repo**: https://github.com/FiestaGo26/FiestaGo2026 · branch `main`
- **Stack**: Next.js 14 App Router · Supabase (PostgreSQL + Storage + Auth) · Netlify · Resend (email) · fal.ai (imágenes/vídeos IA) · Anthropic Claude (LLM)

## 1. Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  fiestago.es (Netlify · Next.js 14)                         │
│  ├── /                          Home pública                │
│  ├── /proveedores               Listado público             │
│  ├── /proveedores/[id]          Ficha proveedor             │
│  ├── /registro-proveedor        Auto-registro de proveedor  │
│  ├── /proveedor/login           Login proveedor             │
│  ├── /proveedor/panel           Panel del proveedor         │
│  ├── /admin                     Panel admin (password)      │
│  └── /api/...                   Endpoints REST              │
└────────────┬────────────────────────────────────────────────┘
             │
   ┌─────────┴─────────┬──────────────┬──────────────┐
   ▼                   ▼              ▼              ▼
Supabase          Resend          fal.ai        Anthropic
(DB + Storage)    (email)         (img+video)   (Claude LLM)

Adicional (corre en PC del operador, NO en Netlify):
  tools/fiegago-agent           → captación de proveedores reales
  tools/fiegago-content-gen     → genera headers visuales
  tools/fiegago-marketing-agent → genera posts de IG/TikTok
```

## 2. Servicios externos (cuentas y URLs)

| Servicio | URL dashboard | Quién lo usa | Cómo se autentica |
|----------|---------------|--------------|-------------------|
| Netlify | https://app.netlify.com/projects/fiestago | Hosting + functions | Login Mariano |
| Supabase | https://supabase.com/dashboard/project/borcqxgnmwtztuvdgzjx | DB + Storage + Auth | Login Mariano |
| GitHub | https://github.com/FiestaGo26/FiestaGo2026 | Source control | Login Mariano |
| GoDaddy | https://account.godaddy.com/products | DNS de fiestago.es | Login Mariano |
| Resend | https://resend.com/domains | Envío emails (dominio fiestago.es verificado) | Login Mariano |
| Anthropic | https://console.anthropic.com | Claude API | API key |
| Apify | https://console.apify.com | Scrapers IG/Google | API token |
| fal.ai | https://fal.ai/dashboard | Flux 1.1 Pro + Kling 3.0 | API key |
| Instagram | @fiestagospain | Marca social | Login Mariano |
| TikTok | @fiestagospain | Marca social | Login Mariano |

## 3. Variables de entorno (ENV)

### En Netlify (https://app.netlify.com/projects/fiestago/configuration/env)

```
ADMIN_EMAIL                   contacto@fiestago.es
ADMIN_PASSWORD                (contraseña del panel /admin)
ANTHROPIC_API_KEY             sk-ant-...
APIFY_API_TOKEN               apify_api_...
NEXT_PUBLIC_APP_URL           https://fiestago.es
NEXT_PUBLIC_SUPABASE_URL      https://borcqxgnmwtztuvdgzjx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY eyJhbGc... (anon JWT)
SUPABASE_SERVICE_ROLE_KEY     eyJhbGc... (service_role JWT, secreto)
RESEND_API_KEY                re_...
OUTREACH_FROM                 contacto@fiestago.es
OUTREACH_FROM_NAME            FiestaGo
OUTREACH_REPLY_TO             fiestago@outlook.es
FAL_KEY                       <UUID>:<hex> (formato fal.ai)
SECRETS_SCAN_OMIT_KEYS        OUTREACH_FROM,OUTREACH_FROM_NAME,OUTREACH_REPLY_TO,ADMIN_EMAIL,NEXT_PUBLIC_APP_URL
```

### En tu PC (para los scripts locales `tools/`)

Cada herramienta tiene su `.env.example` con los placeholders. Copia a `.env` y rellena:

```
tools/fiegago-agent/.env
tools/fiegago-content-gen/.env
tools/fiegago-marketing-agent/.env
```

⚠️ Los `.env` reales NO van al repo (están en `.gitignore`). Las claves reales viven en:
- Tu navegador → cuentas de cada servicio
- En tu máquina actual → `C:\Users\msmrl\Downloads\fiegago-proyecto\fiegago\<tool>\.env`

## 4. Schema Supabase

**Tablas principales:**

- `providers` — proveedores (status: pending/approved/rejected/suspended). Columna `contactable` indica si tiene canal de contacto. Columna `photo_url` puede tener imagen Flux generada al aprobar.
- `provider_services` — servicios/productos de cada proveedor (con foto/vídeo en Storage)
- `bookings` — reservas de clientes
- `notifications` — notificaciones in-app del admin
- `social_posts` — cola de aprobación de marketing (IG/TikTok)
- `agent_sessions` — sesiones del agente de captación
- `packs` — packs predefinidos (Pack Cumple, Pack Boda, etc.)

**Storage buckets:**

- `social-posts` — media de marketing (imágenes/vídeos generados por agente)
- `provider-media` — media de servicios de proveedores

Schema completo en `supabase-schema.sql` + migrations en `tools/migrations/`.

## 5. Flujos clave

### A. Captación de proveedores (script local)

```
node tools/fiegago-agent/fiegago-agent.mjs 3
```

Recorre 10 ciudades × 12 categorías. Busca proveedores reales en Apify (Instagram + Google), enriquece con scraper de perfil, califica con Claude, genera draft de email/DM, guarda con `status='pending'`.

### B. Aprobación de proveedores (admin web)

`/admin` → tab Proveedores. Para cada uno con `outreach_email` pendiente:

- Click ✓ → manda email de captación (sigue en pending hasta que se autoregistre)
- Click ✏️ → editar datos + envía email/DM manual

Para proveedores autoregistrados (sin `outreach_email`):

- Click ✓ → status='approved' + email bienvenida + genera imagen Flux 1.1 Pro
- Click ✕ → status='rejected' + email de rechazo (con motivo opcional)

### C. Auto-registro

`/registro-proveedor` → form (nombre, email, contraseña, categoría, ciudad, descripción, etc.). Crea auth user en Supabase + provider con `status='pending'`. Notifica por email a `contacto@fiestago.es`.

### D. Login proveedor + panel

`/proveedor/login` → autenticación Supabase Auth → `/proveedor/panel`. El panel busca el provider por email del auth user. Si no encuentra, muestra UI clara para registrarse o cerrar sesión.

Tabs:
- **Resumen** · estadísticas
- **Mi perfil** · editar info pública
- **Mis servicios** · CRUD de `provider_services` con upload foto/vídeo (10/50 MB)
- **Disponibilidad** · calendario
- **Reservas** · gestionar bookings entrantes
- **Seguridad** · cambiar contraseña

### E. Marketing automático

```
node tools/fiegago-marketing-agent/fiegago-marketing-agent.mjs --confirm --n 3
```

Genera 3 posts (mezcla por pesos: inspiration_video 25%, tip 20%, pack 20%, social_proof 15%, BTS 10%, FOMO 10%). Cada post: imagen/vídeo (fal.ai) + caption IG + caption TikTok + hook overlay (texto encima) + hashtags (Claude). Sube a Supabase Storage. Aparece en `/admin/marketing` para aprobar.

Cada post aprobado tiene botones "📸 IG" y "🎵 TikTok" que copian caption al portapapeles y abren la app correspondiente.

### F. Generación de headers (script local)

```
node tools/fiegago-content-gen/fiegago-content-gen.mjs --confirm
```

Recorre 10 ciudades × 12 categorías y genera una imagen editorial por combinación. Salida en `FiestaGo-Contenido/headers/{slug}/imagen.jpg`.

## 6. Setup en un ordenador NUEVO

```bash
# 1. Clone the repo
git clone https://github.com/FiestaGo26/FiestaGo2026.git
cd FiestaGo2026

# 2. Install Next.js deps (solo si quieres correr el sitio en local)
npm install
npm run dev   # http://localhost:3000

# 3. Configurar los scripts locales (tools/)
cd tools/fiegago-agent
cp .env.example .env
# Editar .env con las claves reales

cd ../fiegago-content-gen
cp .env.example .env
# Editar .env

cd ../fiegago-marketing-agent
cp .env.example .env
# Editar .env

# 4. Ejecutar
node fiegago-agent.mjs 3
node fiegago-content-gen.mjs --confirm
node fiegago-marketing-agent.mjs --confirm --n 3
```

**Migraciones SQL ya ejecutadas** (no hay que volver a correrlas):
- migration-add-contactable.sql
- migration-add-hook-overlay.sql
- migration-fix-contactable.sql
- migration-social-posts.sql
- migration-provider-services.sql

Si configuras un Supabase nuevo desde cero: corre `supabase-schema.sql` + todas las migrations en orden.

## 7. Estado actual (al cerrar la sesión del 2026-05-08)

### ✅ Completado

- Marketplace público (home, listado, registro, login)
- Panel admin con cola de proveedores, aprobar/rechazar
- Sistema de captación con `fiegago-agent.mjs` (10×12 combinaciones)
- Outreach email automático via Resend (con dominio fiestago.es verificado en GoDaddy)
- Sistema de servicios por proveedor (con foto/vídeo, Storage bucket)
- Sistema de marketing con cola de aprobación (`fiegago-marketing-agent.mjs`)
- Generación de imagen hero al aprobar proveedor (fal.ai Flux 1.1 Pro)
- Email de bienvenida HTML editorial al aprobar
- Email de rechazo al rechazar
- Email al admin cuando un proveedor se autoregistra
- Panel marketing con thumbnail, hook_overlay copiable, edit caption
- Headers visuales generados (5 combinaciones, en `FiestaGo-Contenido/headers/`)

### 🟡 En progreso / pendiente

Ver `tasks` en Cowork. Resumen:

1. Verificar Gmail nueva (que el usuario confirme)
2. Probar end-to-end módulo de servicios
3. Mostrar servicios en ficha pública del proveedor
4. Añadir DMARC en GoDaddy para deliverability a Outlook/Hotmail
5. Regenerar foto del proveedor existente "Estudio Test"
6. Decidir merge del rediseño marketplace (rama `redesign-preview`)
7. Schedule automático del marketing semanal
8. Tramitar apps Meta + TikTok for Developers (auto-publish)
9. Integrar headers visuales en /proveedores filtrado

## 8. Decisiones técnicas importantes

- **Status values en INGLÉS** (`pending`/`approved`/`rejected`/`suspended`). En UI se muestran traducidos.
- **Resend**: dominio `fiestago.es` verificado. From: `contacto@fiestago.es`. Reply-To: `fiestago@outlook.es` (Mariano lee respuestas en su Outlook).
- **fal.ai**: Flux 1.1 Pro para imágenes (~$0.04), Kling 3.0 para vídeos 5s (~$0.50).
- **Apify**: actores `apify~instagram-hashtag-scraper`, `apify~instagram-profile-scraper`, `apify~google-search-scraper`, `clockworks~tiktok-scraper`.
- **Netlify Free plan**: timeout 10s. Por eso el agente del admin web es "fast version" (solo Claude web_search) y la captación masiva corre en local.

## 9. Cómo continuar con Claude / Cowork

Si abres una nueva sesión de Cowork (otro ordenador, mañana, en una semana...) **mi memoria se reinicia**. Para que pueda retomar:

1. Comparte conmigo este documento (`PROJECT_HANDOFF.md`) o pídeme que lo lea de mi acceso al repo
2. Dime "vamos a continuar con FiestaGo, lee PROJECT_HANDOFF.md" — yo lo leo y me pongo al día
3. Vemos las tareas pendientes y decidimos por dónde seguir

Las tareas (TodoList) **NO persisten** entre sesiones de Cowork. Lo que sí persiste:
- Este documento (en el repo)
- El código (en GitHub)
- Las DBs y configuraciones de servicios externos
- Los scripts locales en tu PC

## 10. Contacto

- **Owner**: Mariano (mgt09@hotmail.es / fiestago@outlook.es)
- **Brand email**: contacto@fiestago.es
- **IG/TikTok**: @fiestagospain
