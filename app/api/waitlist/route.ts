import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailWaitlistWelcome } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/waitlist — público. Acepta:
// { email, name?, city?, event_type?, event_date?, guests?, source?, referred_by? }
//
// Idempotente: si el email ya existe (case-insensitive) y no se ha
// dado de baja, devuelve { alreadyExists: true } sin error y SIN
// reenviar email (para no spamear).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = (body.email || '').toString().trim().toLowerCase()

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || req.headers.get('x-real-ip')
          || null
  const userAgent = req.headers.get('user-agent') || null

  // Comprobar duplicado
  const { data: existing } = await supabase
    .from('waitlist')
    .select('id, unsubscribed_at')
    .ilike('email', email)
    .is('unsubscribed_at', null)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, alreadyExists: true }, { status: 200 })
  }

  const insertable: any = { email, ip, user_agent: userAgent }
  if (body.name)        insertable.name        = body.name.toString().trim().slice(0, 80)
  if (body.city)        insertable.city        = body.city.toString().trim().slice(0, 80)
  if (body.event_type)  insertable.event_type  = body.event_type.toString().trim().slice(0, 40)
  if (body.event_date)  insertable.event_date  = body.event_date
  if (body.guests)      insertable.guests      = parseInt(body.guests) || null
  if (body.source)      insertable.source      = body.source.toString().slice(0, 80)
  if (body.referred_by) insertable.referred_by = body.referred_by.toString().slice(0, 80)

  const { data, error } = await supabase
    .from('waitlist')
    .insert(insertable)
    .select()
    .single()

  if (error) {
    // Carrera contra el unique index (otro POST coincidente)
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, alreadyExists: true }, { status: 200 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Email de bienvenida (no bloquea respuesta)
  emailWaitlistWelcome(data).catch(err =>
    console.error('emailWaitlistWelcome:', err.message))

  return NextResponse.json({ ok: true, entry: { id: data.id, email: data.email } }, { status: 201 })
}
