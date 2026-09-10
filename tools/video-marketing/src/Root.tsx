import { Composition } from 'remotion'
import { MarketingVideo } from './MarketingVideo'
import { SCRIPTS, totalDuration } from './scripts'
import { CinematicVideo } from './CinematicVideo'
import { EditedVideo } from './EditedVideo'
import { REELS, totalDuration as cineDuration } from './cinematic/shots'

// Registramos una Composition por cada guión, con su duración exacta
// calculada como suma de sus escenas. Así en Remotion Studio se ve el
// árbol de los vídeos y puedes previsualizar cualquiera en vivo.
export const RemotionRoot: React.FC = () => (
  <>
    {SCRIPTS.map(s => (
      <Composition
        key={s.slug}
        id={s.slug}
        component={MarketingVideo}
        durationInFrames={Math.round(totalDuration(s) * 30)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ slug: s.slug }}
      />
    ))}

    {/* Reels híbridos: tomas de vídeo IA + motion graphics.
        Requieren los MP4 en public/shots/{slug}/ — los deja
        scripts/gen-shots.mjs (con --dry-run genera placeholders). */}
    {REELS.map(r => (
      <Composition
        key={r.slug}
        id={r.slug}
        component={CinematicVideo}
        durationInFrames={Math.round(cineDuration(r) * 30)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ slug: r.slug }}
      />
    ))}

    {/* Composición del vídeo diario: no tiene guión fijo, se le pasa el reel
        entero por inputProps desde scripts/daily.mjs. La duración real la
        fija el renderizador; estos 15s son solo el valor por defecto. */}
    <Composition
      id="daily"
      component={CinematicVideo}
      durationInFrames={15 * 30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ slug: 'daily' }}
    />

    {/* Montaje de una grabación propia: el vídeo, los subtítulos y el CTA
        llegan por inputProps desde scripts/edit.mjs. */}
    <Composition
      id="edited"
      component={EditedVideo}
      durationInFrames={30 * 30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ videoSrc: 'edit/placeholder.mp4', cues: [] }}
    />

    {/* Alias 'MarketingVideo' que renderiza el primer script — útil para
        `remotion render` con --props={"slug":"XX"} */}
    <Composition
      id="MarketingVideo"
      component={MarketingVideo}
      durationInFrames={Math.round(totalDuration(SCRIPTS[0]) * 30)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ slug: SCRIPTS[0].slug }}
    />
  </>
)
