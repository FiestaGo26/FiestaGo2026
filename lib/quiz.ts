// Perfiles del quiz. Cada combinación de "qué celebras" + "para quién"
// tiene sus propias categorías, reparto de presupuesto, valores por defecto
// y estilos. Lo usan la página /quiz y la API /api/quiz.

export type EventType =
  | 'boda' | 'cumpleanos' | 'comunion' | 'bautizo'
  | 'despedida' | 'aniversario' | 'corporativo' | 'otro'

export type Audience = 'ninos' | 'adolescentes' | 'adultos'
export type KidsAge = '1-3' | '4-6' | '7-9' | '10-12'
export type CorpKind = 'navidad' | 'team' | 'presentacion' | 'otro'

export const EVENT_OPTIONS: Array<{ id: EventType; label: string; hint: string }> = [
  { id: 'boda',        label: 'Boda',              hint: 'Ceremonia, banquete y fiesta' },
  { id: 'cumpleanos',  label: 'Cumpleaños',        hint: 'Infantil, adolescente o adulto' },
  { id: 'comunion',    label: 'Comunión',          hint: 'Comida, tarta y recuerdos' },
  { id: 'bautizo',     label: 'Bautizo',           hint: 'Celebración familiar' },
  { id: 'despedida',   label: 'Despedida',         hint: 'De soltero o soltera' },
  { id: 'aniversario', label: 'Aniversario',       hint: 'Bodas de plata, de oro…' },
  { id: 'corporativo', label: 'Evento de empresa', hint: 'Cena, team building, presentación' },
  { id: 'otro',        label: 'Otra celebración',  hint: 'Graduación, baby shower…' },
]

export const AUDIENCE_OPTIONS: Array<{ id: Audience; label: string; hint: string }> = [
  { id: 'ninos',        label: 'Niños',        hint: 'Hasta 12 años' },
  { id: 'adolescentes', label: 'Adolescentes', hint: 'De 13 a 17 años' },
  { id: 'adultos',      label: 'Adultos',      hint: '18 años o más' },
]

export const KIDS_AGE_OPTIONS: Array<{ id: KidsAge; label: string }> = [
  { id: '1-3',   label: '1 a 3 años' },
  { id: '4-6',   label: '4 a 6 años' },
  { id: '7-9',   label: '7 a 9 años' },
  { id: '10-12', label: '10 a 12 años' },
]

export const CORP_OPTIONS: Array<{ id: CorpKind; label: string; hint: string }> = [
  { id: 'navidad',      label: 'Cena de empresa', hint: 'Navidad, fin de año, aniversario' },
  { id: 'team',         label: 'Team building',   hint: 'Actividad para el equipo' },
  { id: 'presentacion', label: 'Presentación',    hint: 'Lanzamiento o evento con clientes' },
  { id: 'otro',         label: 'Otro',            hint: 'Jornada, congreso, fiesta…' },
]

export type Style = { id: string; label: string; hint: string; keywords: string[] }

const STYLES = {
  ceremonia: [
    { id: 'clasico',  label: 'Clásico',  hint: 'Elegante y tradicional', keywords: ['clásico', 'tradicional', 'elegante', 'formal'] },
    { id: 'moderno',  label: 'Moderno',  hint: 'Minimalista y urbano',   keywords: ['moderno', 'minimalista', 'contemporáneo', 'urbano'] },
    { id: 'rustico',  label: 'Rústico',  hint: 'Campo, natural, boho',   keywords: ['rústico', 'natural', 'campo', 'boho', 'masía', 'finca'] },
    { id: 'premium',  label: 'Premium',  hint: 'Alta gama, exclusivo',   keywords: ['premium', 'lujo', 'exclusivo', 'alta gama'] },
    { id: 'intimo',   label: 'Íntimo',   hint: 'Pocos invitados, cercano', keywords: ['íntimo', 'pequeño', 'familiar', 'cercano'] },
  ],
  ninos: [
    { id: 'tematico',  label: 'Temático',          hint: 'Superhéroes, princesas, piratas…', keywords: ['temática', 'temático', 'superhéroes', 'princesas', 'personajes', 'disfraces'] },
    { id: 'aventura',  label: 'Juegos y aventura', hint: 'Gymkana, hinchables, deporte',   keywords: ['gymkana', 'hinchable', 'juegos', 'aventura', 'deporte'] },
    { id: 'talleres',  label: 'Talleres',          hint: 'Manualidades, cocina, ciencia',  keywords: ['taller', 'manualidades', 'ciencia', 'cocina', 'pintacaras'] },
    { id: 'show',      label: 'Espectáculo',       hint: 'Magia, payasos, títeres',        keywords: ['magia', 'mago', 'payaso', 'títeres', 'espectáculo', 'show'] },
  ],
  fiesta: [
    { id: 'dj',        label: 'Fiesta con música', hint: 'DJ, baile hasta tarde',    keywords: ['dj', 'fiesta', 'música', 'baile', 'discoteca'] },
    { id: 'elegante',  label: 'Cena elegante',     hint: 'Restaurante o catering',   keywords: ['elegante', 'cena', 'gourmet', 'premium'] },
    { id: 'casa',      label: 'En casa',           hint: 'Íntimo y sin complicarse', keywords: ['domicilio', 'casa', 'íntimo', 'familiar'] },
    { id: 'aire',      label: 'Al aire libre',     hint: 'Terraza, jardín, playa',   keywords: ['aire libre', 'jardín', 'terraza', 'playa', 'finca'] },
  ],
  empresa: [
    { id: 'formal',    label: 'Formal',    hint: 'Clientes, protocolo',     keywords: ['corporativo', 'empresa', 'formal', 'elegante'] },
    { id: 'distendido',label: 'Distendido',hint: 'Para el equipo, sin corbata', keywords: ['divertido', 'fiesta', 'team building', 'animación'] },
    { id: 'premium',   label: 'Premium',   hint: 'Alta gama, exclusivo',    keywords: ['premium', 'lujo', 'exclusivo', 'alta gama'] },
  ],
} satisfies Record<string, Style[]>

