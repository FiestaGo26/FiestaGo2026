'use server'

/**
 * Server Actions del panel del proveedor.
 *
 * Confirmar la prestación del servicio es, junto con el consentimiento
 * del cliente, la pieza que decide una disputa por "servicio no
 * prestado": sin ella solo tenemos nuestra palabra. Por eso el registro
 * va a service_confirmations, que es inmutable, y no a una columna
 * cualquiera de bookings.
 */

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { getClientIp } from '@/lib/net/client-ip'

export type ConfirmServiceResult =
  | { ok: true; confirmedAt: string; alreadyConfirmed?: boolean }
  | { ok: false; error: string }

export async function confirmServiceDelivered(input: {
  bookingId: string
  providerId: string
  notes?: string
  /** Impersonación desde /admin (mismo mecanismo que el resto del panel). */
  adminPassword?: string
}): Promise<ConfirmServiceResult> {
  const { bookingId, providerId, notes } = input
  if (!bookingId || !providerId) return { ok: false, error: 'Faltan datos de la reserva.' }

  const supabase = createAdminClient()

  const { data: provider } = await supabase
    .from('providers').select('id, name, email')
    .eq('id', providerId).maybeSingle()
  if (!provider) return { ok: false, error: 'Proveedor no encontrado.' }

  // Autorización: sesión del proveedor o contraseña de admin.
  const isAdmin = Boolean(
    input.adminPassword &&
    process.env.ADMIN_PASSWORD &&
    input.adminPassword === process.env.ADMIN_PASSWORD
  )
  if (!isAdmin) {
    const user = await getAuthUser()
    if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar en el panel.' }
    if ((user.email || '').toLowerCase() !== (provider.email || '').toLowerCase()) {
      return { ok: false, error: 'No autorizado.' }
    }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, provider_id, event_date, status, service_confirmed_at')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return { ok: false, error: 'Reserva no encontrada.' }
  if (booking.provider_id !== providerId) return { ok: false, error: 'Esta reserva no es tuya.' }
  if (booking.status === 'cancelled') return { ok: false, error: 'La reserva está cancelada.' }

  // Habilitado desde el día del evento: confirmar antes no prueba nada.
  const todayMadrid = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  if (booking.event_date > todayMadrid) {
    return {
      ok: false,
      error: `Podrás confirmar la prestación del servicio a partir del día del evento (${booking.event_date}).`,
    }
  }

  // La tabla no admite UPDATE: si ya hay confirmación, no insertamos otra.
  const { data: existing } = await supabase
    .from('service_confirmations')
    .select('id, confirmed_at')
    .eq('booking_id', bookingId)
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { ok: true, confirmedAt: existing.confirmed_at, alreadyConfirmed: true }
  }

  const confirmedAt = new Date().toISOString()
  const { error } = await supabase.from('service_confirmations').insert({
    booking_id:  bookingId,
    provider_id: providerId,
    confirmed_at: confirmedAt,
    service_date: booking.event_date,
    notes:        notes?.trim() || null,
    ip_address:   getClientIp(headers()),
    confirmation_method: isAdmin ? 'admin_manual' : 'provider_panel',
  })

  if (error) return { ok: false, error: `No se pudo registrar la confirmación: ${error.message}` }

  // Copia desnormalizada para listados y recordatorios. La prueba sigue
  // siendo la fila de service_confirmations.
  //
  // El estado pasa a 'completed' solo si venía de 'confirmed': una
  // reserva en disputa se queda como está, que su estado lo manda el
  // expediente, no el proveedor.
  await supabase.from('bookings')
    .update({
      service_confirmed_at: confirmedAt,
      ...(booking.status === 'confirmed' ? { status: 'completed' } : {}),
    })
    .eq('id', bookingId)
    .eq('provider_id', providerId)

  return { ok: true, confirmedAt }
}
