export const CATEGORIES = [
  { id:'foto',       icon:'📷', label:'Fotografía & Video',      color:'#C0392B', query:'fotógrafo bodas eventos',
    hashtags:['fotografobodas','weddingphotographer','fotografoevento'],
    tiktokTags:['fotografobodas','weddingphotography','bodas'] },
  { id:'catering',   icon:'🍽️', label:'Catering & Banquetes',   color:'#C8860A', query:'catering eventos bodas',
    hashtags:['cateringbodas','cateringevento','banqueteboda'],
    tiktokTags:['cateringbodas','cateringeventos'] },
  { id:'espacios',   icon:'🏛️', label:'Espacios & Fincas',      color:'#3D7A52', query:'finca salón eventos bodas',
    hashtags:['fincabodas','saloneventos','weddingvenue'],
    tiktokTags:['fincabodas','salondebodas'] },
  { id:'musica',     icon:'🎵', label:'Música & DJ',             color:'#8E44AD', query:'DJ bodas eventos música',
    hashtags:['djbodas','musicabodas','djboda'],
    tiktokTags:['djbodas','musicabodas'] },
  { id:'flores',     icon:'💐', label:'Flores & Decoración',     color:'#CB4A8A', query:'floristería decoración bodas',
    hashtags:['floristeriabodas','decoracionbodas'],
    tiktokTags:['floristeria','bodas'] },
  { id:'pastel',     icon:'🎂', label:'Tartas & Repostería',     color:'#A0522D', query:'pastelería tarta bodas',
    hashtags:['tartaboda','pastelbodas','weddingcake'],
    tiktokTags:['tartaboda','weddingcake'] },
  { id:'belleza',    icon:'💄', label:'Belleza & Estilismo',     color:'#9333EA', query:'maquillaje peluquería novias',
    hashtags:['maquillajenovia','peluqueriaboda'],
    tiktokTags:['maquillajenovia','bridalmakeup'] },
  { id:'animacion',  icon:'🎪', label:'Animación & Shows',       color:'#1A6EA8', query:'animación eventos espectáculos',
    hashtags:['animacioneventos','animacioninfantil'],
    tiktokTags:['animacion','photocall'] },
  { id:'transporte', icon:'🚗', label:'Transporte & Limusinas',  color:'#148A72', query:'limusina transporte bodas',
    hashtags:['limusinaboda','cochesboda'],
    tiktokTags:['limusinaboda','weddingcar'] },
  { id:'papeleria',  icon:'✉️', label:'Papelería & Detalles',   color:'#7D6608', query:'papelería invitaciones bodas',
    hashtags:['invitacionesboda','papeleriaboda'],
    tiktokTags:['invitacionesboda','papelerianupcial'] },
  { id:'planner',    icon:'📋', label:'Wedding & Event Planner', color:'#1F4E79', query:'wedding planner organizador bodas',
    hashtags:['weddingplanner','organizadorabodas'],
    tiktokTags:['weddingplanner','organizadorabodas'] },
  { id:'joyeria',    icon:'💍', label:'Joyería & Accesorios',   color:'#B7410E', query:'joyería alianzas anillos bodas',
    hashtags:['joyeriaboda','alianzasboda'],
    tiktokTags:['joyeriaboda','alianzas'] },
] as const

export const CITIES = [
  'Madrid','Barcelona','Valencia','Sevilla','Bilbao',
  'Málaga','Zaragoza','Murcia','Alicante','Granada',
  'Córdoba','Valladolid','Palma','Las Palmas','Santander',
] as const

export const COMMISSION_RATE = 0.08

export const PHOTO_SEEDS: Record<string, number[]> = {
  foto:      [1024,106,433,547,669,823],
  catering:  [292,431,835,102,575,312],
  espacios:  [259,461,903,531,744,118],
  musica:    [374,510,764,339,682,215],
  flores:    [145,484,830,263,599,410],
  pastel:    [365,502,717,281,634,480],
  belleza:   [177,491,818,354,623,237],
  animacion: [167,473,729,388,541,319],
  transporte:[180,536,768,412,653,284],
  papeleria: [212,498,743,367,591,445],
  planner:   [240,469,812,395,617,328],
  joyeria:   [200,514,787,342,671,453],
  party:     [1033,399,482,600,750,320],
  kids:      [217,460,822,355,630,445],
}

