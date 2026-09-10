# Pack de vídeos marketing · motion graphics + voz IA

Genera 10 vídeos verticales (9:16) para Reels / TikTok / Shorts partiendo
de los guiones de `/tmp/.../pack-reels-fiestago.html`. Sin actor humano,
sin avatar. Motion graphics con texto + capturas + chips + voz IA en
español de España.

## Stack

- **[Remotion](https://www.remotion.dev/)** — React para vídeo (composición, animaciones, render)
- **[ElevenLabs](https://elevenlabs.io/)** — voz IA calidad broadcast en español ES
- **FFmpeg** — mux de audio + vídeo final
- **GitHub Actions** — pipeline reproducible sin necesidad de instalar nada local

## Uso

### Requisito: 2 env vars

```
ELEVENLABS_API_KEY      # tu API key de ElevenLabs
ELEVENLABS_VOICE_ID     # ID de voz ES-ES · recomendado 'Marta' o 'David' (voces nativas)
```

Añadirlas en **GitHub Settings → Secrets and variables → Actions** para el pipeline
automático; localmente en `.env` de este subdirectorio.

### Local (para iterar diseño)

```bash
cd tools/video-marketing
npm install
npm run studio                  # abre Remotion Studio · previsualiza cambios en vivo
```

### Renderizar los 10 vídeos

```bash
npm run generate-voices         # ~30s, genera los 10 MP3 en voices/
npm run render-all              # ~15 min, genera los 10 MP4 en out/
```

### Vía GitHub Action (recomendado)

- Ve a **Actions → 🎬 Render marketing videos**
- **Run workflow** (deja el slug vacío para renderizar los 10)
- ~20 min más tarde, descarga el ZIP de artifacts con los 10 MP4

## Cambiar el guión de un vídeo

Edita `src/scripts.ts`, ajusta `voiceover` (lo que dice la voz) y `scenes[]`
(los textos + iconos que aparecen en pantalla). Rerun `npm run generate-voices`
solo del que has cambiado + `npm run render -- 01-demand-consultas`.

## Cambiar la voz o el look

- **Voz**: cambia `ELEVENLABS_VOICE_ID` a otra voz de tu cuenta ElevenLabs
- **Colores/tipografía**: `src/theme.ts`
- **Duración**: `src/scripts.ts` cada scene tiene `durationInSeconds`

---

# Reels híbridos "cinematic" · vídeo IA + motion graphics

Segundo pipeline, dentro del mismo proyecto. La idea: los primeros segundos
deciden si te ven, así que ahí va **vídeo IA fotorrealista con personajes
ficticios**; el dato, la comparativa y el CTA van en **motion graphics**, que
son gratis y re-editables.

Resultado: ~3,50 $ por reel terminado en vez de los 60-120 $ que cuesta
generar 80 segundos enteros con IA.

## Por qué es barato

| Decisión | Ahorro |
|---|---|
| 27 s en vez de 84 s | −70 % · y convierte igual o mejor en Reels |
| Fotograma de arranque con Flux en vez del sistema *elements* de Kling | −50 % $/s |
| Voz en **off** en vez de diálogo a cámara | −33 % · y elimina el lipsync |
| Kling O3 Standard (720p) en vez de v3 Pro (1080p) | −25 % · y ~3× más rápido |

En vertical y en móvil, ninguna de las cuatro se nota en pantalla.

## Flujo

```bash
npm run cine:cost           # cuánto va a costar · no gasta nada
npm run cine:shots-dry      # placeholders para revisar el montaje · 0 €
npm run cine:voice          # voz en off (sin claves → pista de silencio)
npm run cine:render         # MP4 final en out/
```

Cuando el montaje te convenza, cambias el dry-run por el real:

```bash
npm run cine:shots                              # genera de verdad · gasta
node scripts/gen-shots.mjs --only 02-ventana    # repetir UNA toma
node scripts/gen-shots.mjs --model kling-v3-pro # subir a 1080p
```

## El checkpoint de 12 céntimos

Antes de pagar vídeo, mira las caras:

```bash
node scripts/gen-shots.mjs --frames-only     # 3 imágenes · $0,12
```

Las deja en `public/frames/{slug}/` junto a un `frames.json` con la URL de
cada una. Si te gustan, `npm run cine:shots` **anima esas mismas** sin volver
a pagar por la imagen. Si no te gustan, tocas el bloque `look` en
`characters.ts` y repites por otros 12 céntimos.

El dry-run no escribe nada en `public/frames/` a propósito: esa carpeta
contiene solo fotogramas reales aprobados.

## Animar imágenes que ya tienes

El agente de marketing del panel (`/admin/marketing`) ya genera imágenes con
personajes ficticios y las sube al bucket `social-posts` de Supabase con URL
pública. Esas se pueden animar directamente — te saltas el paso de Flux y
solo pagas el vídeo:

```bash
node scripts/animate.mjs \
  "https://<proyecto>.supabase.co/storage/v1/object/public/social-posts/custom/foo.jpg" \
  "She turns slowly toward the camera and smiles. Very slow push in." \
  --out out/clip-novia.mp4
```

5 segundos por **~0,42 $**. Es la vía más barata que hay aquí: la imagen ya
está pagada y aprobada por ti.

**Ojo con el formato.** El agente genera `square_hd` (1024×1024, cuadrado)
porque está pensado para el feed de Instagram. Si animas una cuadrada, el
clip sale cuadrado y en un Reel vertical se queda con bandas. Para vídeo
conviene generar la imagen en vertical: en
`app/api/admin/marketing/custom/route.ts`, `image_size: 'square_hd'` →
`'portrait_16_9'`.

## Consistencia de personaje

Es el problema difícil de todo esto, y aquí se resuelve por el lado barato:

1. `src/cinematic/characters.ts` define cada personaje con un bloque `look`
   **bloqueado** y una `seed` fija.
2. Ese bloque se inyecta literal en el prompt de cada toma.
3. Flux genera el fotograma de arranque; Kling anima **a partir de esa imagen**.

La cara se mantiene porque parte siempre del mismo punto. No es perfecto: si
necesitas consistencia milimétrica, el siguiente escalón es el sistema
*elements* de Kling (hasta 12 referencias), que cuesta el doble por segundo.

**Nunca metas caras, nombres o marcas reales.** Los personajes son ficticios
por diseño: derechos de imagen (LO 1/1982) y marcas de terceros. Los vídeos
llevan el rótulo "Contenido generado con IA" quemado, como exige el
Reglamento europeo de IA.

## Estructura

```
src/cinematic/characters.ts   Biblia de personajes · el bloque `look` es sagrado
src/cinematic/shots.ts        Guión: qué tomas son IA y cuáles motion graphics
src/CinematicVideo.tsx        Composición Remotion que lo monta todo
scripts/models.mjs            Modelos de fal.ai y sus precios (fuente única)
scripts/estimate-cost.mjs     Calculadora previa
scripts/gen-shots.mjs         Flux → fotograma, Kling → movimiento
scripts/gen-cine-voice.mjs    ElevenLabs (voz en off)
scripts/render-cine.mjs       Render final
```

`public/shots/` y `public/frames/` están en `.gitignore`: son generados y pesan.

## Variables de entorno

Copia `.env.example` a `.env` — los scripts lo cargan solos (`process.loadEnvFile`,
nativo en Node 22). Ninguna variable es obligatoria para probar:

- Sin `FAL_KEY` → usa `cine:shots-dry` (placeholders)
- Sin `ELEVENLABS_API_KEY` → pista de silencio

## Nota sobre las fuentes

`theme.ts` nombra *Space Grotesk* e *Inter*, pero el proyecto no las carga
(no hay `@remotion/google-fonts` en las dependencias), así que el navegador
del render cae al serif por defecto. `CinematicVideo.tsx` declara su propia
cascada con fallback sans para evitarlo. **Los 10 reels de motion graphics
originales siguen renderizando en serif** — se arregla instalando
`@remotion/google-fonts` o añadiendo el mismo fallback en `theme.ts`.

---

# Vídeo diario para redes (15 s)

Sustituye al avatar de HeyGen manteniendo **todo lo demás**: el cron ya
elegía pilar y tema del día con anti-repetición de 14 días, Claude ya
redactaba guion, caption y hashtags, y `content_videos` ya alimenta la
pestaña Contenido de `/admin`. Lo único que cambia es quién produce el vídeo.

```
toma 1   5s   presentadora hablando   (hook)
toma 2   5s   presentadora hablando   (cuerpo)
toma 3   5s   tarjeta de CTA          (motion graphics, gratis)
```

## La cara de la marca se fija una vez

`DAILY_PRESENTER_IMAGE_URL` apunta a una imagen pública que hayas aprobado.
Cada día se anima **esa misma**, así que:

- el coste de imagen es **0 €** (no se genera nada nuevo)
- la cara **no cambia** de un día para otro

Sin esa variable se genera una cara nueva cada mañana: 0,04 $ más y un
presentador distinto cada día, que es justo lo que no quieres.

Para fijarla: genera un retrato de la presentadora (con el agente del panel o
con `gen-shots.mjs --frames-only`), súbelo a Supabase Storage y pon su URL
pública en el secret.

## Coste

| Concepto | Por vídeo | Al mes |
|---|---|---|
| Imagen | 0 € (cara fija) | 0 € |
| Vídeo · 15 s | 1,26 $ | ~38 $ |
| Lipsync · 10 s hablados | 0,83 $ | ~25 $ |
| **Total** | **~2,09 $** | **~63 $** |

## Uso

```bash
npm run cine:daily-dry     # ensayo · no gasta ni escribe en la BD
npm run cine:daily         # producción
node scripts/daily.mjs --force   # rehacer el de hoy
```

El ensayo en seco funciona **sin ninguna clave**: usa un guion de ejemplo y
placeholders, y sirve para revisar ritmo y encuadre antes de gastar.

## Automatización

`.github/workflows/daily-cinematic-video.yml` lo lanza cada día a las 08:30
CEST. El render pesado no cabe en una función de Netlify (necesita Chromium,
ffmpeg y varios minutos), por eso vive en Actions.

## Convivencia con el cron viejo

Los dos pueden estar activos a la vez sin pisarse. Cuando quieras cambiar,
pon en Netlify:

```
DAILY_VIDEO_PRODUCER=cinematic
```

y el cron de HeyGen se aparta solo. Para volver atrás, quita la variable —
no hace falta tocar código ni desplegar nada.

---

# Montar tus propias grabaciones

Tú grabas, esto monta. Hace, por este orden:

1. **Encuadre** a 9:16 (recorta, no deforma)
2. **Fondo**: lo deja, lo cambia por croma, o lo quita con IA
3. **Corta los silencios** largos
4. **Transcribe** en español, en local y gratis
5. **Quema los subtítulos** con el estilo de la marca + CTA opcional

```bash
npm install                       # una vez
pip install faster-whisper        # una vez · transcripción local

node scripts/edit.mjs grabacion.mov --cut-silence --cta 3
```

Sale en `out/editado.mp4`.

El orden importa: la transcripción va **después** del corte. Al revés, los
tiempos de los subtítulos no cuadrarían con el vídeo ya cortado.

## Cambiar el fondo

Dos caminos, y el barato es el mejor:

**Croma físico** — una tela verde de 15-25 € detrás de ti:

```bash
node scripts/edit.mjs grabacion.mov --background chroma --bg-color 0x0F1013
node scripts/edit.mjs grabacion.mov --background chroma --bg-image fondo.jpg
```

Gratis, instantáneo y con los bordes limpios. `despill` quita de paso el
reflejo verde en pelo y hombros, que es lo que delata un croma mal hecho.

**Sin croma, con IA** — la separa el modelo:

```bash
node scripts/edit.mjs grabacion.mov --background ai --bg-image fondo.jpg
```

**0,025 $/segundo**: un vídeo de 30 s sale por 0,75 $. Necesita `FAL_KEY` y
credenciales de Supabase (el vídeo se sube para que fal pueda leerlo). Los
bordes del pelo salen peor que con croma real.

## Subtítulos

Se agrupan en líneas de 5 palabras **cortando por puntuación**. Agrupar solo
por número de palabras produce líneas como "dado de alta. Date de", que se
leen fatal. Ajusta con `--words 4` si los quieres más cortos.

Si prefieres revisar el texto antes de quemarlo:

```bash
node scripts/transcribe.mjs grabacion.mov transcript.json   # transcribe
# edita transcript.json a mano
node scripts/edit.mjs grabacion.mov --transcript transcript.json
```

## Opciones

| Opción | Qué hace |
|---|---|
| `--cut-silence [seg]` | Quita silencios de más de N segundos (0,6 por defecto) |
| `--cta <seg>` | Tarjeta de CTA al final |
| `--background chroma\|ai` | Cambia el fondo |
| `--bg-color` / `--bg-image` | Fondo nuevo: color plano o imagen |
| `--words <n>` | Palabras por línea de subtítulo |
| `--model tiny\|base\|small\|medium` | Modelo de whisper (más grande = mejor y más lento) |
| `--fal` | Transcribe en la nube en vez de en local |
| `--no-subtitles` | Solo corta, sin subtitular |

La transcripción local no manda tu grabación a ningún sitio.
