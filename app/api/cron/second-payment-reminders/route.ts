import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  emailClientSecondPaymentReminder,
  emailClientReservationCancelledByNonpayment,
  emailProviderReservationCancelledByNonpayment,
} from '@/lib/emails/second-payment'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron diario · gestiona el ciclo completo del segundo pago de bookings
 * con anticipo + resto 2 meses antes del evento.
 *
 * Ejecutar una vez al día (idealmente 09:00 hora Madrid). Idempotente:
 * si corre varias veces el mismo día no duplica envíos (cada acción
 * marca su timestamp en la fila del booking).
 *
 * Ciclo por reserva con second_payment_status = 'pending':
 *
 *   ┌─────────┬──────────────────────────────────────────────────────────┐
 *   │ D-7     │ Email al cliente: "vence en 7 días"                       │
 *   │         │ + marca second_payment_reminder_d7_sent_at                 │
 *   ├─────────┼──────────────────────────────────────────────────────────┤
 *   │ D-3     │ Email al cliente: "vence en 3 días"                       │
 *   │         │ + marca second_payment_reminder_d3_sent_at                 │
 *   ├─────────┼──────────────────────────────────────────────────────────┤
 *   │ D 0     │ Email al cliente: "vence HOY"                             │
 *   │         │ + marca second_payment_reminder_d0_sent_at                 │
 *   ├─────────┼──────────────────────────────────────────────────────────┤
 *   │ D+1..6  │ status='overdue' (si no lo estaba ya), un email por       │
 *   │         │ día NO — solo el aviso de D+1. Resto sin ruido.           │
 *   ├─────────┼──────────────────────────────────────────────────────────┤
 *   │ D+7     │ status='cancelled' automático. Anticipo va al proveedor   │
 *   │         │ como compensación por perder la fecha. Emails a ambos.    │
 *   │         │ Libera fecha en service_availability.                      │
 *   └─────────┴──────────────────────────────────────────────────────────┘
 */

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today    = startOfDayMadrid(new Date())
  const stats    = { d7: 0, d3: 0, d0: 0, marked_overdue: 0, cancelled: 0, errors: 0 }
  const logs: string[] = []

  // 1) Traer todas las reservas con segundo pago pendiente o en gracia.
  //    Nos interesan las que están dentro del rango [today-30d, today+30d]
  //    respecto a su due_date. Fuera de esa ventana no aplica ninguna acción.
  const rangeStart = new Date(today.getTime() - 30 * 86400_000).toISOString().slice(0, 10)
  const rangeEnd   = new Date(today.getTime() + 30 * 86400_000).toISOString().slice(0, 10)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, providers(id, name, email, phone)')
    .in('second_payment_status', ['pending', 'overdue'])
    .gte('second_payment_due_date', rangeStart)
    .lte('second_payment_due_date', rangeEnd)
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const b of (bookings || [])) {
    try {
      const due = b.second_payment_due_date
        ? startOfDayMadrid(new Date(b.second_payment_due_date + 'T00:00:00'))
        : null
      if (!due) continue

      const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400_000)
      const graceDays = b.second_payment_grace_days ?? 7

      // ─── CANCELACIÓN AUTOMÁTICA: pasado el grace period ──────────────
      if (daysUntil <= -graceDays && b.second_payment_status !== 'cancelled') {
        await cancelForNonpayment(supabase, b)
        stats.cancelled++
        logs.push(`✗ cancelada · ${b.id} · vencido hace ${-daysUntil}d`)
        continue
      }

      // ─── D+1: MARCAR OVERDUE ─────────────────────────────────────────
      if (daysUntil <= -1 && b.second_payment_status === 'pending') {
        await supabase.from('bookings').update({
          second_payment_status:        'overdue',
          second_payment_overdue_since: new Date().toISOString(),
        }).eq('id', b.id)
        // Enviar aviso de overdue (una sola vez)
        const res = await emailClientSecondPaymentReminder(b, b.providers, 'overdue')
        if (res.ok) stats.marked_overdue++
        else stats.errors++
        logs.push(`⚠ overdue · ${b.id} · vencido hace ${-daysUntil}d`)
        continue
      }

      // ─── RECORDATORIOS PRE-VENCIMIENTO ───────────────────────────────
      if (daysUntil === 7 && !b.second_payment_reminder_d7_sent_at) {
        const res = await emailClientSecondPaymentReminder(b, b.providers, 'd7')
        if (res.ok) {
          await supabase.from('bookings')
            .update({ second_payment_reminder_d7_sent_at: new Date().toISOString() })
            .eq('id', b.id)
          stats.d7++
        } else stats.errors++
        logs.push(`↗ d-7 · ${b.id}`)
      }
      else if (daysUntil === 3 && !b.second_payment_reminder_d3_sent_at) {
        const res = await emailClientSecondPaymentReminder(b, b.providers, 'd3')
        if (res.ok) {
          await supabase.from('bookings')
            .update({ second_payment_reminder_d3_sent_at: new Date().toISOString() })
            .eq('id', b.id)
          stats.d3++
        } else stats.errors++
        logs.push(`↗ d-3 · ${b.id}`)
      }
      else if (daysUntil === 0 && !b.second_payment_reminder_d0_sent_at) {
        const res = await emailClientSecondPaymentReminder(b, b.providers, 'd0')
        if (res.ok) {
          await supabase.from('bookings')
            .update({ second_payment_reminder_d0_sent_at: new Date().toISOString() })
            .eq('id', b.id)
          stats.d0++
        } else stats.errors++
        logs.push(`↗ d-0 · ${b.id}`)
      }
    } catch (err: any) {
      stats.errors++
      logs.push(`✗ err · ${b.id} · ${err?.message || 'unknown'}`)
    }
  }

  return NextResponse.json({
    ok: true,
    today: today.toISOString().slice(0, 10),
    scanned: bookings?.length || 0,
    stats,
    logs,
  })
}

