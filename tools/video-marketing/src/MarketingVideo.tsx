import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { SCRIPTS, type Script, type Scene } from './scripts'
import { theme, targetAccent } from './theme'
import { CHARACTERS } from './characters'

// La composición se parametriza por slug del guión (o el primero por defecto).
// Cada escena del guión se renderiza en secuencia, sincronizada con el audio
// que gen-voices.mjs deja en public/voices/{slug}.mp3

export const MarketingVideo: React.FC<{ slug: string }> = ({ slug }) => {
  const { fps, durationInFrames } = useVideoConfig()
  const script = SCRIPTS.find(s => s.slug === slug) || SCRIPTS[0]
  const accent = targetAccent(script.target)

  // Convertimos escenas del guión a Sequences con frame ranges.
  let cursor = 0
  const sequences = script.scenes.map((scene, i) => {
    const frames = Math.round(scene.duration * fps)
    const el = (
      <Sequence key={i} from={cursor} durationInFrames={frames}>
        <SceneRenderer scene={scene} accent={accent} />
      </Sequence>
    )
    cursor += frames
    return el
  })

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: theme.bodyFont }}>
      {sequences}
      {/* Barra de progreso sutil abajo del todo */}
      <ProgressBar accent={accent} totalFrames={durationInFrames}/>
      {/* Watermark FiestaGo abajo derecha */}
      <Watermark />
      {/* Audio de voz IA (opcional · si el mp3 no existe, no rompe) */}
      <Audio src={staticFile(`voices/${slug}.mp3`)} />
    </AbsoluteFill>
  )
}

// ─── Escena individual ────────────────────────────────────────────
const SceneRenderer: React.FC<{ scene: Scene; accent: string }> = ({ scene, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Spring de entrada del texto (0-15 frames)
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })
  const opacity = interpolate(enter, [0, 1], [0, 1])
  const translateY = interpolate(enter, [0, 1], [30, 0])
  const scale = interpolate(enter, [0, 1], [0.94, 1])

  const bg = scene.bgAccent ? accent : theme.bg
  const ink = scene.bgAccent ? theme.ink : theme.ink
  const Character = scene.character ? CHARACTERS[scene.character] : null

  return (
    <AbsoluteFill style={{ backgroundColor: bg, padding: '80px 60px', justifyContent: 'center', alignItems: 'center' }}>
      {/* Contenido visual opcional (chips, panel, etc.) */}
      {scene.visual && <VisualElement kind={scene.visual} accent={accent}/>}

      {/* Muñeco animado · si la escena tiene character definido */}
      {Character && (
        <div style={{
          marginBottom: 40,
          filter: 'drop-shadow(0 12px 30px rgba(0, 0, 0, 0.32))',
        }}>
          <Character />
        </div>
      )}

      {/* Icono grande decorativo · solo si NO hay muñeco */}
      {scene.icon && !Character && (
        <div style={{ fontSize: 140, marginBottom: 40, opacity, transform: `scale(${scale})` }}>
          {scene.icon}
        </div>
      )}

      {/* Kicker principal · centrado, grande, animado */}
      <div style={{
        fontFamily: theme.displayFont,
        fontWeight: 700,
        fontSize: 96,
        lineHeight: 1.02,
        color: ink,
        textAlign: 'center',
        letterSpacing: '-0.03em',
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        whiteSpace: 'pre-line',
        maxWidth: 900,
      }}>
        {scene.kicker}
      </div>

      {/* Subtexto */}
      {scene.sub && (
        <div style={{
          marginTop: 36,
          fontFamily: theme.bodyFont,
          fontSize: 34,
          fontWeight: 500,
          color: scene.bgAccent ? 'rgba(255,255,255,0.85)' : theme.inkMid,
          textAlign: 'center',
          opacity,
          maxWidth: 800,
        }}>
          {scene.sub}
        </div>
      )}
    </AbsoluteFill>
  )
}

// ─── Elementos visuales estilo (mockups del panel simplificados) ──
const VisualElement: React.FC<{ kind: NonNullable<Scene['visual']>; accent: string }> = ({ kind, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 80 } })
  const opacity = interpolate(enter, [0, 1], [0, 0.15])

  // Estos son fondos decorativos discretos · el kicker sigue siendo el foco
  const wrapper: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity,
    pointerEvents: 'none',
  }

  if (kind === 'stats' || kind === 'chips') {
    return (
      <div style={wrapper}>
        <div style={{
          width: 700, height: 700,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
        }}/>
      </div>
    )
  }
  if (kind === 'compare') {
    return (
      <div style={wrapper}>
        <div style={{
          width: '80%', height: 4,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}/>
      </div>
    )
  }
  if (kind === 'panel' || kind === 'quote') {
    return (
      <div style={wrapper}>
        <div style={{
          width: '85%', height: '55%',
          border: `2px solid ${accent}`,
          borderRadius: 24,
        }}/>
      </div>
    )
  }
  if (kind === 'guarantee') {
    return (
      <div style={wrapper}>
        <div style={{
          width: 500, height: 500,
          border: `6px solid ${accent}`,
          borderRadius: '50%',
        }}/>
      </div>
    )
  }
  return null
}

// ─── Barra de progreso inferior ───────────────────────────────────
const ProgressBar: React.FC<{ accent: string; totalFrames: number }> = ({ accent, totalFrames }) => {
  const frame = useCurrentFrame()
  const progress = interpolate(frame, [0, totalFrames], [0, 100], { extrapolateRight: 'clamp' })
  return (
    <div style={{
      position: 'absolute', bottom: 40, left: 60, right: 60,
      height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3,
    }}>
      <div style={{
        width: `${progress}%`, height: '100%', background: accent, borderRadius: 3,
      }}/>
    </div>
  )
}

// ─── Watermark ────────────────────────────────────────────────────
const Watermark: React.FC = () => (
  <div style={{
    position: 'absolute', bottom: 70, left: 0, right: 0,
    textAlign: 'center',
    fontFamily: theme.monoFont,
    fontSize: 22, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: 'rgba(245,241,232,0.55)',
  }}>
    fiestago.es
  </div>
)
