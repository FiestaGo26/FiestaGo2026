import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { CEO_SCRIPT, CEO_STEPS, type CeoCard, type CeoScene } from './ceo-agent'
import { theme } from './theme'

// Vídeo "Mi negocio lo dirige un CEO de IA". Mismo lenguaje visual que los
// TikToks explicativos de agentes: fondo noche con brillo violeta, tarjeta
// de UI arriba, subtítulo con palabra resaltada en medio y checklist de
// 5 pasos abajo que se va marcando según avanza el guion.

// Pila con respaldo sans: si la fuente de marca no está instalada en la
// máquina que renderiza, no cae a una serif.
const F = {
  display: `'${theme.displayFont}', 'Helvetica Neue', Arial, sans-serif`,
  body:    `'${theme.bodyFont}', 'Helvetica Neue', Arial, sans-serif`,
  mono:    `'${theme.monoFont}', 'DejaVu Sans Mono', monospace`,
}

const V = {
  bg:      '#07070F',
  glow:    '#6D28D9',
  violet:  '#8B5CF6',
  lilac:   '#C4B5FD',
  card:    '#12121F',
  cardHi:  '#181829',
  border:  '#2A2A40',
  ink:     '#F5F3FF',
  mid:     '#A1A1B5',
  dim:     '#5B5B73',
  orange:  '#C2410C',
  green:   '#22C55E',
}

export const CeoAgentVideo: React.FC<{ noVoice?: boolean }> = ({ noVoice }) => {
  const { fps, durationInFrames } = useVideoConfig()

  let cursor = 0
  const sequences = CEO_SCRIPT.scenes.map((scene, i) => {
    const frames = Math.round(scene.duration * fps)
    const el = (
      <Sequence key={i} from={cursor} durationInFrames={frames}>
        <Scene scene={scene} index={i} />
      </Sequence>
    )
    cursor += frames
    return el
  })

  return (
    <AbsoluteFill style={{ backgroundColor: V.bg, fontFamily: F.body, color: V.ink }}>
      <Background />
      {sequences}
      <ProgressBar totalFrames={durationInFrames} />
      <div style={{
        position: 'absolute', bottom: 64, left: 0, right: 0, textAlign: 'center',
        fontFamily: F.mono, fontSize: 24, letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'rgba(245,243,255,0.5)',
      }}>
        fiestago.es · @fiestagospain
      </div>
      {!noVoice && <Audio src={staticFile(`voices/${CEO_SCRIPT.slug}.mp3`)} />}
    </AbsoluteFill>
  )
}

// ─── Fondo con brillo violeta que respira ─────────────────────────
const Background: React.FC = () => {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 90) * 60
  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', width: 1300, height: 1300, borderRadius: '50%',
        top: -500 + drift, right: -520,
        background: `radial-gradient(circle, ${V.glow}88 0%, transparent 62%)`,
      }} />
      <div style={{
        position: 'absolute', width: 1100, height: 1100, borderRadius: '50%',
        bottom: -560 - drift, left: -520,
        background: `radial-gradient(circle, #1D4ED855 0%, transparent 65%)`,
      }} />
    </AbsoluteFill>
  )
}

// ─── Escena: tarjeta + subtítulo + checklist ──────────────────────
const Scene: React.FC<{ scene: CeoScene; index: number }> = ({ scene, index }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 110 } })

  return (
    <AbsoluteFill>
      {/* Tarjeta principal */}
      <div style={{
        position: 'absolute', top: 150, left: 70, right: 70, height: 860,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [60, 0])}px) scale(${interpolate(enter, [0, 1], [0.95, 1])})`,
      }}>
        <Card kind={scene.card} />
      </div>

      {/* Subtítulo */}
      <div style={{
        position: 'absolute', top: 1060, left: 60, right: 60, display: 'flex', justifyContent: 'center',
      }}>
        <Caption text={scene.caption} />
      </div>

      {/* Checklist de 5 pasos (desde la 2ª escena) */}
      {index > 0 && scene.card !== 'cta' && (
        <div style={{ position: 'absolute', top: 1270, left: 70, right: 70 }}>
          <Checklist step={scene.step} />
        </div>
      )}
    </AbsoluteFill>
  )
}

const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 4, fps, config: { damping: 11, stiffness: 140 } })
  const parts = text.split('*')
  return (
    <div style={{
      background: 'rgba(18,18,31,0.88)', border: `1px solid ${V.border}`, borderRadius: 22,
      padding: '22px 34px', maxWidth: 940, textAlign: 'center',
      fontFamily: F.display, fontWeight: 700, fontSize: 56, lineHeight: 1.15, letterSpacing: '-0.02em',
      transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`, opacity: pop,
    }}>
      {parts.map((p, i) => (
        <span key={i} style={{ color: i % 2 === 1 ? V.lilac : V.ink }}>{p}</span>
      ))}
    </div>
  )
}

