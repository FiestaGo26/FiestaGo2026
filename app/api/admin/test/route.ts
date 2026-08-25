import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Centro de control TEST · SOLO activo si FIESTAGO_TEST_MODE=true.
 *
 * Endpoint único que agrupa las acciones de simulación para poder
 * recorrer el flujo end-to-end sin esperar días reales ni configurar
 * Stripe. Auth via x-admin-password.
 *
 * Acciones soportadas (body.action):
 *   · 'time-travel'  → cambia fechas de un booking para simular el paso del tiempo
 *   · 'run-cron'     → dispara el cron de recordatorios ahora mismo
 *   · 'list-bookings' → lista de reservas para elegir en el UI
 *   · 'list-invoices' → todas las facturas del sistema (A5 auditoría)
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (process.env.FIESTAGO_TEST_MODE !== 'true') {
    return NextResponse.json({
      error: 'Test mode desactivado. Añade FIESTAGO_TEST_MODE=true a las env vars de Netlify.',
    }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  const supabase = createAdminClient()

  switch (action) {
    case 'list-bookings': {
      const { data } = await supabase
        .from('bookings')
        .select('id, client_name, client_email, event_date, event_type, total_amount, status, first_payment_status, second_payment_status, second_payment_due_date, second_payment_amount, provider_id, providers(name)')
        .order('created_at', { ascending: false })
        .limit(100)
      return NextResponse.json({ bookings: data || [] })
    }

    case 'list-invoices': {
      const { data } = await supabase
        .from('invoices')
        .select('id, full_number, issue_date, invoice_type, issuer_tax_name, recipient_name, recipient_email, base_amount, tax_amount, total_amount, booking_id, verifactu_mode, cancelled_at')
        .order('issue_date', { ascending: false })
        .limit(200)
      return NextResponse.json({ invoices: data || [] })
    }

    case 'time-travel': {
      const { booking_id, days_backward, target_status } = body
      if (!booking_id) return NextResponse.json({ error: 'booking_id requerido' }, { status: 400 })

      const { data: booking } = await supabase
        .from('bookings')
        .select('id, event_date, second_payment_due_date')
        .eq('id', booking_id).maybeSingle()
      if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

      const daysBack = Math.round(Number(days_backward) || 0)
      const updates: Record<string, any> = {}

      if (daysBack !== 0) {
        // Retrocedemos el due_date del segundo pago X días (equivale a
        // "adelantar el reloj" X días desde el punto de vista del cron)
        if (booking.second_payment_due_date) {
          const orig = new Date(booking.second_payment_due_date + 'T00:00:00')
          const shifted = new Date(orig.getTime() - daysBack * 86400_000)
          updates.second_payment_due_date = shifted.toISOString().slice(0, 10)
        }
        if (booking.event_date) {
          const orig = new Date(booking.event_date + 'T00:00:00')
          const shifted = new Date(orig.getTime() - daysBack * 86400_000)
          updates.event_date = shifted.toISOString().slice(0, 10)
        }
      }

      // Reset de flags de recordatorios (para poder re-testear)
      if (body.reset_reminders) {
        updates.second_payment_reminder_d7_sent_at = null
        updates.second_payment_reminder_d3_sent_at = null
        updates.second_payment_reminder_d0_sent_at = null
        updates.second_payment_overdue_since = null
      }

      // Cambio directo de status (para testear branches concretos)
      if (target_status) {
        updates.second_payment_status = target_status
      }

      const { data, error } = await supabase
        .from('bookings').update(updates).eq('id', booking_id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, booking: data, applied: updates })
    }

    case 'run-cron': {
      // Ejecuta el cron de recordatorios internamente (no vía HTTP externa)
      const base = new URL(req.url).origin
      const res = await fetch(`${base}/api/cron/second-payment-reminders`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || 'test' },
      })
      const data = await res.json()
      return NextResponse.json({ ok: res.ok, cron_result: data })
    }

    default:
      return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  }
}
