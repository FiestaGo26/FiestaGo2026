# FiestaGo · Marketing Agent

Genera posts de redes sociales (Instagram + TikTok @fiestagospain) con
imagen/vídeo (fal.ai) + caption + hashtags (Claude).

## Uso rápido

```
cd C:\Users\msmrl\Documents\FiestaGo2026\tools\fiegago-marketing-agent
chcp 65001
node fiegago-marketing-agent.mjs                              # dry-run, ver plan
node fiegago-marketing-agent.mjs --confirm                    # 3 posts mezcla cliente+proveedor
node fiegago-marketing-agent.mjs --confirm --n 8              # 8 posts mezcla
node fiegago-marketing-agent.mjs --confirm --type pack_promo  # solo un tipo

# Filtrar por audiencia (NUEVO):
node fiegago-marketing-agent.mjs --confirm --audience provider --n 3
node fiegago-marketing-agent.mjs --confirm --audience client  --n 3
node fiegago-marketing-agent.mjs --confirm --audience mix     --n 6  # default
```

## Tipos de post

### Audiencia `client` (rotación por pesos, default)
- **inspiration_video** (25%): vídeo hook 5s tipo cinematográfico
- **tip_educational** (20%): imagen flat-lay con tip educativo
- **pack_promo** (20%): imagen aspiracional de un pack
- **social_proof** (15%): imagen testimonio cliente
- **behind_scenes** (10%): vídeo BTS de proceso
- **fomo_seasonal** (10%): vídeo urgente de plaza limitada

### Audiencia `provider` (campaña de captación de proveedores)
- **provider_zero_commission_video** (25%): vídeo · 0% comisión primera venta
- **provider_anti_subscription_video** (20%): vídeo · contraposición con Bodas.net y cuotas
- **provider_low_season_video** (15%): vídeo · llenar temporada baja
- **provider_not_only_weddings_carousel** (15%): carrusel · no es solo bodas
- **provider_comparison_carousel** (10%): carrusel · comparativa coste
- **provider_demo_signup_video** (10%): vídeo · alta en 60 segundos
- **provider_hot_take_video** (10%): vídeo · hot take contrarian

## Output

Cada post genera una carpeta dentro de `FiestaGo-Contenido/redes-sociales/{YYYY-MM-DD}/{post-id}/`:

- `imagen.jpg` o `video.mp4` — el medio
- `caption_instagram.txt` — caption + hashtags para IG
- `caption_tiktok.txt` — versión más punzante + hashtags para TikTok
- `hashtags.txt` — solo hashtags
- `prompt_usado.txt` — prompt enviado a fal.ai
- `meta.json` — toda la metadata

`FiestaGo-Contenido/redes-sociales/index.json` mantiene el registro consolidado.

## Coste

- ~$0.04 imagen Flux 1.1 Pro
- ~$0.50 vídeo Kling 5s
- 3 posts mezcla → ~$0.50-1
- 16 posts/mes (4 sem × 4) → ~$10-15/mes

## Cómo añadir/editar tipos de post

Edita `post-templates.json`. Cada template tiene:
- `id`, `label`, `weight` (peso en rotación), `media` ("image" o "video")
- `audience`: "client" (default) o "provider" — cambia el system prompt de Claude
- `prompt_template` con `{variables}`
- `scenes`/`topics`/`packs`: pools de variables
- `caption_brief`: instrucciones para Claude
- `hashtags_base`: hashtags fijos a incluir

---

## Avatar — vídeos hablando a cámara (tú, no un avatar sintético)

Además de imagen/vídeo generados por IA, hay un modo `presenter: "avatar"`
que produce un vídeo hablando a cámara **con metraje real tuyo**: la cara y
el cuerpo son siempre un clip que grabaste tú; la IA solo sustituye la boca
(lipsync) y el audio (tu voz clonada) para que digas un guion nuevo cada
vez. No usa avatares sintéticos tipo HeyGen/Synthesia — el objetivo es que
no se note que hay IA de por medio.

Plantillas ya incluidas: `provider_founder_intro_avatar` (presentación del
fundador) y `provider_hot_take_avatar` (opinión directa a cámara).

### Setup (una vez)

1. **Graba tus clips base** — 15-30s hablando a cámara, vertical 9:16, buena
   luz, movimiento natural. Guía completa en `avatar-clips/README.md`.
   Guárdalos en `avatar-clips/` (esa carpeta no se sube al repo).
2. **Clona tu voz** en [ElevenLabs](https://elevenlabs.io) — Voice Library →
   Add Voice → Instant/Professional Voice Clone, sube 1-3 min de audio tuyo
   limpio, copia el `voice_id`.
3. **Crea cuenta en [Sync Labs](https://sync.so)** (lipsync) y copia tu API
   key.
4. Rellena en `.env`: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`,
   `SYNC_API_KEY` (ver `.env.example`).

### Cómo funciona por post

```
Claude escribe un guion hablado (1ª persona, natural, 15-20s)
    ↓
ElevenLabs: guion → audio con tu voz + timestamps por palabra
    ↓
Sync Labs: lipsync del audio sobre tu clip base real (avatar-clips/)
    ↓
FFmpeg: quema subtítulos por palabra + marca de agua + tarjeta CTA final (3s)
    ↓
video_final.mp4 (listo para publicar, sin pasar por compose-video.mjs)
```

### Uso

```
node fiegago-marketing-agent.mjs --confirm --type provider_founder_intro_avatar
node fiegago-marketing-agent.mjs --confirm --audience provider --n 5   # mezcla incl. avatar
```

### Coste (orientativo)

- ElevenLabs: ~$0.02-0.05 por guion corto (según plan)
- Sync Labs: ~$0.15-0.25 por vídeo de ~20s (según plan/modelo)
- Total: ~$0.20-0.30 por vídeo avatar

### Nota sobre las APIs externas

Los endpoints de Sync Labs y ElevenLabs en `avatar-video.mjs` están escritos
según su documentación pública. Si al ejecutar ves un error de "campo
desconocido" o similar en la respuesta de la API, revisa su documentación
actual (elevenlabs.io/docs, docs.sync.so) — el propio mensaje de error de la
API te dirá qué campo ajustar.
