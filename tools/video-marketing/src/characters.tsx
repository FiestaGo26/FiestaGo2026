// Muñecos animados para las escenas · React + SVG dentro de Remotion.
// Cada personaje usa el frame actual y spring() para movimiento a 30fps.
// La escala se pasa desde MarketingVideo para adaptar al ancho del vídeo.

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { theme } from './theme'

export type CharacterKey =
  | 'couple' | 'phoneMsg' | 'stressed' | 'starBurst'
  | 'rings' | 'cursor' | 'checkmark'

const skin = '#F5D3B0'
const skin2 = '#F0B04C'
const hair1 = '#3A2618'
const hair2 = '#8B5A3C'
const ink = '#0A0A0C'
const white = '#F5F1E8'

// ─── Utilidad: valor oscilante suave, buena para wobble/float ─────
function wave(frame: number, fps: number, periodSec: number, amp: number = 1) {
  return Math.sin((frame / (fps * periodSec)) * Math.PI * 2) * amp
}

// ─── Couple (para 40 parejas · WOW planners) ─────────────────────
export const Couple: React.FC<{ size?: number }> = ({ size = 520 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })
  const scale = interpolate(enter, [0, 1], [0.6, 1])
  const opacity = interpolate(enter, [0, 1], [0, 1])

  const wobble1 = wave(frame, fps, 2.4, 3)
  const wobble2 = wave(frame + fps * 0.5, fps, 2.4, -3)
  const heartCycle = ((frame % (fps * 2.2)) / (fps * 2.2))
  const heartY = -heartCycle * 42
  const heartOpacity = heartCycle < 0.3 ? heartCycle / 0.3
                     : heartCycle > 0.85 ? (1 - heartCycle) / 0.15 : 1

  return (
    <svg viewBox="0 0 260 220" style={{ width: size, height: size * 220 / 260, opacity, transform: `scale(${scale})`, overflow: 'visible' }}>
      <ellipse cx="130" cy="204" rx="90" ry="6" fill={ink} opacity={0.28}/>
      {/* corazón grande flotando */}
      <path
        d="M130 46 C 122 34, 106 34, 106 50 C 106 66, 130 82, 130 82 C 130 82, 154 66, 154 50 C 154 34, 138 34, 130 46 Z"
        fill={theme.coral}
        style={{ transform: `translateY(${heartY}px)`, transformOrigin: 'center', opacity: heartOpacity }}
      />
      {/* Persona 1 · con wobble */}
      <g style={{ transform: `rotate(${wobble1}deg)`, transformOrigin: '86px 200px' }}>
        <rect x="70" y="118" width="32" height="66" rx="12" fill={theme.coral}/>
        <rect x="68" y="130" width="14" height="30" rx="7" fill={theme.coral}/>
        <rect x="90" y="130" width="14" height="30" rx="7" fill={theme.coral}/>
        <rect x="72" y="180" width="12" height="16" rx="3" fill="#2A2A30"/>
        <rect x="88" y="180" width="12" height="16" rx="3" fill="#2A2A30"/>
        <circle cx="86" cy="96" r="22" fill={skin2}/>
        <path d="M64 92 Q 66 78 86 74 Q 106 78 108 92 L 108 86 Q 108 72 86 68 Q 64 72 64 86 Z" fill={hair1}/>
        <ellipse cx="80" cy="94" rx="2.4" ry="2.4" fill={ink}/>
        <ellipse cx="92" cy="94" rx="2.4" ry="2.4" fill={ink}/>
        <path d="M80 104 Q 86 108 92 104" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="76" cy="100" r="2.4" fill={theme.coral} opacity={0.6}/>
        <circle cx="96" cy="100" r="2.4" fill={theme.coral} opacity={0.6}/>
      </g>
      {/* Persona 2 · con wobble opuesto */}
      <g style={{ transform: `rotate(${wobble2}deg)`, transformOrigin: '174px 200px' }}>
        <rect x="158" y="118" width="32" height="66" rx="12" fill={theme.sage}/>
        <rect x="156" y="130" width="14" height="30" rx="7" fill={theme.sage}/>
        <rect x="178" y="130" width="14" height="30" rx="7" fill={theme.sage}/>
        <rect x="160" y="180" width="12" height="16" rx="3" fill="#2A2A30"/>
        <rect x="176" y="180" width="12" height="16" rx="3" fill="#2A2A30"/>
        <circle cx="174" cy="96" r="22" fill={skin}/>
        <path d="M152 92 Q 154 74 174 70 Q 194 74 196 92 L 196 88 Q 196 68 174 64 Q 152 68 152 88 Z" fill={hair2}/>
        <ellipse cx="168" cy="94" rx="2.4" ry="2.4" fill={ink}/>
        <ellipse cx="180" cy="94" rx="2.4" ry="2.4" fill={ink}/>
        <path d="M168 104 Q 174 108 180 104" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="164" cy="100" r="2.4" fill={theme.coral} opacity={0.6}/>
        <circle cx="184" cy="100" r="2.4" fill={theme.coral} opacity={0.6}/>
      </g>
    </svg>
  )
}

