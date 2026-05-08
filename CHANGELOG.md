# Changelog FiestaGo

Histórico cronológico de cambios significativos.

## 2026-05-07 / 2026-05-08

- ✨ Sistema de servicios por proveedor con foto/vídeo (`provider_services` + bucket `provider-media`)
- ✨ Email de bienvenida HTML editorial cuando se aprueba un proveedor (paleta cream/gold)
- ✨ Email de rechazo HTML al rechazar
- ✨ Email al admin cuando proveedor se autoregistra
- ✨ Generación automática de imagen hero (fal.ai Flux) al aprobar proveedor → `provider.photo_url`
- ✨ Marketing agent: pipeline completo (genera img/vídeo + caption + hashtags + hook_overlay)
- ✨ Cola de aprobación marketing en `/admin` (sección Marketing) con preview, edit, publish-via-deeplink
- ✨ Tabla `social_posts` + bucket `social-posts`
- ✨ Headers visuales por categoría+ciudad (Flux 1.1 Pro)
- 🐛 Fix: panel proveedor ya no redirige silenciosamente a /registro si email no tiene perfil
- 🐛 Fix: contactable se calcula correctamente en POST /api/providers (autoregistro)
- 🐛 Fix: paragraphsToHtml no escapa los <br> que él mismo inserta (orden correcto)
- 🐛 Fix: agente del admin web usa version rapida (solo Claude web_search) para caber en timeout 10s
- 🛠 fal.ai integrado para generación de imágenes/vídeos
- 🛠 Resend: dominio fiestago.es verificado en GoDaddy + DNS configurado
- 🛠 Outreach automático por email al aprobar prospect (ratio agente)

## 2026-05-06

- ✨ Resend integration end-to-end (`/api/admin/send-outreach`)
- ✨ Captación masiva: 10 ciudades × 12 categorías
- ✨ Filtro `contactable` + enriquecimiento de perfiles IG via Apify
- 🐛 Fix: `claude-sonnet-4-5-20250514` → `claude-sonnet-4-5` (modelo correcto)
- 🐛 Fix: `lib/supabase.ts` sin `next/headers` para no romper client components
- 🛠 Migration: añadir columnas `contactable`, `outreach_dm`, `tiktok`, `social_url`, `outreach_email` a providers

## 2026-05-05

- 🎬 `fiegago-agent.mjs` v1: script para captar proveedores reales via Apify + Claude
- 🎬 Diagnóstico inicial: el script no arrancaba por falta de `.env`
