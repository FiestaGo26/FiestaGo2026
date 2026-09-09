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
  /**
   * Prompt del FOTOGRAMA inicial · lo genera Flux.
   * Opcional: si la toma trae `imageUrl`, no se genera nada y no se paga imagen.
   */
  framePrompt?: string
  /**
   * Imagen pública ya existente de la que partir — p.ej. una que haya
   * generado el agente de marketing del panel y esté en el bucket
   * `social-posts`. Se salta el paso de Flux: solo se paga el vídeo.
   */
  imageUrl?: string
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
const nuria  = character('nuria')

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
  {
    slug:   'cine-02-ideas-magicas',
    title:  'Ideas MÁGICAS para su cumple · cliente',
    target: 'client',
    ctaUrl: 'fiestago.es',
    voiceover:
      'Quedan dos semanas para su cumple y no tienes nada cerrado. ' +
      'Llamas al animador: no contesta. ' +
      'Pides precio a tres pastelerías y te responden dos, la semana que viene. ' +
      'En Fiestago lo tienes todo en un sitio, con el precio delante. ' +
      'Animación, tarta, fotógrafo. Y reservas en cinco minutos. ' +
      'Ideas mágicas para su cumple, en fiestago punto es.',
    shots: [
      {
        kind: 'ai',
        id: '01-agenda',
        durationInSeconds: 5,
        characterId: 'nuria',
        framePrompt:
          `Medium shot of ${nuria.look}, sitting at a kitchen table covered with a half-written ` +
          `party checklist, coloured balloons still in their packet, and a cold cup of coffee, ` +
          `holding her phone to her ear with her shoulder while rubbing her forehead, ` +
          `late afternoon light through a window, ${LOOK}`,
        motionPrompt:
          'She lowers the phone from her ear and stares at it, then closes her eyes briefly. ' +
          'Very slight handheld camera movement. Domestic, warm, a little defeated.',
        subtitle: 'Dos semanas para su cumple',
      },
      {
        kind: 'ai',
        id: '02-sin-respuesta',
        durationInSeconds: 5,
        characterId: 'nuria',
        framePrompt:
          `Close over-the-shoulder shot of ${nuria.look}, scrolling on her phone at the same ` +
          `kitchen table, her face lit by the screen, brow furrowed with mild frustration, ` +
          `the balloons and checklist blurred in the foreground, ${LOOK}`,
        motionPrompt:
          'Her thumb scrolls twice and stops. She exhales and looks away from the screen. ' +
          'Slow push in over her shoulder.',
        subtitle: 'y nadie te contesta el presupuesto',
      },
      {
        kind: 'ai',
        id: '03-resuelto',
        durationInSeconds: 5,
        characterId: 'nuria',
        framePrompt:
          `Medium shot of ${nuria.look}, now relaxed at the same table with a laptop open in ` +
          `front of her, a six-year-old girl leaning against her arm pointing at the screen, ` +
          `both of them smiling, the balloons now inflated and bright behind them, ` +
          `warm golden light, ${LOOK}`,
        motionPrompt:
          'The girl points at the screen and looks up at her mother, who laughs quietly. ' +
          'Gentle push in. Warm, resolved, unforced.',
        subtitle: 'Todo en un sitio, con precios',
      },
      {
        // Imagen ya generada por el agente de marketing del panel
        // (social_posts · 91c6c721, hook "Ideas MÁGICAS para su cumple").
        // Ya está pagada y aprobada: aquí solo se paga el movimiento.
        kind: 'ai',
        id: '04-fiesta',
        durationInSeconds: 5,
        imageUrl:
          'https://borcqxgnmwtztuvdgzjx.supabase.co/storage/v1/object/public/' +
          'social-posts/custom/1788725881019-inspiration.jpg',
        motionPrompt:
          'The balloons sway gently, the children move and laugh, the entertainer turns ' +
          'towards them. Slow steady push in. Warm, alive, documentary feel.',
        subtitle: 'Animación, tarta, fotógrafo',
      },
      {
        kind: 'motion',
        id: '05-rapido',
        durationInSeconds: 4,
        kicker: 'Reservas en\n5 minutos',
        sub: 'sin llamar a diez sitios',
        bgAccent: true,
        subtitle: 'Y reservas en cinco minutos',
      },
      {
        kind: 'motion',
        id: '06-cta',
        durationInSeconds: 4,
        kicker: 'Ideas MÁGICAS\npara su cumple 🎈',
        sub: 'fiestago.es',
        subtitle: undefined,
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
