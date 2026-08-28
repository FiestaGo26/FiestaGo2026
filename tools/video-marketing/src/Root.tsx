import { Composition } from 'remotion'
import { MarketingVideo } from './MarketingVideo'
import { SCRIPTS, totalDuration } from './scripts'

// Registramos una Composition por cada guión, con su duración exacta
// calculada como suma de sus escenas. Así en Remotion Studio se ve el
// árbol de los 10 vídeos y puedes previsualizar cualquiera en vivo.
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
