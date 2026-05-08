# FiestaGo · Marketing Agent

Genera posts de redes sociales (Instagram + TikTok @fiestagospain) con
imagen/vídeo (fal.ai) + caption + hashtags (Claude).

## Uso rápido

```
cd /d C:\Users\msmrl\Downloads\fiegago-proyecto\fiegago\fiegago-marketing-agent
chcp 65001
node fiegago-marketing-agent.mjs              # dry-run, ver plan
node fiegago-marketing-agent.mjs --confirm    # generar 3 posts
node fiegago-marketing-agent.mjs --confirm --n 8        # generar 8
node fiegago-marketing-agent.mjs --confirm --type pack_promo  # solo pack
```

## Tipos de post (rotación por pesos)

- **inspiration_video** (25%): vídeo hook 5s tipo cinematográfico
- **tip_educational** (20%): imagen flat-lay con tip educativo
- **pack_promo** (20%): imagen aspiracional de un pack
- **social_proof** (15%): imagen testimonio cliente
- **behind_scenes** (10%): vídeo BTS de proceso
- **fomo_seasonal** (10%): vídeo urgente de plaza limitada

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
- `prompt_template` con `{variables}`
- `scenes`/`topics`/`packs`: pools de variables
- `caption_brief`: instrucciones para Claude
- `hashtags_base`: hashtags fijos a incluir
