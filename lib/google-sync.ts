import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  type GCalConnection,
  queryBusy,
  createAllDayEvent,
  deleteEvent,
} from '@/lib/google-calendar'

const SYNC_DAYS = 180 // ventana hacia delante que sincronizamos

// Carga la conexión de Google de un proveedor (o null si no la tiene).
export async function getConnection(providerId: string): Promise<GCalConnection | null> {
  const { data } = await supabaseAdmin()
    .from('google_calendar_connections')
    .select('provider_id, calendar_id, access_token, refresh_token, token_expiry')
    .eq('provider_id', providerId)
    .maybeSingle()
  return (data as GCalConnection) ?? null
}

// Persiste un access token refrescado (si lo hubo).
async function persistRefreshed(providerId: string, refreshed: any) {
  if (!refreshed) return
  await supabaseAdmin()
    .from('google_calendar_connections')
    .update({
      access_token: refreshed.access_token,
      token_expiry: refreshed.expiry,
      updated_at: new Date().toISOString(),
    })
    .eq('provider_id', providerId)
}

// Convierte intervalos ocupados en un conjunto de fechas (YYYY-MM-DD).
function busyDates(busy: { start: string; end: string }[]): Set<string> {
  const dates = new Set<string>()
  for (const { start, end } of busy) {
    const d = new Date(start)
    const last = new Date(end)
    // Recorremos día a día (en UTC) mientras el intervalo siga abierto.
    for (let cur = new Date(d); cur < last; cur.setUTCDate(cur.getUTCDate() + 1)) {
      dates.add(cur.toISOString().slice(0, 10))
    }
  }
  return dates
}

// ─── Google → FiestaGo: importa ocupado/libre y bloquea fechas ───────────────
export async function syncBusyToAvailability(providerId: string): Promise<{ blocked: number }> {
  const supabase = supabaseAdmin()
  const conn = await getConnection(providerId)
  if (!conn) return { blocked: 0 }

  const timeMin = new Date()
  const timeMax = new Date(Date.now() + SYNC_DAYS * 24 * 60 * 60 * 1000)

  const { busy, refreshed } = await queryBusy(conn, timeMin, timeMax)
  await persistRefreshed(providerId, refreshed)

  const wanted = busyDates(busy)

  // Servicios del proveedor (service_availability es por service_id).
  const { data: services } = await supabase
    .from('provider_services')
    .select('id')
    .eq('provider_id', providerId)
  const serviceIds = (services ?? []).map((s) => s.id as string)
  if (serviceIds.length === 0) return { blocked: 0 }

  // Bloqueos actuales importados de Google, dentro de la ventana.
  const todayStr = timeMin.toISOString().slice(0, 10)
  const maxStr = timeMax.toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from('service_availability')
    .select('id, service_id, blocked_date')
    .in('service_id', serviceIds)
    .eq('source', 'google')
    .gte('blocked_date', todayStr)
    .lte('blocked_date', maxStr)

  const existingByKey = new Map<string, string>() // `${service_id}|${date}` -> rowId
  for (const r of existing ?? []) {
    existingByKey.set(`${r.service_id}|${r.blocked_date}`, r.id as string)
  }

  // Insertar las que faltan
  const toInsert: { service_id: string; blocked_date: string; reason: string; source: string }[] = []
  for (const serviceId of serviceIds) {
    for (const date of Array.from(wanted)) {
      const key = `${serviceId}|${date}`
      if (existingByKey.has(key)) {
        existingByKey.delete(key) // sigue vigente → no la borramos
      } else {
        toInsert.push({
          service_id: serviceId,
          blocked_date: date,
          reason: 'Ocupado en Google Calendar',
          source: 'google',
        })
      }
    }
  }

  // Lo que quede en existingByKey son bloqueos de Google que ya no aplican → borrar
  const staleIds = Array.from(existingByKey.values())

  if (toInsert.length) {
    await supabase.from('service_availability').insert(toInsert)
  }
  if (staleIds.length) {
    await supabase.from('service_availability').delete().in('id', staleIds)
  }

  await supabase
    .from('google_calendar_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('provider_id', providerId)

  return { blocked: wanted.size }
}

// ─── FiestaGo → Google: crea/borra el evento de una reserva ──────────────────
export async function exportBookingToGoogle(bookingId: string): Promise<void> {
  const supabase = supabaseAdmin()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, provider_id, event_date, event_type, client_name, guests, google_event_id')
    .eq('id', bookingId)
    .single()
  if (!booking?.provider_id || !booking.event_date) return
  if (booking.google_event_id) return // ya exportada

  const conn = await getConnection(booking.provider_id)
  if (!conn) return

  const summary = `FiestaGo: ${booking.event_type || 'evento'}${
    booking.client_name ? ` · ${booking.client_name}` : ''
  }`
  const description = `Reserva vía FiestaGo${
    booking.guests ? ` · ${booking.guests} invitados` : ''
  }`

  const { eventId, refreshed } = await createAllDayEvent(conn, {
    date: String(booking.event_date),
    summary,
    description,
  })
  await persistRefreshed(booking.provider_id, refreshed)

  if (eventId) {
    await supabase.from('bookings').update({ google_event_id: eventId }).eq('id', bookingId)
  }
}

export async function removeBookingFromGoogle(bookingId: string): Promise<void> {
  const supabase = supabaseAdmin()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, provider_id, google_event_id')
    .eq('id', bookingId)
    .single()
  if (!booking?.provider_id || !booking.google_event_id) return

  const conn = await getConnection(booking.provider_id)
  if (!conn) return

  const { refreshed } = await deleteEvent(conn, booking.google_event_id)
  await persistRefreshed(booking.provider_id, refreshed)
  await supabase.from('bookings').update({ google_event_id: null }).eq('id', bookingId)
}