// ─── PhoneMsg (para presupuestos IA · WhatsApp) ──────────────────
export const PhoneMsg: React.FC<{ size?: number }> = ({ size = 480 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 90 } })
  const scale = interpolate(enter, [0, 1], [0.7, 1])
  const opacity = interpolate(enter, [0, 1], [0, 1])

  // Cada burbuja: cycle de 0-1 con delay distinto
  const bubbleCycle = (delayFrames: number) => {
    const period = fps * 2.6
    const t = ((frame - delayFrames) % period + period) % period / period
    return t
  }
  const bubbleAnim = (t: number) => {
    const o = t < 0.2 ? t / 0.2 : t > 0.85 ? (1 - t) / 0.15 : 1
    const y = interpolate(t, [0, 0.2, 0.85, 1], [28, 0, -6, -22])
    const s = interpolate(t, [0, 0.2, 1], [0.85, 1, 1])
    return { opacity: Math.max(0, o), y, s }
  }
  const b1 = bubbleAnim(bubbleCycle(0))
  const b2 = bubbleAnim(bubbleCycle(fps * 0.8))
  const b3 = bubbleAnim(bubbleCycle(fps * 1.6))

  return (
    <svg viewBox="0 0 220 240" style={{ width: size, height: size * 240 / 220, opacity, transform: `scale(${scale})`, overflow: 'visible' }}>
      {/* Móvil */}
      <rect x="66" y="30" width="88" height="182" rx="16" fill="#16161A" stroke={white} strokeWidth="2.5"/>
      <rect x="72" y="48" width="76" height="150" rx="4" fill={white}/>
      <rect x="96" y="34" width="26" height="6" rx="3" fill={ink}/>
      <rect x="102" y="202" width="16" height="4" rx="2" fill={white}/>
      {/* Cabecera WhatsApp */}
      <rect x="72" y="48" width="76" height="20" fill={theme.sage}/>
      <circle cx="82" cy="58" r="5" fill={white}/>
      <rect x="90" y="55" width="34" height="3" rx="1.5" fill={white} opacity={0.9}/>
      <rect x="90" y="61" width="24" height="2" rx="1" fill={white} opacity={0.6}/>
      {/* Burbuja 1 (verde, cliente) */}
      <g style={{ transform: `translateY(${b1.y}px) scale(${b1.s})`, transformOrigin: '104px 171px', opacity: b1.opacity }}>
        <rect x="78" y="160" width="52" height="22" rx="11" fill={theme.sage}/>
        <path d="M84 182 L 80 190 L 90 182 Z" fill={theme.sage}/>
        <circle cx="88" cy="171" r="2.6" fill="#fff"/>
        <circle cx="100" cy="171" r="2.6" fill="#fff"/>
        <circle cx="112" cy="171" r="2.6" fill="#fff"/>
      </g>
      {/* Burbuja 2 (roja) */}
      <g style={{ transform: `translateY(${b2.y}px) scale(${b2.s})`, transformOrigin: '116px 137px', opacity: b2.opacity }}>
        <rect x="88" y="126" width="56" height="22" rx="11" fill={theme.coral}/>
        <path d="M138 148 L 142 156 L 132 148 Z" fill={theme.coral}/>
        <circle cx="98" cy="137" r="2.6" fill="#fff"/>
        <circle cx="110" cy="137" r="2.6" fill="#fff"/>
        <circle cx="122" cy="137" r="2.6" fill="#fff"/>
        <circle cx="134" cy="137" r="2.6" fill="#fff"/>
      </g>
      {/* Burbuja 3 (ambar) */}
      <g style={{ transform: `translateY(${b3.y}px) scale(${b3.s})`, transformOrigin: '99px 103px', opacity: b3.opacity }}>
        <rect x="76" y="92" width="46" height="22" rx="11" fill={theme.amber}/>
        <path d="M82 114 L 78 122 L 88 114 Z" fill={theme.amber}/>
        <circle cx="86" cy="103" r="2.6" fill="#fff"/>
        <circle cx="98" cy="103" r="2.6" fill="#fff"/>
        <circle cx="110" cy="103" r="2.6" fill="#fff"/>
      </g>
    </svg>
  )
}

