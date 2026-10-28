// ───────────────────────────────────────────────────────────────────────
// Agente de captación (28-10-2026): prepara cada día a quién tiene que
// llamar o visitar Mariano, con el guion, el WhatsApp ya escrito y el
// seguimiento de cada contacto. No llama ni escribe solo: el contacto en
// frío por email o Instagram casi no convertía (~1.150 contactados, 9 altas)
// y una llamada o visita de Mariano convierte mucho más.
//
// Prioridad: locales > catering > peluquería y belleza > el resto, y
// Asturias primero (Mariano puede ir en persona). Se trabaja en el panel
// (pestaña Captación) y cada mañana le llega el plan del día por email.
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'
import { normalizePhone, isMobilePhoneES } from '@/lib/whatsapp'

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')
const SIGNUP = () => `${APP_URL()}/registro-proveedor`

export const ASTURIAS = /oviedo|gij[oó]n|xix[oó]n|avil[eé]s|siero|pola de|llanes|villaviciosa|mieres|langreo|cangas|ribadesella|castrill[oó]n|llanera|asturias|noreña|grado|navia|lugones|piedras blancas|candás|luanco|carreño|gozón|valdés|luarca|tineo|laviana|aller|lena|nava|parres|piloña|colunga|cabrales/i
export const zoneOf = (city: string | null | undefined) => ASTURIAS.test(city || '') ? 'asturias' : 'valencia'

const CATEGORY_WEIGHT: Record<string, number> = {
  espacios: 100, catering: 70, belleza: 60, animacion: 40, pastel: 40,
  foto: 30, musica: 30, flores: 25, planner: 20, transporte: 10, papeleria: 5, joyeria: 5,
}

export const OUTCOMES = {
  no_contesta:  'No contesta',
  llamar_luego: 'Llamar más tarde',
  visita:       'Visita acordada',
  interesado:   'Interesado: le paso el enlace',
  alta:         'Se ha dado de alta',
  no_interesa:  'No le interesa',
} as const
export type Outcome = keyof typeof OUTCOMES

const CLOSED = ['alta', 'no_interesa']

export type CallItem = {
  id: string; kind: 'provider' | 'org'; name: string; category: string | null; city: string | null; zone: string
  phone: string | null; mobile: boolean; email: string | null; website: string | null; instagram: string | null
  call_status: string; next_call_at: string | null; last_note: string | null; attempts: number; priority: number
  whatsapp_url: string | null; tel_url: string | null; script: string
}

/** Siguiente día laborable a las 10:00 de Madrid (aprox.: 08:00 UTC en invierno). */
function nextWorkday(days = 1) {
  const d = new Date(Date.now() + days * 86400_000)
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(8, 0, 0, 0)
  return d.toISOString()
}

function waLink(phone: string | null, text: string) {
  const n = normalizePhone(phone)
  return n && isMobilePhoneES(phone) ? `https://wa.me/${n.replace(/^\+/, '')}?text=${encodeURIComponent(text)}` : null
}

/** WhatsApp para alguien con quien todavía no has hablado (solo si tiene móvil). */
export function firstWhatsApp(name: string, category: string | null, city: string | null) {
  const what = category === 'espacios' ? 'vuestro local' : category === 'catering' ? 'vuestro catering' : 'vuestro trabajo'
  return `Hola, ${name} 👋 Soy Mariano, de FiestaGo. Estamos abriendo en ${city || 'tu zona'} una web donde la gente monta su celebración entera (comuniones, bodas, cumpleaños) y ve el precio total al momento. Me encantaría que ${what} estuviera entre los primeros: es gratis, sin cuota ni permanencia, y cobráis el 100 % de vuestro precio. ¿Te puedo llamar 2 minutos y te lo cuento?`
}

/** WhatsApp después de hablar por teléfono o en persona, con el enlace de alta. */
export function afterCallWhatsApp(name: string, category: string | null) {
  const extra = category === 'espacios' ? ' En tu panel, en «Tu local», pones el tipo de local, el aforo y si tenéis cocina, mesas y zona cubierta.' : ''
  return `Hola, ${name}, soy Mariano de FiestaGo. Como hemos hablado, aquí tienes el enlace para darte de alta (10 minutos): ${SIGNUP()}${extra} Si quieres, lo rellenamos juntos por teléfono. ¡Gracias!`
}