export type Profile = {
  key: string
  /** Nombre del evento para el resumen: "cumpleaños infantil (7 a 9 años)". */
  title: string
  /** Peso relativo de cada categoría en el presupuesto, en orden de importancia. */
  shares: Record<string, number>
  guests: number
  guestPresets: number[]
  budget: { initial: number; min: number; max: number; step: number }
  styles: Style[]
  /** Palabras que suben la puntuación de un proveedor para este público. */
  keywords: string[]
}

const PROFILES: Record<string, Omit<Profile, 'key' | 'title'>> = {
  boda: {
    shares: { catering: 45, espacios: 18, foto: 9, musica: 6, flores: 7, planner: 6, belleza: 4 },
    guests: 100, guestPresets: [40, 80, 120, 200],
    budget: { initial: 15000, min: 2000, max: 60000, step: 500 },
    styles: STYLES.ceremonia, keywords: ['boda', 'bodas', 'novios'],
  },
  cumple_ninos: {
    shares: { animacion: 35, pastel: 15, catering: 25, espacios: 15, foto: 10 },
    guests: 20, guestPresets: [10, 20, 30, 50],
    budget: { initial: 500, min: 100, max: 5000, step: 50 },
    styles: STYLES.ninos, keywords: ['infantil', 'niños', 'niñas', 'peques', 'kids', 'cumpleaños'],
  },
  cumple_adolescentes: {
    shares: { musica: 30, catering: 25, espacios: 20, animacion: 10, pastel: 8, foto: 7 },
    guests: 25, guestPresets: [15, 25, 40, 60],
    budget: { initial: 800, min: 150, max: 6000, step: 50 },
    styles: STYLES.fiesta, keywords: ['adolescentes', 'jóvenes', 'juvenil', 'dj', 'cumpleaños'],
  },
  cumple_adultos: {
    shares: { catering: 40, espacios: 20, musica: 18, pastel: 7, foto: 8, animacion: 7 },
    guests: 40, guestPresets: [15, 30, 50, 100],
    budget: { initial: 2000, min: 200, max: 20000, step: 100 },
    styles: STYLES.fiesta, keywords: ['adultos', 'cumpleaños', 'fiesta', 'dj', 'cóctel'],
  },
  comunion: {
    shares: { catering: 45, espacios: 15, foto: 12, pastel: 8, animacion: 12, flores: 8 },
    guests: 40, guestPresets: [20, 40, 60, 100],
    budget: { initial: 3000, min: 300, max: 20000, step: 100 },
    styles: STYLES.ceremonia, keywords: ['comunión', 'comuniones', 'infantil', 'niños'],
  },
  bautizo: {
    shares: { catering: 50, espacios: 15, foto: 15, pastel: 10, flores: 10 },
    guests: 30, guestPresets: [15, 30, 50, 80],
    budget: { initial: 1500, min: 200, max: 10000, step: 100 },
    styles: STYLES.ceremonia, keywords: ['bautizo', 'bautizos', 'bebé', 'familiar'],
  },
  despedida: {
    shares: { animacion: 30, musica: 20, catering: 25, espacios: 15, transporte: 10 },
    guests: 15, guestPresets: [8, 15, 25, 40],
    budget: { initial: 800, min: 100, max: 8000, step: 50 },
    styles: STYLES.fiesta, keywords: ['despedida', 'soltero', 'soltera', 'fiesta'],
  },
  aniversario: {
    shares: { catering: 45, espacios: 20, musica: 12, flores: 10, foto: 13 },
    guests: 30, guestPresets: [10, 30, 60, 100],
    budget: { initial: 2500, min: 200, max: 25000, step: 100 },
    styles: STYLES.ceremonia, keywords: ['aniversario', 'bodas de oro', 'bodas de plata', 'familiar'],
  },
  corporativo: {
    shares: { catering: 40, espacios: 22, musica: 12, animacion: 10, foto: 10, transporte: 6 },
    guests: 50, guestPresets: [20, 50, 100, 200],
    budget: { initial: 5000, min: 500, max: 60000, step: 500 },
    styles: STYLES.empresa, keywords: ['empresa', 'corporativo', 'eventos de empresa'],
  },
  otro: {
    shares: { catering: 40, espacios: 20, musica: 15, animacion: 12, foto: 13 },
    guests: 30, guestPresets: [15, 30, 60, 100],
    budget: { initial: 2000, min: 200, max: 30000, step: 100 },
    styles: STYLES.fiesta, keywords: ['fiesta', 'celebración'],
  },
}

