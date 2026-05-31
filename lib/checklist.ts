// Plantillas de checklist por tipo de evento.
// Cada item tiene: key (id estable), label, category (link al
// marketplace si aplica), monthsBefore (cuánto antes del evento
// debería estar hecho). En la UI agrupamos por "ventana de tiempo".

export type ChecklistItem = {
  key:          string
  label:        string
  description?: string
  category?:    string         // id de categoría del marketplace para deep-link
  monthsBefore: number         // 12 = un año antes; 0 = la última semana
}

const BODA: ChecklistItem[] = [
  { key:'boda-presupuesto',  label:'Definir presupuesto total',                 monthsBefore: 12, description:'Ponedlo por escrito antes de mirar precios — evita sustos.' },
  { key:'boda-invitados',    label:'Lista preliminar de invitados',             monthsBefore: 12 },
  { key:'boda-fecha',        label:'Elegir fecha y temporada',                  monthsBefore: 12 },
  { key:'boda-espacio',      label:'Reservar el espacio/finca',                 monthsBefore: 10, category:'espacios' },
  { key:'boda-planner',      label:'Contratar wedding planner (opcional)',      monthsBefore: 10, category:'planner' },
  { key:'boda-foto',         label:'Reservar fotógrafo + video',                monthsBefore: 9,  category:'foto' },
  { key:'boda-catering',     label:'Reservar catering',                         monthsBefore: 8,  category:'catering' },
  { key:'boda-musica',       label:'Reservar DJ o banda',                       monthsBefore: 8,  category:'musica' },
  { key:'boda-decoracion',   label:'Decoración y flores',                       monthsBefore: 6,  category:'flores' },
  { key:'boda-vestido',      label:'Comprar vestido / traje',                   monthsBefore: 6 },
  { key:'boda-invitaciones', label:'Diseñar y enviar invitaciones',             monthsBefore: 5,  category:'papeleria' },
  { key:'boda-tarta',        label:'Pastel y repostería',                       monthsBefore: 4,  category:'pastel' },
  { key:'boda-alianzas',     label:'Alianzas / joyería',                        monthsBefore: 4,  category:'joyeria' },
  { key:'boda-belleza',      label:'Maquillaje y peluquería',                   monthsBefore: 3,  category:'belleza' },
  { key:'boda-transporte',   label:'Transporte de novios / invitados',          monthsBefore: 3,  category:'transporte' },
  { key:'boda-pruebas-menu', label:'Prueba de menú con el catering',            monthsBefore: 2 },
  { key:'boda-rsvp',         label:'Confirmar RSVP de todos los invitados',     monthsBefore: 1 },
  { key:'boda-seating',      label:'Cerrar plano de mesas',                     monthsBefore: 1 },
  { key:'boda-timing',       label:'Definir timing del día',                    monthsBefore: 1 },
  { key:'boda-emergencias',  label:'Plan B de mal tiempo (si aplica)',          monthsBefore: 1 },
  { key:'boda-recogida-vestido', label:'Recoger vestido / traje',               monthsBefore: 0 },
  { key:'boda-disfrutar',    label:'Disfrutar del gran día 💍',                 monthsBefore: 0 },
]

const CUMPLEANOS: ChecklistItem[] = [
  { key:'cumple-presupuesto',  label:'Definir presupuesto',                     monthsBefore: 3 },
  { key:'cumple-tematica',     label:'Elegir temática y vibe',                  monthsBefore: 3 },
  { key:'cumple-invitados',    label:'Lista de invitados',                      monthsBefore: 3 },
  { key:'cumple-espacio',      label:'Reservar lugar',                          monthsBefore: 2, category:'espacios' },
  { key:'cumple-animacion',    label:'Animación / shows',                       monthsBefore: 2, category:'animacion' },
  { key:'cumple-foto',         label:'Fotógrafo del evento',                    monthsBefore: 2, category:'foto' },
  { key:'cumple-catering',     label:'Catering / comida',                       monthsBefore: 1, category:'catering' },
  { key:'cumple-tarta',        label:'Tarta y repostería',                      monthsBefore: 1, category:'pastel' },
  { key:'cumple-musica',       label:'Música / DJ',                             monthsBefore: 1, category:'musica' },
  { key:'cumple-decoracion',   label:'Decoración del espacio',                  monthsBefore: 1, category:'flores' },
  { key:'cumple-invitaciones', label:'Enviar invitaciones',                     monthsBefore: 1, category:'papeleria' },
  { key:'cumple-confirmar',    label:'Confirmar asistencias',                   monthsBefore: 0 },
  { key:'cumple-disfrutar',    label:'Disfrutar 🎂',                            monthsBefore: 0 },
]