// ─── Stressed (autónomo agobiado con facturas · Verifactu) ────────
export const Stressed: React.FC<{ size?: number }> = ({ size = 520 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })
  const scale = interpolate(enter, [0, 1], [0.6, 1])
  const opacity = interpolate(enter, [0, 1], [0, 1])

  const floatY = wave(frame, fps, 3, 4)
  const pap1 = wave(frame, fps, 2.8, 8)
  const pap2 = wave(frame + fps * 0.3, fps, 2.8, -8)
  const pap3 = wave(frame + fps * 0.6, fps, 2.8, 6)

  return (
    <svg viewBox="0 0 260 220" style={{ width: size, height: size * 220 / 260, opacity, transform: `scale(${scale})`, overflow: 'visible' }}>
      <ellipse cx="130" cy="204" rx="100" ry="6" fill={ink} opacity={0.3}/>
      {/* Escritorio */}
      <rect x="30" y="164" width="200" height="10" rx="2" fill="#6B4423"/>
      <rect x="34" y="174" width="6" height="24" fill="#6B4423"/>
      <rect x="220" y="174" width="6" height="24" fill="#6B4423"/>
      {/* Portátil */}
      <rect x="76" y="132" width="108" height="32" rx="3" fill="#2A2A30"/>
      <rect x="76" y="130" width="108" height="6" fill="#3A3A42"/>
      <rect x="90" y="140" width="80" height="18" rx="2" fill={theme.sage}/>
      <text x="130" y="153" textAnchor="middle" fontFamily={theme.displayFont} fontWeight={700} fontSize={12} fill="#fff">FACTURA</text>
      {/* Autónomo (flotando) */}
      <g style={{ transform: `translateY(${floatY}px)` }}>
        <circle cx="130" cy="94" r="26" fill={skin}/>
        <path d="M104 88 Q 106 68 130 64 Q 154 68 156 88 L 156 84 Q 156 60 130 56 Q 104 60 104 84 Z" fill={hair1}/>
        <path d="M112 88 l6 6 M120 92 l-6 -6" stroke={ink} strokeWidth={2.2} strokeLinecap="round"/>
        <path d="M138 88 l6 6 M144 88 l-6 6" stroke={ink} strokeWidth={2.2} strokeLinecap="round"/>
        <path d="M118 108 Q 130 100 142 108" stroke={ink} strokeWidth={2.2} fill="none" strokeLinecap="round"/>
        <circle cx="116" cy="98" r="1.8" fill={ink}/>
        <circle cx="144" cy="98" r="1.8" fill={ink}/>
        <circle cx="110" cy="104" r="3" fill={theme.coral} opacity={0.35}/>
        <circle cx="150" cy="104" r="3" fill={theme.coral} opacity={0.35}/>
        {/* Estrés lines */}
        <line x1="120" y1="52" x2="118" y2="42" stroke={theme.sage} strokeWidth="2" strokeLinecap="round"/>
        <line x1="130" y1="50" x2="130" y2="38" stroke={theme.sage} strokeWidth="2" strokeLinecap="round"/>
        <line x1="140" y1="52" x2="142" y2="42" stroke={theme.sage} strokeWidth="2" strokeLinecap="round"/>
      </g>
      {/* Papeles volando */}
      <g style={{ transform: `rotate(${pap1}deg)`, transformOrigin: '53px 95px' }}>
        <rect x="38" y="76" width="30" height="38" rx="2" fill={white} stroke="#2A2A30" strokeWidth="1.5"/>
        <line x1="44" y1="84" x2="62" y2="84" stroke="#2A2A30" strokeWidth="1.5"/>
        <line x1="44" y1="92" x2="60" y2="92" stroke="#2A2A30" strokeWidth="1.5"/>
        <line x1="44" y1="100" x2="62" y2="100" stroke={theme.coral} strokeWidth="2"/>
      </g>
      <g style={{ transform: `rotate(${pap2}deg)`, transformOrigin: '211px 85px' }}>
        <rect x="196" y="66" width="30" height="38" rx="2" fill={white} stroke="#2A2A30" strokeWidth="1.5"/>
        <line x1="202" y1="74" x2="220" y2="74" stroke="#2A2A30" strokeWidth="1.5"/>
        <line x1="202" y1="82" x2="218" y2="82" stroke="#2A2A30" strokeWidth="1.5"/>
        <text x="211" y="97" textAnchor="middle" fontFamily={theme.displayFont} fontWeight={700} fontSize={8} fill={theme.coral}>IVA</text>
      </g>
      <g style={{ transform: `rotate(${pap3}deg)`, transformOrigin: '75px 61px' }}>
        <rect x="60" y="42" width="30" height="38" rx="2" fill={white} stroke="#2A2A30" strokeWidth="1.5"/>
        <text x="75" y="65" textAnchor="middle" fontFamily={theme.displayFont} fontWeight={700} fontSize={16} fill={theme.coral}>QR</text>
      </g>
    </svg>
  )
}