const Checklist: React.FC<{ step: number }> = ({ step }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{
      background: V.card, border: `2px solid ${V.violet}66`, borderRadius: 26, padding: '26px 30px',
      boxShadow: `0 0 60px ${V.glow}33`,
    }}>
      {CEO_STEPS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        const reached = n <= step
        // El paso activo se "marca" con un pequeño pop al entrar la escena
        const pop = active ? spring({ frame: frame - 8, fps, config: { damping: 10, stiffness: 160 } }) : 1
        return (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 20, padding: '11px 0',
            opacity: reached ? 1 : 0.55,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 800,
              background: done || active ? V.violet : 'transparent',
              border: done || active ? 'none' : `2px solid ${V.dim}`,
              color: done || active ? '#fff' : V.dim,
              transform: `scale(${active ? interpolate(pop, [0, 1], [0.6, 1]) : 1})`,
            }}>
              {done || (active && pop > 0.5) ? '✓' : n}
            </div>
            {reached ? (
              <span style={{ fontSize: 38, fontWeight: 700, color: active ? V.ink : V.mid }}>
                {label}
              </span>
            ) : (
              <div style={{ height: 14, width: 260 + i * 40, borderRadius: 7, background: V.border }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tarjetas ─────────────────────────────────────────────────────
const Card: React.FC<{ kind: CeoCard }> = ({ kind }) => {
  switch (kind) {
    case 'kpi':       return <KpiCard />
    case 'checklist': return <StepsCard />
    case 'chat':      return <ChatCard />
    case 'metrics':   return <MetricsCard />
    case 'tasks':     return <TasksCard />
    case 'routines':  return <RoutinesCard />
    case 'rule':      return <RuleCard />
    case 'inbox':     return <InboxCard />
    case 'cta':       return <CtaCard />
  }
}

const panel: React.CSSProperties = {
  width: '100%', background: V.card, border: `1px solid ${V.border}`, borderRadius: 30,
  boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
}

const WindowBar: React.FC<{ url: string }> = ({ url }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 24px', borderBottom: `1px solid ${V.border}` }}>
    {['#EF4444', '#F59E0B', '#22C55E'].map(c => <span key={c} style={{ width: 16, height: 16, borderRadius: '50%', background: c }} />)}
    <span style={{ marginLeft: 16, fontFamily: F.mono, fontSize: 24, color: V.mid }}>{url}</span>
  </div>
)

function typed(text: string, frame: number, start: number, cps = 32, fps = 30) {
  const n = Math.max(0, Math.floor(((frame - start) / fps) * cps))
  return text.slice(0, n)
}

const KpiCard: React.FC = () => {
  const frame = useCurrentFrame()
  const minutes = Math.round(interpolate(frame, [0, 40], [0, 52], { extrapolateRight: 'clamp' }))
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: F.mono, fontSize: 30, letterSpacing: '0.2em', color: V.lilac, textTransform: 'uppercase' }}>
        Empieza a trabajar a las
      </div>
      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 260, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 10 }}>
        07:{String(minutes).padStart(2, '0')}
      </div>
      <div style={{ ...panel, marginTop: 50, padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 22, textAlign: 'left' }}>
        <div style={{ fontSize: 64 }}>🧠</div>
        <div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>CEO FiestaGo</div>
          <div style={{ fontSize: 26, color: V.mid }}>todos los días · sin vacaciones</div>
        </div>
        <div style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: '50%', background: V.green, boxShadow: `0 0 20px ${V.green}` }} />
      </div>
    </div>
  )
}

const StepsCard: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - 6, fps, config: { damping: 9, stiffness: 120 } })
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: F.display, fontWeight: 800, fontSize: 420, lineHeight: 0.9,
        background: `linear-gradient(180deg, ${V.ink}, ${V.violet})`, WebkitBackgroundClip: 'text', color: 'transparent',
        transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
      }}>5</div>
      <div style={{ fontSize: 56, fontWeight: 700, marginTop: 10 }}>pasos para montarlo</div>
      <div style={{ fontSize: 32, color: V.mid, marginTop: 14 }}>sin saber programar</div>
    </div>
  )
}

