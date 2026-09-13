import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailProviderConfirmServiceReminder } from '@/lib/emails/service-confirmation'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron diario · recuerda al proveedor que confirme la prestación del
 * servicio 24 h después del evento.
 *
 * Por qué existe: la ventana de reclamación de Visa/Mastercard cuenta
 * desde la fecha del servicio, no desde el cobro. Una reserva celebrada
 * y sin confirmar es exactamente el expediente que perdemos si el
 * cliente reclama cuatro meses después.
 *
 * Ventana de barrido: eventos de hace 1 a 7 días. Empezamos en el día
 * siguiente al evento (las 24 h del encargo) y llegamos hasta 7 por si
 * el cron no corrió algún día. Solo se envía un recordatorio por
 * reserva: la marca va en bookings.service_confirmation_reminder_sent_at.
 *
 * Programación sugerida: 1 vez al día, 10:00 hora Madrid.
 */

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const todayMadrid = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  const today = new Date(todayMadrid + 'T00:00:00Z')

  const from = new Date(today.getTime() - 7 * 86400_000).toISOString().slice(0, 10)
  const to   = new Date(today.getTime() - 1 * 86400_000).toISOString().slice(0, 10)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, client_name, event_date, status, provider_id, service_confirmed_at, service_confirmation_reminder_sent_at, providers(id, name, email)')
    .gte('event_date', from)
    .lte('event_date', to)
    .is('service_confirmed_at', null)
    .is('service_confirmation_reminder_sent_at', null)
    .in('status', ['confirmed', 'completed'])
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stats = { sent: 0, skipped: 0, errors: 0 }
  const logs: string[] = []

  for (const b of (bookings || [])) {
    const provider: any = Array.isArray((b as any).providers) ? (b as any).providers[0] : (b as any).providers
    if (!provider?.email) {
      stats.skipped++
      logs.push(`· sin email de proveedor · ${b.id}`)
      continue
    }
    try {
      const res = await emailProviderConfirmServiceReminder(b, provider)
      if (!res.ok) throw new Error(res.error || 'envío fallido')
      await supabase.from('bookings')
        .update({ service_confirmation_reminder_sent_at: new Date().toISOString() })
        .eq('id', b.id)
      stats.sent++
      logs.push(`↗ recordatorio · ${b.id} · evento ${b.event_date} · ${provider.name}`)
    } catch (err: any) {
      stats.errors++
      logs.push(`✗ err · ${b.id} · ${err?.message || 'unknown'}`)
    }
  }

  return NextResponse.json({ ok: true, window: { from, to }, scanned: bookings?.length || 0, stats, logs })
}

// GET reusa POST para poder lanzarlo a mano desde el navegador con el
// admin password, igual que el resto de crons del proyecto.
export async function GET(req: NextRequest) {
  return POST(req)
}