const CORP_SHARES: Record<CorpKind, Record<string, number>> = {
  navidad:      { catering: 45, espacios: 25, musica: 15, foto: 8, animacion: 7 },
  team:         { animacion: 35, catering: 25, espacios: 20, transporte: 10, foto: 10 },
  presentacion: { espacios: 30, catering: 30, foto: 15, musica: 15, flores: 10 },
  otro:         PROFILES.corporativo.shares,
}

const AGE_KEYWORDS: Record<KidsAge, string[]> = {
  '1-3':   ['bebé', 'bebés', 'primer cumpleaños', 'peques'],
  '4-6':   ['infantil', 'pintacaras', 'títeres', 'magia'],
  '7-9':   ['gymkana', 'talleres', 'juegos'],
  '10-12': ['gymkana', 'karaoke', 'dj', 'escape'],
}

/** Si el evento necesita una pregunta extra antes de los invitados. */
export const needsDetail = (e: EventType) => e === 'cumpleanos' || e === 'corporativo'

export function getProfile(e: EventType, opts: { audience?: Audience | ''; age?: KidsAge | ''; corp?: CorpKind | '' } = {}): Profile {
  if (e === 'cumpleanos') {
    const aud = opts.audience || 'adultos'
    const base = PROFILES[`cumple_${aud}`]
    const age = aud === 'ninos' && opts.age ? opts.age : ''
    return {
      ...base,
      key: `cumpleanos_${aud}${age ? `_${age}` : ''}`,
      title: aud === 'ninos' ? `cumpleaños infantil${age ? ` (${age.replace('-', ' a ')} años)` : ''}`
           : aud === 'adolescentes' ? 'cumpleaños adolescente' : 'cumpleaños de adultos',
      keywords: age ? [...base.keywords, ...AGE_KEYWORDS[age]] : base.keywords,
    }
  }
  if (e === 'corporativo') {
    const kind = opts.corp || 'otro'
    const label = CORP_OPTIONS.find(c => c.id === kind)?.label.toLowerCase() || 'evento de empresa'
    return {
      ...PROFILES.corporativo,
      shares: CORP_SHARES[kind],
      key: `corporativo_${kind}`,
      title: kind === 'otro' ? 'evento de empresa' : label,
      keywords: kind === 'team' ? [...PROFILES.corporativo.keywords, 'team building', 'actividades'] : PROFILES.corporativo.keywords,
    }
  }
  const p = PROFILES[e] || PROFILES.otro
  const title = EVENT_OPTIONS.find(o => o.id === e)?.label.toLowerCase() || 'celebración'
  return { ...p, key: e, title: e === 'otro' ? 'celebración' : title }
}

/** Reparto orientativo del presupuesto, en euros, por categoría. */
export function budgetSplit(profile: Profile, total: number): Record<string, number> {
  const sum = Object.values(profile.shares).reduce((a, b) => a + b, 0)
  return Object.fromEntries(Object.entries(profile.shares).map(([c, w]) => [c, Math.round(total * w / sum)]))
}
