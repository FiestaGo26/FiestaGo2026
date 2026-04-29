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

export function calcCommission(amount: number, totalBookings: number) {
  const isFree = totalBookings === 0
  const rate   = isFree ? 0 : COMMISSION_RATE
  const comm   = Math.round(amount * rate * 100) / 100
  return { rate, amount: comm, providerEarns: amount - comm, isFree }
}
