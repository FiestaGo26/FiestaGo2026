import {
  AbsoluteFill, OffthreadVideo, Sequence,
  interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion'
import { theme } from './theme'

// Monta una grabación tuya: el vídeo a pantalla completa, los subtítulos
// quemados en el estilo de la marca y, si quieres, una tarjeta de CTA final.
//
// Los subtítulos van quemados porque en Reels y TikTok la mayoría ve sin
// sonido: son lo que hace que se entienda el mensaje, no el audio.

const FONT = `'${theme.bodyFont}', 'DejaVu Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`
const DISPLAY = `'${theme.displayFont}', 'DejaVu Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`

export type Cue = { start: number; end: number; text: string }

export type EditedProps = {
  /** Ruta dentro de public/, p.ej. 'edit/mi-video.mp4' */
  videoSrc: string
  cues: Cue[]
  /** Segundos de tarjeta de CTA al final. 0 = sin tarjeta. */
  ctaSeconds?: number
  ctaKicker?: string
  ctaSub?: string
  accent?: string
}

export const EditedVideo: React.FC<EditedProps> = ({
  videoSrc, cues, ctaSeconds = 0, ctaKicker = 'Date de alta\ngratis',
  ctaSub = 'fiestago.es', accent = theme.coral,
}) => {
  const { fps, durationInFrames } = useVideoConfig()
  const ctaFrames = Math.round((ctaSeconds || 0) * fps)
  const videoFrames = durationInFrames - ctaFrames

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: FONT }}>
      <Sequence durationInFrames={Math.max(1, videoFrames)}>
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
          <OffthreadVideo
            src={staticFile(videoSrc)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Degradado para que el subtítulo se lea sobre cualquier fondo */}
          <AbsoluteFill style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 34%)',
          }}/>
        </AbsoluteFill>
        <Subtitles cues={cues} />
        <Watermark />
      </Sequence>

      {ctaFrames > 0 && (
        <Sequence from={videoFrames} durationInFrames={ctaFrames}>
          <CtaCard kicker={ctaKicker} sub={ctaSub} accent={accent} />
        </Sequence>
      )}
    </AbsoluteFill>
  )
}

// ─── Subtítulos ───────────────────────────────────────────────────
const Subtitles: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  const active = cues.find(c => t >= c.start && t < c.end)
  if (!active) return null

  // Fundido corto de entrada: sin él, el cambio de línea da un salto brusco.
  const opacity = interpolate(t, [active.start, active.start + 0.12], [0, 1],
    { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 260 }}>
      <div style={{
        fontFamily: FONT,
        fontSize: 56,
        fontWeight: 700,
        color: theme.ink,
        textAlign: 'center',
        maxWidth: 900,
        lineHeight: 1.22,
        textShadow: '0 2px 20px rgba(0,0,0,0.95)',
        opacity,
      }}>
        {active.text}
      </div>
    </AbsoluteFill>
  )
}

const CtaCard: React.FC<{ kicker: string; sub: string; accent: string }> = ({ kicker, sub, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })
  const opacity = interpolate(enter, [0, 1], [0, 1])
  const scale = interpolate(enter, [0, 1], [0.94, 1])

  return (
    <AbsoluteFill style={{
      backgroundColor: accent, justifyContent: 'center', alignItems: 'center', padding: '80px 60px',
    }}>
      <div style={{
        fontFamily: DISPLAY, fontWeight: 700, fontSize: 104, lineHeight: 1.02,
        color: theme.ink, textAlign: 'center', letterSpacing: '-0.03em',
        whiteSpace: 'pre-line', opacity, transform: `scale(${scale})`,
      }}>{kicker}</div>
      <div style={{
        marginTop: 36, fontSize: 36, fontWeight: 500,
        color: 'rgba(255,255,255,0.9)', textAlign: 'center', opacity,
      }}>{sub}</div>
    </AbsoluteFill>
  )
}

const Watermark: React.FC = () => (
  <div style={{
    position: 'absolute', bottom: 90, left: 0, right: 0, textAlign: 'center',
    fontFamily: `'${theme.monoFont}', 'DejaVu Sans Mono', monospace`,
    fontSize: 22, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: 'rgba(245,241,232,0.55)',
  }}>fiestago.es</div>
)
