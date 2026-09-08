// Guión híbrido "El Fichaje" · 27s vertical para Reels/TikTok/Shorts.
//
// POR QUÉ HÍBRIDO ──────────────────────────────────────────────────────
// Los primeros segundos deciden si te ven: ahí va vídeo IA fotorrealista.
// El dato, la comparativa y el CTA funcionan igual en motion graphics, y
// esos son gratis y re-editables (cambias un precio → re-render, 0 €).
//
// COSTE ────────────────────────────────────────────────────────────────
// Solo las tomas kind:'ai' cuestan dinero. `npm run cine:cost` te lo dice
// antes de gastar nada.

import { character, LOOK, NEGATIVE } from './characters'

export type AiShot = {
  kind: 'ai'
  id: string
  durationInSeconds: number
  /** Personaje que sale en plano (id de characters.ts). */
  characterId?: string
  /** Prompt del FOTOGRAMA inicial · lo genera Flux, es la imagen de arranque. */
  framePrompt: string
  /** Prompt del MOVIMIENTO · lo consume Kling a partir de ese fotograma. */
  motionPrompt: string
  /** Subtítulo quemado durante la toma. */
  subtitle?: string
}

export type MotionShot = {
  kind: 'motion'
  id: string
  durationInSeconds: number
  kicker: string
  sub?: string
  bgAccent?: boolean
  subtitle?: string
}

export type Shot = AiShot | MotionShot

export type Reel = {
  slug: string
  title: string
  target: 'provider' | 'client'
  /** Texto EXACTO que dirá ElevenLabs. Voz en OFF: sin lipsync, sin sobrecoste. */
  voiceover: string
  ctaUrl: string
  shots: Shot[]
}

const marcos = character('marcos')

export const REELS: Reel[] = [
  {
    slug:   'cine-01-el-fichaje',
    title:  'El Fichaje · 14 meses pagando por nada',
    target: 'provider',
    ctaUrl: 'fiestago.es/registro-proveedor',
    voiceover:
      'Llevas catorce meses pagando sesenta euros al mes. ' +
      'Por salir en un portal donde nadie te escribe. ' +
      'En Fiestago no hay cuota. Cero euros al mes. ' +
      'Y la comisión no sale de tu bolsillo: la paga el cliente. ' +
      'Tú cobras el cien por cien de tu precio. ' +
      'Date de alta gratis en fiestago punto es.',
    shots: [
      {
        kind: 'ai',
        id: '01-factura',
        durationInSeconds: 5,
        characterId: 'marcos',
        framePrompt:
          `Close medium shot of ${marcos.look}, sitting alone at a cluttered kitchen table at night, ` +
          `lit only by the cold blue glow of the phone screen he is holding, looking down at it with a ` +
          `flat exhausted expression, camera bodies and lenses scattered on the table behind him, ` +
          `dark apartment interior, ${LOOK}`,
        motionPrompt:
          'He exhales slowly and lowers the phone a few centimetres, his jaw tightening. ' +
          'Almost no camera movement, a very slow push in. Static, heavy, quiet.',
        subtitle: '14 meses pagando 60 € al mes',
      },
      {
        kind: 'ai',
        id: '02-ventana',
        durationInSeconds: 5,
        characterId: 'marcos',
        framePrompt:
          `Wide shot from behind of ${marcos.look}, standing at a dark apartment window at night, ` +
          `city lights out of focus beyond the glass, his reflection faintly visible, shoulders low, ` +
          `${LOOK}`,
        motionPrompt:
          'He stands still looking out, then tilts his head down slightly. ' +
          'Slow lateral camera drift to the right. Melancholic, unhurried.',
        subtitle: 'en un portal donde nadie te escribe',
      },
      {
        kind: 'ai',
        id: '03-decision',
        durationInSeconds: 5,
        characterId: 'marcos',
        framePrompt:
          `Tight shot of ${marcos.look}, now sitting at a desk with a laptop open, warm lamp light ` +
          `on one side of his face, he is looking at the screen with the first hint of interest, ` +
          `eyebrows lifting slightly, ${LOOK}`,
        motionPrompt:
          'He leans forward toward the laptop and a small, tired smile starts to form. ' +
          'Subtle push in on his face. The light warms as he leans in.',
        subtitle: 'Hasta que encontró otra forma',
      },
      {
        kind: 'motion',
        id: '04-cero',
        durationInSeconds: 4,
        kicker: '0 €/mes',
        sub: 'sin cuota · sin permanencia',
        bgAccent: true,
        subtitle: 'En FiestaGo no hay cuota',
      },
      {
        kind: 'motion',
        id: '05-comision',
        durationInSeconds: 4,
        kicker: 'La comisión\nla paga el cliente',
        sub: 'tú cobras el 100 % de tu precio',
        subtitle: 'La comisión no sale de tu bolsillo',
      },
      {
        kind: 'motion',
        id: '06-cta',
        durationInSeconds: 4,
        kicker: 'Date de alta\ngratis',
        sub: 'fiestago.es/registro-proveedor',
        bgAccent: true,
      },
    ],
  },
]

export function reel(slug: string): Reel {
  const r = REELS.find(x => x.slug === slug)
  if (!r) throw new Error(`Reel desconocido: "${slug}" · revisa src/cinematic/shots.ts`)
  return r
}

export function totalDuration(r: Reel): number {
  return r.shots.reduce((acc, s) => acc + s.durationInSeconds, 0)
}

export function aiShots(r: Reel): AiShot[] {
  return r.shots.filter((s): s is AiShot => s.kind === 'ai')
}

export { NEGATIVE }
