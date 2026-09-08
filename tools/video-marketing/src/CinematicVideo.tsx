import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence,
  interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion'
import { reel, totalDuration, type Reel, type Shot } from './cinematic/shots'
import { theme, targetAccent } from './theme'

// theme.ts nombra 'Space Grotesk' / 'Inter' pero el proyecto no las carga
// (no hay @remotion/google-fonts), así que el navegador headless cae al
// serif por defecto. Declaramos la cascada aquí para que, haya o no las
// webfonts instaladas, el resultado sea sans — que es la intención.
const DISPLAY = `'${theme.displayFont}', 'DejaVu Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`
const BODY    = `'${theme.bodyFont}', 'DejaVu Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`
const MONO    = `'${theme.monoFont}', 'DejaVu Sans Mono', ui-monospace, SFMono-Regular, Menlo, monospace`

// Composición híbrida: tomas de vídeo IA (public/shots/{slug}/{id}.mp4)
// intercaladas con escenas de motion graphics renderizadas aquí mismo.
// La voz va en OFF (public/voices/{slug}.mp3) — sin lipsync, sin sobrecoste.

export const CinematicVideo: React.FC<{ slug: string }> = ({ slug }) => {
  const { fps } = useVideoConfig()
  const r = reel(slug)
  const accent = targetAccent(r.target)

  let cursor = 0
  const sequences = r.shots.map(shot => {
    const frames = Math.round(shot.durationInSeconds * fps)
    const el = (
      <Sequence key={shot.id} from={cursor} durationInFrames={frames}>
        {shot.kind === 'ai'
          ? <AiShotRenderer slug={slug} id={shot.id} />
          : <MotionShotRenderer shot={shot} accent={accent} />}
        {shot.subtitle && <Subtitle text={shot.subtitle} />}
      </Sequence>
    )
    cursor += frames
    return el
  })

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: BODY }}>
      {sequences}
      <Watermark />
      <AiDisclosure />
      <Audio src={staticFile(`voices/${slug}.mp3`)} />
    </AbsoluteFill>
  )
}

// ─── Toma de vídeo IA ─────────────────────────────────────────────
// El MP4 lo deja scripts/gen-shots.mjs. En --dry-run son placeholders,
// así que la pieza se puede montar y revisar sin gastar un euro.
const AiShotRenderer: React.FC<{ slug: string; id: string }> = ({ slug, id }) => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    <OffthreadVideo
      src={staticFile(`shots/${slug}/${id}.mp4`)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      muted
    />
    {/* Degradado inferior para que el subtítulo se lea siempre */}
    <AbsoluteFill style={{
      background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 38%)',
    }}/>
  </AbsoluteFill>
)

// ─── Toma de motion graphics ──────────────────────────────────────
const MotionShotRenderer: React.FC<{
  shot: Extract<Shot, { kind: 'motion' }>
  accent: string
}> = ({ shot, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })
  const opacity = interpolate(enter, [0, 1], [0, 1])
  const translateY = interpolate(enter, [0, 1], [30, 0])
  const scale = interpolate(enter, [0, 1], [0.94, 1])

  return (
    <AbsoluteFill style={{
      backgroundColor: shot.bgAccent ? accent : theme.bg,
      padding: '80px 60px',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <div style={{
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: 104,
        lineHeight: 1.02,
        color: theme.ink,
        textAlign: 'center',
        letterSpacing: '-0.03em',
        whiteSpace: 'pre-line',
        maxWidth: 900,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}>
        {shot.kicker}
      </div>
      {shot.sub && (
        <div style={{
          marginTop: 36,
          fontSize: 34,
          fontWeight: 500,
          color: shot.bgAccent ? 'rgba(255,255,255,0.85)' : theme.inkMid,
          textAlign: 'center',
          maxWidth: 800,
          opacity,
        }}>
          {shot.sub}
        </div>
      )}
    </AbsoluteFill>
  )
}

// ─── Subtítulo quemado ────────────────────────────────────────────
// Quemado a propósito: en TikTok/Reels la mayoría ve sin sonido.
const Subtitle: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 300 }}>
      <div style={{
        fontFamily: BODY,
        fontSize: 46,
        fontWeight: 700,
        color: theme.ink,
        textAlign: 'center',
        maxWidth: 880,
        lineHeight: 1.25,
        textShadow: '0 2px 18px rgba(0,0,0,0.9)',
        opacity,
      }}>
        {text}
      </div>
    </AbsoluteFill>
  )
}

const Watermark: React.FC = () => (
  <div style={{
    position: 'absolute', bottom: 90, left: 0, right: 0,
    textAlign: 'center',
    fontFamily: MONO,
    fontSize: 22, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: 'rgba(245,241,232,0.55)',
  }}>
    fiestago.es
  </div>
)

// Etiquetado obligatorio de contenido sintético (Reglamento europeo de IA).
const AiDisclosure: React.FC = () => (
  <div style={{
    position: 'absolute', bottom: 44, left: 0, right: 0,
    textAlign: 'center',
    fontFamily: BODY,
    fontSize: 19,
    color: 'rgba(245,241,232,0.42)',
  }}>
    Contenido generado con IA
  </div>
)

export { totalDuration, type Reel }