// ─── StarBurst (sello · reseñas · 100%) ──────────────────────────
export const StarBurst: React.FC<{ size?: number }> = ({ size = 440 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 10, stiffness: 140 } })
  const scale = interpolate(enter, [0, 1], [0.3, 1])
  const opacity = interpolate(enter, [0, 1], [0, 1])
  const pulse = 1 + wave(frame, fps, 1.6, 0.08)
  const rays = 0.55 + Math.abs(wave(frame, fps, 1.8, 0.45))
  const sparks = (delay: number) => 0.3 + Math.abs(wave(frame + delay, fps, 1.6, 0.7))

  return (
    <svg viewBox="0 0 220 220" style={{ width: size, height: size, opacity, transform: `scale(${scale})`, overflow: 'visible' }}>
      <g style={{ opacity: rays, transformOrigin: '110px 110px' }}>
        <line x1="110" y1="14" x2="110" y2="38" stroke={theme.amber} strokeWidth="4" strokeLinecap="round"/>
        <line x1="110" y1="182" x2="110" y2="206" stroke={theme.amber} strokeWidth="4" strokeLinecap="round"/>
        <line x1="14" y1="110" x2="38" y2="110" stroke={theme.amber} strokeWidth="4" strokeLinecap="round"/>
        <line x1="182" y1="110" x2="206" y2="110" stroke={theme.amber} strokeWidth="4" strokeLinecap="round"/>
        <line x1="42" y1="42" x2="60" y2="60" stroke={theme.amber} strokeWidth="4" strokeLinecap="round"/>
        <line x1="160" y1="160" x2="178" y2="178" stroke={theme.amber} strokeWidth="4" strokeLinecap="round"/>
        <line x1="42" y1="178" x2="60" y2="160" stroke={theme.amber} strokeWidth="4" strokeLinecap="round"/>
        <line x1="160" y1="60" x2="178" y2="42" stroke={theme.amber} strokeWidth="4" strokeLinecap="round"/>
      </g>
      <path
        d="M110 48 L 128 90 L 172 92 L 138 118 L 148 160 L 110 134 L 72 160 L 82 118 L 48 92 L 92 90 Z"
        fill={theme.amber} stroke={theme.coral} strokeWidth={2.5} strokeLinejoin="round"
        style={{ transform: `scale(${pulse})`, transformOrigin: '110px 110px' }}
      />
      <path d="M110 68 L 118 88 L 138 90 L 122 102 L 128 122 L 110 110 Z" fill="#fff" opacity={0.4}/>
      <circle cx="28"  cy="60"  r="4"   fill={theme.amber} opacity={sparks(0)}/>
      <circle cx="188" cy="70"  r="5"   fill={theme.coral} opacity={sparks(fps * 0.4)}/>
      <circle cx="46"  cy="180" r="4"   fill={theme.sage}  opacity={sparks(fps * 0.8)}/>
      <circle cx="184" cy="164" r="4.5" fill={theme.amber} opacity={sparks(fps * 1.2)}/>
    </svg>
  )
}

