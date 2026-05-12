import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function checkAuth(req: NextRequest) {
  return !!req.headers.get('x-provider-token')
}

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
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

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
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { id, status, providerId } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

  const updates: any = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()

  // Lookup previa para conocer la fecha (necesaria si vamos a desbloquear)
  const { data: prev } = await supabase.from('bookings').select('event_date').eq('id', id).single()

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

  return NextResponse.json({ booking: data })
}
