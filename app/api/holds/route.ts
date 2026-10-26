import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createHold } from '@/lib/date-holds'
import { sanitizeAcquisition } from '@/lib/attribution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/holds — "Bloquea tu fecha 48 h gratis", "Pide presupuesto gratis" o "Te llamamos"
// body: { kind: 'hold'|'quote', provider_id, service_id?, event_date?, client_name,
//         client_email, client_phone?, event_type?, guests?, message?, acquisition? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name  = String(body.client_name || '').trim().slice(0, 120)
  const email = String(body.client_email || '').trim().slice(0, 200)
  if (!body.provider_id || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Faltan tu nombre y un email válido' }, { status: 400 })
  }
  const date = typeof body.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.event_date) ? body.event_date : null
  if (date && date < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'La fecha ya ha pasado' }, { status: 400 })
  }

  try {
    const hold = await createHold(createAdminClient(), {
      kind: body.kind === 'hold' ? 'hold' : body.kind === 'call' ? 'call' : 'quote',
      provider_id: String(body.provider_id),
      service_id: body.service_id ? String(body.service_id) : null,
      event_date: date,
      client_name: name,
      client_email: email,
      client_phone: body.client_phone ? String(body.client_phone).slice(0, 40) : null,
      event_type: body.event_type ? String(body.event_type).slice(0, 40) : null,
      guests: parseInt(body.guests) || null,
      message: body.message ? String(body.message).slice(0, 2000) : null,
      preferred_time: body.preferred_time ? String(body.preferred_time).slice(0, 60) : null,
      acquisition: sanitizeAcquisition(body.acquisition),
    })
    return NextResponse.json({ hold }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error inesperado' }, { status: err.status || 500 })
  }
}
