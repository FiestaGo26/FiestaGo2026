// ───────────────────────────────────────────────────────────────────────
// Primer paso sin pagar (plan de confianza, 4.ª simulación).
//
//   · 'hold'  → "Bloquea tu fecha 48 h gratis": la fecha del servicio queda
//               bloqueada (service_availability, source 'hold') y se libera
//               sola al caducar. Sin tarjeta ni DNI.
//   · 'quote' → "Pide presupuesto gratis": solo avisa al proveedor.
//   · 'call'  → "Te llamamos": el cliente deja su teléfono y una franja;
//               llama el proveedor o, si no, alguien de FiestaGo.
//
// El proveedor y Mariano reciben un email; el cliente, una confirmación.
// Si el cliente reserva esa misma fecha, el bloqueo pasa a 'converted'.
// Los bloqueos caducados los libera el latido del CEO (cada 10 min).
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'

export const HOLD_HOURS = 48
const HOLD_SOURCE = 'hold'

export type HoldKind = 'hold' | 'quote' | 'call'

export type HoldInput = {
  kind: HoldKind
  provider_id: string
  service_id?: string | null
  event_date?: string | null
  client_name: string
  client_email: string
  client_phone?: string | null
  event_type?: string | null
  guests?: number | null
  message?: string | null
  preferred_time?: string | null
  acquisition?: unknown
}

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')