// GET reusa POST para poder testear el cron desde el navegador con
// el admin password. Netlify Scheduled Functions llama POST.
export async function GET(req: NextRequest) {
  return POST(req)
}

// ─── Helpers ────────────────────────────────────────────────────────────

function startOfDayMadrid(d: Date): Date {
  // Fuerza el "día 0" en Europe/Madrid. El comparativo daysUntil se hace
  // en días naturales para que "vence hoy" signifique "hoy en España",
  // no en UTC.
  const madridStr = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  return new Date(madridStr + 'T00:00:00Z')
}

async function cancelForNonpayment(supabase: any, booking: any) {
  const now = new Date().toISOString()

  await supabase.from('bookings').update({
    second_payment_status:        'cancelled',
    second_payment_cancelled_at:  now,
    status:                       'cancelled',
    cancelled_at:                 now,
  }).eq('id', booking.id)

  // Libera la fecha bloqueada en service_availability
  if (booking.event_date && booking.service_id) {
    try {
      await supabase.from('service_availability')
        .delete()
        .eq('service_id', booking.service_id)
        .eq('blocked_date', booking.event_date)
        .like('reason', 'Reservado por%')
    } catch { /* no-op */ }
  }

  // Notificaciones — best-effort
  try {
    if (booking.client_email) {
      await emailClientReservationCancelledByNonpayment(booking, booking.providers)
    }
    if (booking.providers?.email) {
      await emailProviderReservationCancelledByNonpayment(booking, booking.providers)
    }
  } catch (err: any) {
    console.error('cancelForNonpayment email:', err?.message)
  }

  // Registro para el admin
  await supabase.from('notifications').insert({
    type:    'booking_cancelled_nonpayment',
    title:   `✗ Reserva cancelada por impago · ${booking.client_name}`,
    message: `Vencimiento del segundo pago + 7 días de gracia sin cobrar. Anticipo de ${booking.first_payment_amount || 0}€ va al proveedor ${booking.providers?.name || '—'} como compensación.`,
    data:    { booking_id: booking.id, provider_id: booking.provider_id, event_date: booking.event_date },
    action_url: `/admin?booking=${booking.id}`,
  }).catch(() => {})
}
