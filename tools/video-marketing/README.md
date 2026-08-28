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