/** Guion corto según la categoría (el completo está en docs/CAPTACION.md). */
export function scriptFor(category: string | null, kind: 'provider' | 'org') {
  if (kind === 'org') return 'Pide hablar con la gerencia o el presidente. Propón: alta gratis para sus socios (sin cuota, cobran el 100 %) y presentar FiestaGo 10 minutos en una reunión o jornada suya.'
  const hook = category === 'espacios'
    ? 'La gente monta su celebración entera alrededor del local: es lo primero que eligen, por eso quiero que estéis entre los primeros.'
    : category === 'catering'
      ? 'Cuando el local no tiene cocina o admite catering de fuera, el cliente añade el catering en la misma celebración y ve el total.'
      : category === 'belleza'
        ? 'En bodas y comuniones el cliente añade la peluquería y el maquillaje a su celebración y lo reserva todo junto.'
        : 'El cliente añade tu servicio a su celebración y ve el precio total al momento.'
  return `Soy Mariano, de FiestaGo. ${hook} Gratis, sin cuota ni permanencia, cobráis el 100 % de vuestro precio (la comisión la paga el cliente) y la señal queda retenida hasta el evento. ¿Te doy de alta ahora en 10 minutos o te paso el enlace?`
}

function priority(p: { category: string | null; city: string | null; phone: string | null; call_status: string }) {
  return (CATEGORY_WEIGHT[p.category || ''] || 10)
    + (zoneOf(p.city) === 'asturias' ? 30 : 0)
    + (p.phone ? 10 : 0)
    + (['interesado', 'visita', 'llamar_luego'].includes(p.call_status) ? 50 : 0)   // seguimientos primero
}

/** Lista de hoy: lo que toca llamar (sin fecha o con la fecha ya cumplida), por prioridad. */
export async function callList(supabase: SupabaseClient, opts: { zone?: 'asturias' | 'valencia' | 'all'; limit?: number } = {}) {
  const now = new Date().toISOString()
  const { data: provs } = await supabase.from('providers')
    .select('id, name, category, city, phone, email, website, instagram, call_status, next_call_at, call_log')
    .eq('status', 'pending').not('call_status', 'in', `(${CLOSED.join(',')})`)
    .or(`next_call_at.is.null,next_call_at.lte.${now}`)
    .limit(3000)
  const { data: orgs } = await supabase.from('outreach_orgs')
    .select('id, name, zone, kind, for_categories, contact, call_status, next_call_at, call_log, notes')
    .not('call_status', 'in', `(${CLOSED.join(',')})`)
    .or(`next_call_at.is.null,next_call_at.lte.${now}`)

  const items: CallItem[] = [
    ...(orgs || []).map((o: any): CallItem => ({
      id: o.id, kind: 'org', name: o.name, category: (o.for_categories || []).join(', ') || null, city: o.zone === 'asturias' ? 'Asturias' : 'Valencia', zone: o.zone,
      phone: null, mobile: false, email: null, website: null, instagram: null,
      call_status: o.call_status, next_call_at: o.next_call_at, last_note: lastNote(o.call_log) || o.notes || null, attempts: (o.call_log || []).length,
      priority: 140 + (o.zone === 'asturias' ? 30 : 0), whatsapp_url: null, tel_url: null, script: scriptFor(null, 'org'),
    })),
    ...(provs || []).filter((p: any) => p.phone || p.email || p.website).map((p: any): CallItem => ({
      id: p.id, kind: 'provider', name: p.name, category: p.category, city: p.city, zone: zoneOf(p.city),
      phone: p.phone, mobile: isMobilePhoneES(p.phone), email: p.email, website: p.website, instagram: p.instagram,
      call_status: p.call_status, next_call_at: p.next_call_at, last_note: lastNote(p.call_log), attempts: (p.call_log || []).length,
      priority: priority(p),
      whatsapp_url: waLink(p.phone, ['interesado', 'visita'].includes(p.call_status) ? afterCallWhatsApp(p.name, p.category) : firstWhatsApp(p.name, p.category, p.city)),
      tel_url: normalizePhone(p.phone) ? `tel:${normalizePhone(p.phone)}` : null,
      script: scriptFor(p.category, 'provider'),
    })),
  ].filter(i => !opts.zone || opts.zone === 'all' || i.zone === opts.zone)
  items.sort((a, b) => b.priority - a.priority || a.attempts - b.attempts)
  return items.slice(0, opts.limit ?? 60)
}