function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtUntil(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export async function createHold(supabase: SupabaseClient, input: HoldInput) {
  const { data: provider } = await supabase.from('providers')
    .select('id, name, slug, email, city').eq('id', input.provider_id).maybeSingle()
  if (!provider) throw Object.assign(new Error('Proveedor no encontrado'), { status: 404 })

  let service: { id: string; name: string } | null = null
  if (input.service_id) {
    const { data } = await supabase.from('provider_services').select('id, name, provider_id').eq('id', input.service_id).maybeSingle()
    if (!data || data.provider_id !== provider.id) throw Object.assign(new Error('Servicio no válido'), { status: 400 })
    service = { id: data.id, name: data.name }
  }

  const kind: HoldKind = input.kind === 'call' ? 'call'
    : input.kind === 'hold' && service && input.event_date ? 'hold' : 'quote'
  if (kind === 'call' && !input.client_phone) throw Object.assign(new Error('Déjanos un teléfono para poder llamarte'), { status: 400 })
  let expiresAt: string | null = null

  if (kind === 'hold') {
    // Un bloqueo activo por persona y servicio: si repite, se renueva
    await releaseHolds(supabase, { service_id: service!.id, client_email: input.client_email, status: 'released' })

    const { data: taken } = await supabase.from('service_availability')
      .select('id').eq('service_id', service!.id).eq('blocked_date', input.event_date!).maybeSingle()
    if (taken) throw Object.assign(new Error('Esa fecha ya no está disponible para este servicio. Elige otra.'), { status: 409 })

    expiresAt = new Date(Date.now() + HOLD_HOURS * 3600_000).toISOString()
    const { error } = await supabase.from('service_availability').insert({
      service_id: service!.id, blocked_date: input.event_date, source: HOLD_SOURCE,
      reason: `Bloqueo ${HOLD_HOURS} h de ${input.client_name} (sin pagar)`,
    })
    if (error) throw Object.assign(new Error('Esa fecha ya no está disponible para este servicio. Elige otra.'), { status: 409 })
  }

  const { data: hold, error } = await supabase.from('date_holds').insert({
    kind, provider_id: provider.id, service_id: service?.id || null,
    event_date: input.event_date || null, expires_at: expiresAt,
    client_name: input.client_name, client_email: input.client_email, client_phone: input.client_phone || null,
    event_type: input.event_type || null, guests: input.guests || null, message: input.message || null,
    preferred_time: input.preferred_time || null,
    acquisition: input.acquisition || null,
  }).select('id, kind, expires_at').single()
  if (error) throw new Error(error.message)

  await notify({ kind, provider, service, input, expiresAt }).catch(err => console.error('[date-holds] email:', err?.message))
  return hold
}

async function notify(o: {
  kind: HoldKind
  provider: { name: string; slug: string | null; email: string | null; id: string }
  service: { name: string } | null
  input: HoldInput
  expiresAt: string | null
}) {
  const { kind, provider, service, input, expiresAt } = o
  const what = service ? `"${service.name}"` : 'sus servicios'
  const when = input.event_date ? fmtDate(input.event_date) : 'fecha por concretar'
  const details = [
    `Cliente: ${input.client_name}`,
    `Email: ${input.client_email}`,
    input.client_phone ? `Teléfono: ${input.client_phone}` : null,
    input.preferred_time ? `Mejor hora para llamar: ${input.preferred_time}` : null,
    `Servicio: ${service?.name || 'sin elegir'}`,
    `Fecha: ${when}`,
    input.event_type ? `Tipo de evento: ${input.event_type}` : null,
    input.guests ? `Invitados: ${input.guests}` : null,
    input.message ? `Mensaje: ${input.message}` : null,
  ].filter(Boolean).join('\n')
  const fichaUrl = `${APP_URL()}/proveedores/${provider.slug || provider.id}`

  // Cliente
  await sendEmail({
    to: input.client_email,
    subject: kind === 'hold'
      ? `Tu fecha está bloqueada 48 h · ${provider.name}`
      : kind === 'call'
      ? `Te llamamos · ${provider.name}`
      : `Hemos recibido tu petición de presupuesto · ${provider.name}`,
    text: kind === 'call'
      ? `Hola ${input.client_name},\n\nTe llamará ${provider.name} o alguien del equipo de FiestaGo al ${input.client_phone}${input.preferred_time ? ` (${input.preferred_time})` : ''} para resolver tus dudas. No has pagado nada.\n\nMientras, puedes ver su ficha aquí: ${fichaUrl}\n\nFiestaGo`
      : kind === 'hold'
      ? `Hola ${input.client_name},\n\nHemos bloqueado el ${when} para ${what} de ${provider.name} hasta el ${fmtUntil(expiresAt!)}. No has pagado nada y no te llamaremos si no lo pides.\n\nSi lo tienes claro, reserva desde la ficha antes de que caduque: ${fichaUrl}\nSi tienes dudas, contesta a este email o escríbenos por WhatsApp (de lunes a viernes de 10:00 a 20:00 y sábados de 10:00 a 14:00).\n\nTodos los servicios llevan la Garantía de Éxito incluida y tu pago queda retenido en Stripe hasta que termina tu evento.\n\nFiestaGo`
      : `Hola ${input.client_name},\n\nHemos pasado tu petición a ${provider.name} y te responderá con un presupuesto. No has pagado nada y no te llamaremos si no lo pides.\n\nPuedes ver su ficha aquí: ${fichaUrl}\n\nFiestaGo`,
  })

  // Proveedor
  if (provider.email) {
    await sendEmail({
      to: provider.email,
      subject: kind === 'hold'
        ? `📅 Fecha bloqueada 48 h por un cliente · ${when}`
        : kind === 'call'
        ? `📞 Un cliente quiere que le llames · ${input.client_name}`
        : `💬 Nueva petición de presupuesto en FiestaGo`,
      text: `${kind === 'call'
        ? `Un cliente quiere hablar contigo antes de reservar. Llámale cuanto antes${input.preferred_time ? ` (prefiere ${input.preferred_time})` : ''}: es el momento en que más fácil es cerrar la reserva. Si no puedes, responde a este email y le llamamos desde FiestaGo.`
        : kind === 'hold'
        ? `Un cliente ha bloqueado ${when} para ${what} durante ${HOLD_HOURS} h, sin pagar todavía. Si reserva, te llegará la reserva como siempre; si no, la fecha se libera sola el ${fmtUntil(expiresAt!)}.`
        : `Un cliente te pide presupuesto. Contéstale cuanto antes: es el momento en que más fácil es cerrar la reserva.`}\n\n${details}\n\nTu panel: ${APP_URL()}/proveedor/panel`,
      reply_to: input.client_email,
    })
  }

  // Mariano
  await sendEmail({
    to: process.env.ADMIN_EMAIL || 'contacto@fiestago.es',
    subject: `${kind === 'hold' ? '📅 Bloqueo 48 h' : kind === 'call' ? '📞 Llamada pedida' : '💬 Presupuesto'} · ${provider.name} · ${input.client_name}`,
    text: `${kind === 'call' ? 'El cliente ha pedido que le llamen. Le llamará el proveedor; si no lo hace en unas horas, llámale tú.\n\n' : ''}${details}\n\nFicha: ${fichaUrl}`,
  })
}

/** Libera bloqueos (los caducados, o los de un cliente concreto) y su fecha. */
export async function releaseHolds(
  supabase: SupabaseClient,
  opts: { expired?: boolean; service_id?: string; client_email?: string; event_date?: string; status: 'expired' | 'released' | 'converted' },
) {
  let q = supabase.from('date_holds').select('id, service_id, event_date').eq('kind', 'hold').eq('status', 'active')
  if (opts.expired) q = q.lt('expires_at', new Date().toISOString())
  if (opts.service_id) q = q.eq('service_id', opts.service_id)
  if (opts.client_email) q = q.ilike('client_email', opts.client_email)
  if (opts.event_date) q = q.eq('event_date', opts.event_date)
  const { data: holds } = await q.limit(200)

  for (const h of holds || []) {
    await supabase.from('date_holds').update({ status: opts.status }).eq('id', h.id)
    // Al convertir en reserva, la fecha sigue bloqueada (ahora por la reserva)
    if (opts.status !== 'converted' && h.service_id && h.event_date) {
      await supabase.from('service_availability').delete()
        .eq('service_id', h.service_id).eq('blocked_date', h.event_date).eq('source', HOLD_SOURCE)
    }
  }
  return (holds || []).length
}