const ChatCard: React.FC = () => {
  const frame = useCurrentFrame()
  const you = 'Eres el CEO de FiestaGo. Diriges el negocio y me reportas a mí.'
  const bot = 'Hecho. Soy el CEO de FiestaGo. Revisaré el negocio cada mañana y te avisaré solo si algo importa.'
  const botStart = 70
  return (
    <div style={{ ...panel, padding: 34 }}>
      <div style={{ textAlign: 'center', fontSize: 26, color: V.mid, marginBottom: 26 }}>🧠 CEO FiestaGo</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: V.orange, borderRadius: '26px 26px 6px 26px', padding: '22px 26px', maxWidth: '82%', fontSize: 34, lineHeight: 1.35 }}>
          {typed(you, frame, 6)}
        </div>
      </div>
      {frame > botStart && (
        <div style={{ display: 'flex', marginTop: 26 }}>
          <div style={{ background: V.cardHi, border: `1px solid ${V.border}`, borderRadius: '26px 26px 26px 6px', padding: '22px 26px', maxWidth: '86%', fontSize: 34, lineHeight: 1.35 }}>
            {typed(bot, frame, botStart + 6)}
          </div>
        </div>
      )}
    </div>
  )
}

const MetricsCard: React.FC = () => {
  const frame = useCurrentFrame()
  const tiles = [
    { icon: '🏪', label: 'Proveedores',     value: 128 },
    { icon: '📋', label: 'Reservas 7 días', value: 14 },
    { icon: '🎉', label: 'Lista de espera', value: 342 },
    { icon: '🚨', label: 'Alertas',         value: 2 },
  ]
  return (
    <div style={{ ...panel, overflow: 'hidden' }}>
      <WindowBar url="supabase · fiestago" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, padding: 30 }}>
        {tiles.map((t, i) => {
          const start = 10 + i * 14
          const v = Math.round(interpolate(frame, [start, start + 40], [0, t.value], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
          const op = interpolate(frame, [start, start + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          return (
            <div key={t.label} style={{ background: V.cardHi, border: `1px solid ${V.border}`, borderRadius: 22, padding: '26px 26px', opacity: op }}>
              <div style={{ fontSize: 44 }}>{t.icon}</div>
              <div style={{ fontSize: 28, color: V.mid, marginTop: 10 }}>{t.label}</div>
              <div style={{ fontFamily: F.display, fontSize: 92, fontWeight: 800, lineHeight: 1.05 }}>{v}</div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '0 30px 28px', fontSize: 24, color: V.dim, fontFamily: F.mono }}>* cifras de ejemplo</div>
    </div>
  )
}

const TASKS = [
  'monetizar reservas y comisiones',
  'captar y activar proveedores',
  'convertir la lista de espera',
  'optimizar SEO para Google y chatbots',
  'arrancar una newsletter',
  'mantener vivo IG y TikTok',
  'vigilar bugs e incidencias',
  'tenerme al día de lo que importa',
]

const TasksCard: React.FC = () => {
  const frame = useCurrentFrame()
  const shown = Math.floor(interpolate(frame, [6, 120], [0, TASKS.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  const hi = Math.min(shown - 1, TASKS.length - 1)
  return (
    <div style={{ ...panel, background: V.orange, border: 'none', padding: '34px 30px', fontFamily: F.mono }}>
      {TASKS.map((t, i) => (
        <div key={t} style={{
          fontSize: 36, lineHeight: 1.25, padding: '8px 14px', borderRadius: 10, color: '#FFF7ED',
          opacity: i < shown ? 1 : 0,
          outline: i === hi ? '3px solid #FFF7ED' : 'none',
        }}>
          &gt; {t}
        </div>
      ))}
    </div>
  )
}

const Toggle: React.FC<{ on: number }> = ({ on }) => (
  <div style={{
    width: 96, height: 54, borderRadius: 27, flexShrink: 0, position: 'relative',
    background: on > 0.5 ? V.orange : V.border,
  }}>
    <div style={{
      position: 'absolute', top: 7, left: interpolate(on, [0, 1], [7, 49]),
      width: 40, height: 40, borderRadius: '50%', background: '#fff',
    }} />
  </div>
)

const RoutinesCard: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const routines = [
    { label: 'FiestaGo · operaciones diarias', when: 'Cada día a las 07:52', at: 30 },
    { label: 'FiestaGo · informe semanal del CEO', when: 'Cada lunes a las 09:17', at: 75 },
  ]
  return (
    <div style={{ ...panel, padding: 34 }}>
      <div style={{ fontSize: 30, color: V.mid, marginBottom: 20 }}>Rutinas</div>
      <div style={{ border: `3px solid ${V.violet}`, borderRadius: 24, padding: '10px 26px', boxShadow: `0 0 40px ${V.glow}55` }}>
        {routines.map((r, i) => (
          <div key={r.label} style={{
            display: 'flex', alignItems: 'center', gap: 20, padding: '24px 0',
            borderTop: i ? `1px solid ${V.border}` : 'none',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{r.label}</div>
              <div style={{ fontSize: 28, color: V.mid, marginTop: 4 }}>{r.when}</div>
            </div>
            <Toggle on={spring({ frame: frame - r.at, fps, config: { damping: 14 } })} />
          </div>
        ))}
      </div>
    </div>
  )
}

const RuleCard: React.FC = () => {
  const frame = useCurrentFrame()
  const hl = interpolate(frame, [40, 80], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ ...panel, padding: '40px 38px', fontSize: 38, lineHeight: 1.5, color: '#D4D4E4' }}>
      <p style={{ margin: 0 }}>
        Esto es lo que hago ahora: cada mañana reviso proveedores, reservas y alertas. Solo te escribo si algo importa.
      </p>
      <p style={{ margin: '26px 0 0' }}>
        <span style={{
          color: V.ink, padding: '2px 6px', borderRadius: 6,
          background: `linear-gradient(90deg, ${V.green}55 ${hl}%, transparent ${hl}%)`,
          boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
        }}>
          Antes de que salga nada a la gente —emails, pagos o publicaciones— te pregunto primero.
        </span>
      </p>
    </div>
  )
}

const InboxCard: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const proposals = [
    'Aprobar los 6 proveedores que se registraron ayer',
    'Lanzar la 1ª newsletter a la lista de espera',
    'Crear la página «fotógrafos de boda en Valencia»',
  ]
  const clickAt = 120
  const clicked = frame > clickAt
  return (
    <div style={{ ...panel, padding: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
        <div style={{ fontSize: 50 }}>🧠</div>
        <div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>CEO FiestaGo · Parte diario</div>
          <div style={{ fontSize: 24, color: V.mid }}>07:52 · 3 propuestas necesitan tu OK</div>
        </div>
      </div>
      {proposals.map((p, i) => {
        const s = spring({ frame: frame - 14 - i * 16, fps, config: { damping: 14 } })
        const isClicked = i === 0 && clicked
        return (
          <div key={p} style={{
            display: 'flex', alignItems: 'center', gap: 16, background: V.cardHi, border: `1px solid ${V.border}`,
            borderRadius: 18, padding: '20px 22px', marginTop: 14, opacity: s,
            transform: `translateX(${interpolate(s, [0, 1], [80, 0])}px)`,
          }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: V.lilac }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 30, lineHeight: 1.3 }}>{p}</span>
            <span style={{
              fontSize: 26, fontWeight: 700, borderRadius: 12, padding: '10px 16px',
              background: isClicked ? V.green : 'transparent',
              color: isClicked ? '#04120C' : V.green, border: `2px solid ${V.green}`,
            }}>{isClicked ? '✓ Aprobada' : 'Aprobar'}</span>
          </div>
        )
      })}
    </div>
  )
}

const CtaCard: React.FC = () => {
  const frame = useCurrentFrame()
  const handle = '@fiestagospain'
  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 150, letterSpacing: '-0.04em' }}>
        Fiesta<span style={{ color: V.violet }}>Go</span>
      </div>
      <div style={{
        margin: '50px auto 0', width: 760, display: 'flex', alignItems: 'center', gap: 20,
        background: '#fff', color: '#111', borderRadius: 60, padding: '24px 34px',
        boxShadow: `-6px 0 0 #25F4EE, 6px 0 0 #FE2C55`,
      }}>
        <span style={{ fontSize: 40 }}>🔍</span>
        <span style={{ fontSize: 44, fontWeight: 600 }}>{typed(handle, frame, 10, 14)}</span>
      </div>
      <div style={{ fontSize: 34, color: V.mid, marginTop: 40 }}>Escríbeme «CEO» y te cuento cómo</div>
    </div>
  )
}

const ProgressBar: React.FC<{ totalFrames: number }> = ({ totalFrames }) => {
  const frame = useCurrentFrame()
  const progress = interpolate(frame, [0, totalFrames], [0, 100], { extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', bottom: 34, left: 60, right: 60, height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3 }}>
      <div style={{ width: `${progress}%`, height: '100%', background: V.violet, borderRadius: 3 }} />
    </div>
  )
}
