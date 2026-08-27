# Tutoriales del panel del proveedor

Automatización de screencasts para `/proveedor/ayuda`. Playwright navega el
panel como MarianoSL (vía admin bypass), graba cada flujo y ffmpeg lo
convierte en GIF optimizado para web.

## Requisitos

- Node 18+
- `ffmpeg` en el PATH (en cloud Cowork ya lo tiene; local: `brew install ffmpeg`)
- Playwright + Chromium
- Env var `ADMIN_PASSWORD` (la del site)

## Instalación (una vez)

```bash
npm install --save-dev @playwright/test
# En cloud Cowork Chromium ya viene. En local:
npx playwright install chromium
```

## Uso

```bash
# Todos los tutoriales de golpe (~5-8 min)
ADMIN_PASSWORD=xxxxx node tools/tutorials/capture.mjs

# Solo uno concreto
ADMIN_PASSWORD=xxxxx node tools/tutorials/capture.mjs 05-presupuestos-ia

# Ver lista de slugs
node tools/tutorials/capture.mjs --list
```

Opcional:
- `BASE_URL=http://localhost:3000` para grabar contra el dev server
- `PROVIDER_ID=<uuid>` para usar otro proveedor demo

## Output

- `public/tutorials/{slug}.gif` — los que consume la página de ayuda
- `public/tutorials/_raw/{slug}.webm` — fuentes por si quieres reeditar

Los GIFs se sirven en producción desde `/tutorials/{slug}.gif`. Si el
capturador aún no ha generado alguno, la card muestra un placeholder
"Grabación pendiente" en la página `/proveedor/ayuda`.

## Reemplazar un GIF por vídeo con voz

Si prefieres grabar tú un vídeo con Loom para algún tutorial:

1. Graba con Loom en 1280×720
2. Descarga el mp4
3. Súbelo a Cloudinary/S3 o mételo en `public/tutorials/{slug}.mp4`
4. En `app/(public)/proveedor/ayuda/page.tsx` cambia el `<img>` por un `<video>` en ese slug concreto

Los demás siguen como GIF sin problema.

## Añadir un tutorial nuevo

1. Añade una entrada en `TUTORIALS` en `app/(public)/proveedor/ayuda/page.tsx`
2. Añade una escena en `SCENES` en `capture.mjs` con el mismo slug
3. Vuelve a ejecutar el capturador solo para ese slug
