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
