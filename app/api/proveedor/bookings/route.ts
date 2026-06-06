import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { emailClientBookingConfirmed, emailClientBookingCancelled } from '@/lib/resend'
import { calcRefund } from '@/lib/constants'
import { exportBookingToGoogle, removeBookingFromGoogle } from '@/lib/google-sync'

// Antes de aceptar la reserva, el proveedor solo ve datos generales.
// Esto evita que el proveedor contacte al cliente fuera de la plataforma
// y se salte la comisión. Una vez confirmada, ve todos los datos.
function maskForProvider(b: any) {
  if (b.status === 'confirmed' || b.status === 'completed') return b
  // Limpiamos también el mensaje de posibles emails/teléfonos colados:
  const safeMsg = b.message
    ? b.message
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email oculto]')
        .replace(/\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}\b/g, '[teléfono oculto]')
    : null
  return {
    ...b,
    client_name:  '🔒 Cliente (acepta para ver)',
    client_email: null,
    client_phone: null,
    message:      safeMsg,
    _masked:      true,
  }
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  const auth = await requireProviderAuth(req, id)
  if (!auth.ok) return auth.response
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('provider_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const bookings = (data || []).map(maskForProvider)
  return NextResponse.json({ bookings })
}

export async function PATCH(req: NextRequest) {
  const { id, status, providerId } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const supabase = createAdminClient()

  const updates: any = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()

  // Lookup previa para conocer la fecha y calcular refund si toca cancelar
  const { data: prev } = await supabase
    .from('bookings')
    .select('event_date, total_amount, service_id, provider_services(cancellation_policy)')
    .eq('id', id).single()

  let refund: { percent: number; amount: number; rule: string } | null = null
  if (status === 'cancelled' && prev) {
    refund = calcRefund({
      policy: (prev as any).provider_services?.cancellation_policy,
      eventDate: prev.event_date,
      totalAmount: prev.total_amount || 0,
    })
    updates.refund_percent = refund.percent
    updates.refund_amount  = refund.amount
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('provider_id', providerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si cancela, liberar el bloqueo automático en service_availability
  if (status === 'cancelled' && prev?.event_date) {
    try {
      await supabase.from('service_availability')
        .delete()
        .eq('blocked_date', prev.event_date)
        .like('reason', 'Reservado por%')
    } catch { /* no-op */ }
  }

  // Email al cliente avisando del cambio. No bloquea la respuesta.
  if (status === 'confirmed' || status === 'cancelled') {
    try {
      const { data: prov } = await supabase
        .from('providers').select('id, name, email, phone')
        .eq('id', providerId).single()
      if (prov) {
        if (status === 'confirmed') {
          emailClientBookingConfirmed(data, prov).catch(err =>
            console.error('emailClientBookingConfirmed:', err?.message))
        } else {
          emailClientBookingCancelled(data, prov, 'provider', undefined, refund).catch(err =>
            console.error('emailClientBookingCancelled:', err?.message))
          // Notificar al admin del importe a procesar
          if (refund && refund.amount > 0) {
            await supabase.from('notifications').insert({
              type: 'refund_pending',
              title: `💸 Reembolso pendiente · ${refund.amount.toLocaleString()}€`,
              message: `Reserva cancelada por proveedor · ${refund.percent}% · ${refund.rule}`,
              data: { booking_id: id, amount: refund.amount, percent: refund.percent },
              action_url: `/admin?booking=${id}`,
            }).then(() => {})
          }
        }
      }
    } catch { /* no-op */ }
  }

  // Google Calendar sync: si está conectado, exportar al confirmar y
  // borrar el evento al cancelar. Best-effort, no bloquea la respuesta.
  if (status === 'confirmed') {
    exportBookingToGoogle(id).catch(err => console.error('gcal export:', err?.message))
  } else if (status === 'cancelled') {
    removeBookingFromGoogle(id).catch(err => console.error('gcal remove:', err?.message))
  }

  return NextResponse.json({ booking: data })
}
