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
  /**
   * Frase que dice el personaje EN PLANO. Dispara la cadena de lipsync:
   * Kling genera el clip mudo → ElevenLabs pone la voz → sync-lipsync cuadra
   * la boca. El audio queda incrustado en el MP4 resultante.
   *
   * Una frase corta por toma: al modelo se le va el labio en frases largas,
   * y nunca dos personajes hablando a la vez.
   */
  dialogue?: {
    characterId: string
    line:        string
  }
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
  /**
   * 'voiceover' → un narrador sobre todo el reel (barato, sin lipsync).
   * 'dialogue'  → los personajes hablan en plano; cada toma lleva su audio
   *               incrustado y no hay pista global.
   */
  voiceMode?: 'voiceover' | 'dialogue'
  /** Texto EXACTO del narrador. Solo se usa en voiceMode 'voiceover'. */
  voiceover: string
  ctaUrl: string
  shots: Shot[]
}

const marcos = character('marcos')
const nuria  = character('nuria')
const elena  = character('elena')

/** Encuadre + look, con el bloque del personaje incrustado literal. */
const shot = (framing: string, c: typeof marcos, scene: string) =>
  `${framing} of ${c.look}, ${scene}, ${LOOK}`

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
  {
    slug:      'cine-03-el-fichaje-largo',
    title:     'El Fichaje · versión larga con diálogo',
    target:    'provider',
    voiceMode: 'dialogue',
    ctaUrl:    'fiestago.es/registro-proveedor',
    voiceover: '',   // sin narrador: hablan los personajes
    shots: [
      {
        kind: 'ai', id: '01-factura', durationInSeconds: 5, characterId: 'marcos',
        framePrompt: shot('Close medium shot', marcos,
          'sitting alone at a kitchen table at night lit by his phone screen, ' +
          'camera gear scattered behind him, speaking quietly to himself'),
        motionPrompt: 'He speaks a short line without looking up. Almost no camera movement.',
        dialogue: { characterId: 'marcos', line: 'Catorce meses pagando.' },
        subtitle: 'Catorce meses pagando.',
      },
      {
        kind: 'ai', id: '02-ni-una', durationInSeconds: 5, characterId: 'marcos',
        framePrompt: shot('Tight close-up', marcos,
          'at the same table, looking straight ahead past the camera, jaw tight'),
        motionPrompt: 'He says a short line and exhales. Very slow push in.',
        dialogue: { characterId: 'marcos', line: 'Y ni una boda.' },
        subtitle: 'Y ni una boda.',
      },
      {
        kind: 'ai', id: '03-cierra', durationInSeconds: 5, characterId: 'marcos',
        framePrompt: shot('Wide shot', marcos,
          'closing a laptop in a dark apartment, standing up slowly'),
        motionPrompt: 'He closes the laptop and stands. Slow lateral drift. No speech.',
        subtitle: undefined,
      },
      {
        kind: 'ai', id: '04-elena', durationInSeconds: 5, characterId: 'elena',
        framePrompt: shot('Medium shot', elena,
          'sitting down opposite someone at a sunlit café table, calm and direct, ' +
          'speaking to the person across from her'),
        motionPrompt: 'She sits, meets his eyes and says a short line. Slight handheld feel.',
        dialogue: { characterId: 'elena', line: '¿Marcos? Te he visto trabajar.' },
        subtitle: '¿Marcos? Te he visto trabajar.',
      },
      {
        kind: 'ai', id: '05-perdona', durationInSeconds: 5, characterId: 'marcos',
        framePrompt: shot('Reverse medium shot', marcos,
          'sitting at the same sunlit café table, coffee in front of him, caught off guard'),
        motionPrompt: 'He looks up, surprised, and says a short line. Static camera.',
        dialogue: { characterId: 'marcos', line: '¿Perdona?' },
        subtitle: '¿Perdona?',
      },
      {
        kind: 'ai', id: '06-sin-cuota', durationInSeconds: 5, characterId: 'elena',
        framePrompt: shot('Medium close shot', elena,
          'at the café table sliding a small plain card across the surface, ' +
          'looking up as she speaks'),
        motionPrompt: 'She slides the card forward and says a short line. Slow push in.',
        dialogue: { characterId: 'elena', line: 'FiestaGo. Sin cuota.' },
        subtitle: 'FiestaGo. Sin cuota.',
      },
      {
        kind: 'ai', id: '07-y-que', durationInSeconds: 5, characterId: 'marcos',
        framePrompt: shot('Close shot', marcos,
          'leaning back in the café chair, arms crossed, openly sceptical'),
        motionPrompt: 'He tilts his head and says a short sceptical line. Static camera.',
        dialogue: { characterId: 'marcos', line: 'Ya. ¿Y qué me cobráis?' },
        subtitle: 'Ya. ¿Y qué me cobráis?',
      },
      {
        kind: 'ai', id: '08-nada', durationInSeconds: 5, characterId: 'elena',
        framePrompt: shot('Close shot', elena,
          'at the café table, holding his gaze, completely matter-of-fact'),
        motionPrompt: 'She answers with one short calm line, no gesture. Static camera.',
        dialogue: { characterId: 'elena', line: 'A ti nada. Paga el cliente.' },
        subtitle: 'A ti nada. Paga el cliente.',
      },
      {
        kind: 'motion', id: '09-cero', durationInSeconds: 4,
        kicker: '0 €/mes', sub: 'sin cuota · sin permanencia', bgAccent: true,
      },
      {
        kind: 'ai', id: '10-trabajando', durationInSeconds: 5, characterId: 'marcos',
        framePrompt: shot('Wide shot', marcos,
          'photographing a wedding couple outdoors at golden hour, camera raised, ' +
          'absorbed in the work'),
        motionPrompt: 'He raises the camera and shoots, stepping sideways. No speech. Warm, alive.',
        subtitle: undefined,
      },
      {
        kind: 'ai', id: '11-tres', durationInSeconds: 5, characterId: 'marcos',
        framePrompt: shot('Medium close shot', marcos,
          'outdoors between shots, looking at his phone with quiet disbelief, ' +
          'starting to smile'),
        motionPrompt: 'He glances at the phone and says a short line, half a laugh. Slow push in.',
        dialogue: { characterId: 'marcos', line: 'Tres consultas esta semana.' },
        subtitle: 'Tres consultas esta semana.',
      },
      {
        kind: 'motion', id: '12-cien', durationInSeconds: 4,
        kicker: 'Tú cobras\nel 100 %', sub: 'de tu precio, siempre',
      },
      {
        kind: 'ai', id: '13-siguiente', durationInSeconds: 5, characterId: 'elena',
        framePrompt: shot('Medium shot', elena,
          'at a plain desk with a phone to her ear, a list in front of her, ' +
          'already working on the next one'),
        motionPrompt: 'She lifts the phone and starts a short line. Slight push in. Ends the story.',
        dialogue: { characterId: 'elena', line: '¿Hablo con el catering?' },
        subtitle: '¿Hablo con el catering?',
      },
      {
        kind: 'motion', id: '14-cta', durationInSeconds: 4,
        kicker: 'Date de alta\ngratis', sub: 'fiestago.es/registro-proveedor', bgAccent: true,
      },
    ],
  },
]

/** Tomas que hablan en plano · son las que pasan por lipsync. */
export function dialogueShots(r: Reel): AiShot[] {
  return aiShots(r).filter(s => !!s.dialogue)
}

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