// ─── Rings (WOW planners) ─────────────────────────────────────────
export const Rings: React.FC<{ size?: number }> = ({ size = 500 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 110 } })
  const scale = interpolate(enter, [0, 1], [0.6, 1])
  const opacity = interpolate(enter, [0, 1], [0, 1])
  const swingL = wave(frame, fps, 2.8, 4)
  const swingR = wave(frame + fps * 0.4, fps, 2.8, -4)
  const sp1 = 0.3 + Math.abs(wave(frame, fps, 1.6, 0.7))
  const sp2 = 0.3 + Math.abs(wave(frame + fps * 0.6, fps, 1.6, 0.7))

  return (
    <svg viewBox="0 0 240 180" style={{ width: size, height: size * 180 / 240, opacity, transform: `scale(${scale})`, overflow: 'visible' }}>
      <ellipse cx="120" cy="164" rx="70" ry="4" fill={ink} opacity={0.3}/>
      <g style={{ transform: `translateX(${swingL}px)`, transformOrigin: '88px 94px' }}>
        <circle cx="88" cy="94" r="44" fill="none" stroke={theme.amber} strokeWidth="10"/>
        <circle cx="88" cy="94" r="44" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="2 8" opacity={0.55}/>
        <circle cx="88" cy="50" r="8" fill={theme.coral} stroke={theme.amber} strokeWidth="1.5"/>
      </g>
      <g style={{ transform: `translateX(${swingR}px)`, transformOrigin: '142px 94px' }}>
        <circle cx="142" cy="94" r="44" fill="none" stroke={skin} strokeWidth="10"/>
        <circle cx="142" cy="94" r="44" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="2 8" opacity={0.55}/>
        <circle cx="142" cy="50" r="8" fill={theme.amber} stroke={theme.coral} strokeWidth="1.5"/>
      </g>
      <path d="M40 30 L 44 42 L 56 46 L 44 50 L 40 62 L 36 50 L 24 46 L 36 42 Z" fill={theme.amber} opacity={sp1}/>
      <path d="M198 140 L 202 152 L 214 156 L 202 160 L 198 172 L 194 160 L 182 156 L 194 152 Z" fill={theme.sage} opacity={sp2}/>
    </svg>
  )
}