const COMUNION: ChecklistItem[] = [
  { key:'comu-presupuesto', label:'Definir presupuesto',                        monthsBefore: 6 },
  { key:'comu-espacio',     label:'Reservar restaurante/salón',                 monthsBefore: 6, category:'espacios' },
  { key:'comu-foto',        label:'Reservar fotógrafo',                         monthsBefore: 5, category:'foto' },
  { key:'comu-vestido',     label:'Vestido / traje del niño',                   monthsBefore: 4 },
  { key:'comu-decoracion',  label:'Decoración y flores',                        monthsBefore: 3, category:'flores' },
  { key:'comu-invitaciones',label:'Diseñar invitaciones',                       monthsBefore: 3, category:'papeleria' },
  { key:'comu-tarta',       label:'Tarta de comunión',                          monthsBefore: 2, category:'pastel' },
  { key:'comu-animacion',   label:'Animación para los niños',                   monthsBefore: 2, category:'animacion' },
  { key:'comu-recordatorios',label:'Recordatorios para invitados',              monthsBefore: 1 },
  { key:'comu-confirmar',   label:'Confirmar asistencias',                      monthsBefore: 1 },
  { key:'comu-disfrutar',   label:'Disfrutar ✨',                               monthsBefore: 0 },
]

const CORPORATIVO: ChecklistItem[] = [
  { key:'corp-objetivo',    label:'Definir objetivo del evento',                monthsBefore: 4 },
  { key:'corp-presupuesto', label:'Presupuesto + aprobaciones internas',        monthsBefore: 4 },
  { key:'corp-asistentes',  label:'Lista de asistentes',                        monthsBefore: 3 },
  { key:'corp-espacio',     label:'Reservar venue',                             monthsBefore: 3, category:'espacios' },
  { key:'corp-catering',    label:'Catering corporativo',                       monthsBefore: 2, category:'catering' },
  { key:'corp-av',          label:'Sonido + AV',                                monthsBefore: 2, category:'musica' },
  { key:'corp-animacion',   label:'Speaker o shows',                            monthsBefore: 2, category:'animacion' },
  { key:'corp-invitaciones',label:'Invitaciones digitales',                     monthsBefore: 1 },
  { key:'corp-rsvp',        label:'Cierre RSVP + materiales impresos',          monthsBefore: 1 },
  { key:'corp-timing',      label:'Run-of-show del evento',                     monthsBefore: 0 },
  { key:'corp-postevent',   label:'Plan de seguimiento post-evento',            monthsBefore: 0 },
]

const OTRO: ChecklistItem[] = [
  { key:'otro-presupuesto', label:'Definir presupuesto',                        monthsBefore: 3 },
  { key:'otro-espacio',     label:'Reservar el sitio',                          monthsBefore: 2, category:'espacios' },
  { key:'otro-catering',    label:'Comida + bebida',                            monthsBefore: 2, category:'catering' },
  { key:'otro-musica',      label:'Música / animación',                         monthsBefore: 1, category:'musica' },
  { key:'otro-decoracion',  label:'Decoración',                                 monthsBefore: 1, category:'flores' },
  { key:'otro-disfrutar',   label:'Disfrutar 🎉',                               monthsBefore: 0 },
]

export const CHECKLIST_BY_EVENT: Record<string, ChecklistItem[]> = {
  boda:        BODA,
  cumpleanos:  CUMPLEANOS,
  comunion:    COMUNION,
  corporativo: CORPORATIVO,
  otro:        OTRO,
}

export function getChecklist(eventType: string): ChecklistItem[] {
  return CHECKLIST_BY_EVENT[eventType] || OTRO
}

// Agrupar items por "ventana" según meses restantes hasta el evento.
export type ChecklistBucket = {
  key:    string
  label:  string
  items:  ChecklistItem[]
  status: 'past' | 'now' | 'future'   // según el monthsTo del evento
}

export function bucketize(items: ChecklistItem[], monthsToEvent: number): ChecklistBucket[] {
  const buckets = [
    { key:'12m', label:'12+ meses antes', from: 12, to: Infinity },
    { key:'9m',  label:'9-11 meses antes', from: 9,  to: 12 },
    { key:'6m',  label:'6-8 meses antes',  from: 6,  to: 9 },
    { key:'3m',  label:'3-5 meses antes',  from: 3,  to: 6 },
    { key:'1m',  label:'1-2 meses antes',  from: 1,  to: 3 },
    { key:'0m',  label:'Última semana / el día', from: 0, to: 1 },
  ]

  return buckets.map(b => {
    const inBucket = items.filter(i => i.monthsBefore >= b.from && i.monthsBefore < b.to)
    let status: 'past' | 'now' | 'future' = 'future'
    // monthsToEvent baja con el tiempo (3 = quedan 3 meses).
    // un bucket "to" es el techo de meses-antes.
    if (monthsToEvent < b.from)      status = 'past'   // ya debería estar
    else if (monthsToEvent <  b.to)  status = 'now'    // toca AHORA
    return { ...b, items: inBucket, status }
  }).filter(b => b.items.length > 0)
}