export function getPhoto(cat: string, idx = 0, w = 600, h = 400) {
  const seeds = PHOTO_SEEDS[cat] || PHOTO_SEEDS.planner
  const seed  = seeds[idx % seeds.length]
  return `https://picsum.photos/seed/${seed}/${w}/${h}`
}

export function getCat(id: string) {
  return CATEGORIES.find(c => c.id === id)
}

// Modelo nuevo: el cliente paga la comisión encima del precio del proveedor.
// El proveedor recibe el 100% del precio que pone (`providerBase`).
// El cliente paga `providerBase + commission` (= clientPays).
// La primera reserva del proveedor sigue siendo 0% (incentivo de entrada).
export function calcCommission(providerBase: number, totalBookings: number) {
  const isFree = totalBookings === 0
  const rate   = isFree ? 0 : COMMISSION_RATE
  const comm   = Math.round(providerBase * rate * 100) / 100
  return {
    rate,
    amount:        comm,                // lo que se queda FiestaGo
    providerEarns: providerBase,        // 100% del precio del proveedor
    clientPays:    providerBase + comm, // lo que paga el cliente
    isFree,
  }
}

// ─── Políticas de cancelación ────────────────────────────────────────────
export type CancellationPolicy = 'flexible' | 'moderate' | 'strict'

export const CANCELLATION_POLICIES: Record<CancellationPolicy, {
  label: string
  short: string
  icon: string
  rules: string[]
}> = {
  flexible: {
    label: 'Flexible',
    short: 'Reembolso completo hasta 7 días antes del evento.',
    icon:  '🟢',
    rules: [
      'Cancelación gratuita hasta 7 días antes del evento → 100% reembolso.',
      'Entre 7 días y 48 horas antes → 50% reembolso.',
      'Menos de 48 horas antes → sin reembolso.',
    ],
  },
  moderate: {
    label: 'Moderada',
    short: 'Reembolso completo hasta 14 días antes del evento.',
    icon:  '🟡',
    rules: [
      'Cancelación gratuita hasta 14 días antes del evento → 100% reembolso.',
      'Entre 14 y 7 días antes → 50% reembolso.',
      'Menos de 7 días antes → sin reembolso.',
    ],
  },
  strict: {
    label: 'Estricta',
    short: 'Reembolso parcial solo con 30+ días de antelación.',
    icon:  '🔴',
    rules: [
      'Cancelación hasta 30 días antes del evento → 50% reembolso.',
      'Menos de 30 días antes → sin reembolso.',
    ],
  },
}

// Calcula el reembolso aplicando la política. Devuelve % (0–100), importe
// y la regla concreta que ha disparado.
export function calcRefund(opts: {
  policy: CancellationPolicy | null | undefined
  eventDate: string | Date | null | undefined
  totalAmount: number
  now?: Date
}): { percent: number; amount: number; rule: string } {
  const policy = (opts.policy || 'moderate') as CancellationPolicy
  const event  = opts.eventDate ? new Date(opts.eventDate) : null
  const now    = opts.now || new Date()
  const total  = Number(opts.totalAmount) || 0

  if (!event || isNaN(event.getTime())) {
    return { percent: 0, amount: 0, rule: 'Sin fecha de evento — reembolso a evaluar por FiestaGo.' }
  }

  const msPerDay = 24 * 60 * 60 * 1000
  const daysUntil = Math.floor((event.getTime() - now.getTime()) / msPerDay)

  let percent = 0
  let rule    = ''
  if (policy === 'flexible') {
    if      (daysUntil >= 7) { percent = 100; rule = '7+ días antes (Flexible)' }
    else if (daysUntil >= 2) { percent = 50;  rule = '7-2 días antes (Flexible)' }
    else                     { percent = 0;   rule = 'Menos de 48h (Flexible)' }
  } else if (policy === 'moderate') {
    if      (daysUntil >= 14) { percent = 100; rule = '14+ días antes (Moderada)' }
    else if (daysUntil >= 7)  { percent = 50;  rule = '14-7 días antes (Moderada)' }
    else                      { percent = 0;   rule = 'Menos de 7 días (Moderada)' }
  } else if (policy === 'strict') {
    if (daysUntil >= 30) { percent = 50; rule = '30+ días antes (Estricta)' }
    else                 { percent = 0;  rule = 'Menos de 30 días (Estricta)' }
  }

  const amount = Math.round(total * percent) / 100
  return { percent, amount, rule }
}
