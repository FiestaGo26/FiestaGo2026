// ───────────────────────────────────────────────────────────────────────
// Tipo de local: el proveedor de espacios dice qué es y qué incluye, para
// que el cliente sepa al momento si tiene cocina, mesas o zona cubierta
// (simulación 13: "depende del local" era el primer motivo para no reservar).
// ───────────────────────────────────────────────────────────────────────

export const VENUE_TYPES = {
  solo_local:          'Solo local (sin comida)',
  local_con_catering:  'Local con catering propio',
  restaurante:         'Restaurante (salón y cocina)',
  hotel:               'Hotel (salón y cocina)',
  finca:               'Finca o masía',
} as const
export type VenueType = keyof typeof VENUE_TYPES

export const VENUE_FEATURES = {
  cocina:          'Cocina',
  mesas_sillas:    'Mesas y sillas',
  zona_cubierta:   'Zona cubierta (plan B si llueve)',
  catering_externo:'Admite catering externo',
  musica:          'Se puede poner música / DJ',
  parking:         'Parking',
  accesible:       'Accesible',
} as const
export type VenueFeatures = Partial<Record<keyof typeof VENUE_FEATURES, boolean>> & { aforo?: number }

/** Restaurante y hotel incluyen siempre cocina y mesas. */
export function cleanVenue(type: unknown, features: unknown): { venue_type: VenueType | null; venue_features: VenueFeatures } {
  const t = (Object.keys(VENUE_TYPES) as VenueType[]).includes(type as VenueType) ? type as VenueType : null
  const f: VenueFeatures = {}
  const raw = (features && typeof features === 'object' ? features : {}) as Record<string, unknown>
  for (const k of Object.keys(VENUE_FEATURES)) if (raw[k] === true) (f as any)[k] = true
  const aforo = Math.round(Number(raw.aforo) || 0)
  if (aforo > 0 && aforo < 5000) f.aforo = aforo
  if (t === 'restaurante' || t === 'hotel' || t === 'local_con_catering') { f.cocina = true; f.mesas_sillas = true }
  return { venue_type: t, venue_features: f }
}

/** "Restaurante (salón y cocina) · hasta 120 personas · cocina, mesas y sillas, zona cubierta" */
export function venueSummary(type: string | null | undefined, features: VenueFeatures | null | undefined) {
  if (!type || !(type in VENUE_TYPES)) return null
  const f = features || {}
  const list = (Object.keys(VENUE_FEATURES) as Array<keyof typeof VENUE_FEATURES>).filter(k => f[k]).map(k => VENUE_FEATURES[k].toLowerCase())
  return [VENUE_TYPES[type as VenueType], f.aforo ? `hasta ${f.aforo} personas` : null, list.length ? list.join(', ') : null].filter(Boolean).join(' · ')
}