// ─── Cursor (3 clicks · reservar) ─────────────────────────────────
export const Cursor: React.FC<{ size?: number }> = ({ size = 460 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 90 } })
  const scale = interpolate(enter, [0, 1], [0.7, 1])
  const opacity = interpolate(enter, [0, 1], [0, 1])

  // Cursor salta entre 3 posiciones
  const cyclePeriod = fps * 2.6
  const t = (frame % cyclePeriod) / cyclePeriod
  let cx: number, cy: number, click: number
  if (t < 0.33) {
    const local = t / 0.33
    cx = interpolate(local, [0, 0.6, 0.8, 1], [-46, -46, -40, -46])
    cy = interpolate(local, [0, 0.6, 0.8, 1], [-20, -20, -14, -20])
    click = local > 0.6 && local < 0.85 ? 1 : 0
  } else if (t < 0.66) {
    const local = (t - 0.33) / 0.33
    cx = interpolate(local, [0, 0.6, 0.8, 1], [-46, 4, 4, 4])
    cy = interpolate(local, [0, 0.6, 0.8, 1], [-20, 32, 38, 32])
    click = local > 0.6 && local < 0.85 ? 2 : 0
  } else {
    const local = (t - 0.66) / 0.33
    cx = interpolate(local, [0, 0.6, 0.8, 1], [4, 46, 46, 46])
    cy = interpolate(local, [0, 0.6, 0.8, 1], [32, -16, -10, -16])
    click = local > 0.6 && local < 0.85 ? 3 : 0
  }
  const rippleT = click > 0 ? ((frame % (fps * 0.35)) / (fps * 0.35)) : 1
  const rippleR = interpolate(rippleT, [0, 1], [6, 30])
  const rippleO = interpolate(rippleT, [0, 1], [1, 0])

  return (
    <svg viewBox="0 0 220 220" style={{ width: size, height: size, opacity, transform: `scale(${scale})`, overflow: 'visible' }}>
      {/* Ventana mock */}
      <rect x="34" y="34" width="152" height="152" rx="12" fill={white} stroke={ink} strokeWidth={2.5}/>
      <rect x="34" y="34" width="152" height="30" rx="12" fill={theme.amber}/>
      <rect x="34" y="52" width="152" height="12" fill={theme.amber}/>
      <circle cx="46" cy="49" r="3.5" fill={theme.coral}/>
      <circle cx="56" cy="49" r="3.5" fill={skin}/>
      <circle cx="66" cy="49" r="3.5" fill={theme.sage}/>
      <rect x="46" y="76" width="64" height="10" rx="2" fill={theme.coral} opacity={0.85}/>
      <rect x="46" y="92" width="100" height="6" rx="2" fill="#2A2A30" opacity={0.4}/>
      <rect x="46" y="102" width="82" height="6" rx="2" fill="#2A2A30" opacity={0.3}/>
      {/* Botón */}
      <rect x="46" y="122" width="128" height="36" rx="8" fill={theme.sage}/>
      <text x="110" y="145" textAnchor="middle" fontFamily={theme.displayFont} fontWeight={700} fontSize={15} fill="#fff">RESERVAR</text>
      {/* Ripple */}
      {click > 0 && (
        <circle cx="110" cy="140" r={rippleR} fill="none" stroke={theme.coral} strokeWidth={3} opacity={rippleO}/>
      )}
      {/* Cursor */}
      <path
        d="M110 130 L 110 172 L 122 162 L 132 184 L 138 182 L 128 160 L 142 160 Z"
        fill={white} stroke={ink} strokeWidth={2.5} strokeLinejoin="round"
        style={{ transform: `translate(${cx}px, ${cy}px)` }}
      />
    </svg>
  )
}

// ─── Checkmark (garantía · 100% · 48h) ────────────────────────────
export const Checkmark: React.FC<{ size?: number }> = ({ size = 440 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 10, stiffness: 140 } })
  const scale = interpolate(enter, [0, 1], [0, 1])
  const tickReveal = spring({ frame: frame - Math.round(fps * 0.35), fps, config: { damping: 15, stiffness: 90 } })
  const tickOffset = interpolate(tickReveal, [0, 1], [100, 0])
  const opacity = interpolate(enter, [0, 1], [0, 1])
  const sp = (delay: number) => 0.3 + Math.abs(wave(frame + delay, fps, 1.6, 0.7))

  return (
    <svg viewBox="0 0 220 220" style={{ width: size, height: size, opacity, overflow: 'visible' }}>
      <circle cx="110" cy="110" r="80" fill={theme.sage} style={{ transform: `scale(${scale})`, transformOrigin: '110px 110px' }}/>
      <circle cx="110" cy="110" r="80" fill="none" stroke={white} strokeWidth={3} opacity={0.35} style={{ transform: `scale(${scale})`, transformOrigin: '110px 110px' }}/>
      <path
        d="M 66 110 L 100 142 L 158 82"
        stroke={white} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={100} strokeDashoffset={tickOffset}
      />
      <circle cx="26"  cy="46"  r="4"   fill={theme.amber} opacity={sp(0)}/>
      <circle cx="192" cy="56"  r="4.5" fill={theme.coral} opacity={sp(fps * 0.4)}/>
      <circle cx="36"  cy="180" r="3.5" fill={theme.amber} opacity={sp(fps * 0.8)}/>
      <circle cx="188" cy="170" r="4"   fill={theme.sage}  opacity={sp(fps * 1.2)}/>
    </svg>
  )
}

// ─── Registro central de personajes ──────────────────────────────
export const CHARACTERS: Record<CharacterKey, React.FC<{ size?: number }>> = {
  couple:    Couple,
  phoneMsg:  PhoneMsg,
  stressed:  Stressed,
  starBurst: StarBurst,
  rings:     Rings,
  cursor:    Cursor,
  checkmark: Checkmark,
}