function lastNote(log: any) {
  const l = Array.isArray(log) ? log[log.length - 1] : null
  return l ? `${OUTCOMES[l.outcome as Outcome] || l.outcome}${l.note ? `: ${l.note}` : ''} (${new Date(l.at).toLocaleDateString('es-ES')})` : null
}

/** Apunta el resultado de una llamada o visita y programa el siguiente paso. */
export async function recordOutcome(supabase: SupabaseClient, input: { kind: 'provider' | 'org'; id: string; outcome: Outcome; note?: string; next_at?: string | null }) {
  if (!(input.outcome in OUTCOMES)) throw new Error('Resultado no válido')
  const table = input.kind === 'org' ? 'outreach_orgs' : 'providers'
  const { data: row } = await supabase.from(table).select(input.kind === 'org' ? 'id, name, call_log' : 'id, name, category, phone, call_log').eq('id', input.id).maybeSingle()
  if (!row) throw new Error('No encontrado')
  const r: any = row
  const attempts = (r.call_log || []).length
  const next = input.next_at ? new Date(input.next_at).toISOString()
    : input.outcome === 'no_contesta' ? nextWorkday(attempts >= 2 ? 3 : 1)   // a la 3.ª vez, espaciar
    : input.outcome === 'llamar_luego' ? nextWorkday(3)
    : input.outcome === 'interesado' ? nextWorkday(2)                          // comprobar si se ha dado de alta
    : input.outcome === 'visita' ? nextWorkday(1)
    : null
  const status = input.outcome === 'no_contesta' && attempts >= 4 ? 'no_interesa' : input.outcome
  const log = [...(r.call_log || []), { at: new Date().toISOString(), outcome: input.outcome, note: (input.note || '').slice(0, 500) || undefined }]
  await supabase.from(table).update({
    call_status: status, next_call_at: CLOSED.includes(status) ? null : next, call_log: log,
    ...(input.kind === 'provider' ? { contacted_via: 'telefono', tag: OUTCOMES[input.outcome] } : {}),
  }).eq('id', input.id)
  return {
    call_status: status, next_call_at: next,
    // Tras "interesado", el WhatsApp con el enlace de alta listo para enviar
    whatsapp_url: input.kind === 'provider' && input.outcome === 'interesado' ? waLink(r.phone, afterCallWhatsApp(r.name, r.category)) : null,
  }
}

/** Email de cada mañana a Mariano con las llamadas y visitas del día. */
export async function sendDailyPlan(supabase: SupabaseClient) {
  const items = await callList(supabase, { zone: 'all', limit: 25 })
  if (!items.length) return 0
  const line = (i: CallItem) => `· ${i.name} (${i.category || i.kind}, ${i.city || ''})${i.phone ? ` · ${i.phone}` : ''}${i.last_note ? ` · último: ${i.last_note}` : ''}`
  const ast = items.filter(i => i.zone === 'asturias'), vlc = items.filter(i => i.zone !== 'asturias')
  const text = `Buenos días, Mariano.\n\nHoy toca llamar o visitar a ${items.length}:\n\n` +
    (ast.length ? `ASTURIAS (para ir en persona o llamar)\n${ast.map(line).join('\n')}\n\n` : '') +
    (vlc.length ? `VALENCIA (por teléfono)\n${vlc.map(line).join('\n')}\n\n` : '') +
    `En el panel, pestaña Captación, tienes el guion de cada uno, el botón de llamar, el WhatsApp ya escrito y dónde apuntar cómo ha ido: ${APP_URL()}/admin\n\nFiestaGo`
  const r = await sendEmail({ to: process.env.ADMIN_EMAIL || 'contacto@fiestago.es', subject: `Captación de hoy: ${items.length} llamadas o visitas`, text }).catch(() => ({ ok: false }))
  return (r as any).ok ? items.length : 0
}
