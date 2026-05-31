import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Cliente Supabase server-side con cookies (lee la sesión del usuario).
async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: any[]) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    }
  )
}

// GET /api/user-event — devuelve el evento activo del usuario (si lo tiene)
//   + el progreso del checklist.
export async function GET(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ event: null, progress: [] })

  const { data: events } = await supabase
    .from('user_events')
    .select('*')
    .eq('user_id', user.id)
    .order('event_date', { ascending: true })
    .limit(1)

  const event = events?.[0] || null
  if (!event) return NextResponse.json({ event: null, progress: [] })

  const { data: progress } = await supabase
    .from('user_checklist_progress')
    .select('*')
    .eq('user_event_id', event.id)

  return NextResponse.json({ event, progress: progress || [] })
}

// POST /api/user-event — crea o actualiza el evento del usuario
//   body: { event_type, event_date, city, guests, name, vibe, budget_total }
export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  if (!body.event_type || !body.event_date) {
    return NextResponse.json({ error: 'event_type y event_date son obligatorios' }, { status: 400 })
  }

  // ¿Tiene ya un evento? Lo actualizamos. Si no, lo creamos.
  const { data: existing } = await supabase
    .from('user_events')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const payload: any = {
    event_type:   body.event_type,
    event_date:   body.event_date,
    city:         body.city || null,
    guests:       body.guests || null,
    name:         body.name || null,
    vibe:         body.vibe || null,
    budget_total: body.budget_total || null,
  }

  if (existing) {
    const { data, error } = await supabase
      .from('user_events')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ event: data })
  } else {
    const { data, error } = await supabase
      .from('user_events')
      .insert({ ...payload, user_id: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ event: data }, { status: 201 })
  }
}

// PATCH /api/user-event — marcar/desmarcar un item del checklist
//   body: { user_event_id, item_key, done: boolean, notes? }
export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  if (!body.user_event_id || !body.item_key) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  // Verificar que el evento sea del usuario (RLS lo refuerza, pero
  // chequeamos aquí para mensajes claros)
  const { data: evt } = await supabase
    .from('user_events').select('id').eq('id', body.user_event_id).eq('user_id', user.id).maybeSingle()
  if (!evt) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

  if (body.done) {
    // Upsert (puede haber sido marcado antes)
    const { error } = await supabase
      .from('user_checklist_progress')
      .upsert({
        user_event_id: body.user_event_id,
        item_key:      body.item_key,
        notes:         body.notes || null,
        done_at:       new Date().toISOString(),
      }, { onConflict: 'user_event_id,item_key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Desmarcar = borrar el registro
    await supabase
      .from('user_checklist_progress')
      .delete()
      .eq('user_event_id', body.user_event_id)
      .eq('item_key', body.item_key)
  }
  return NextResponse.json({ ok: true })
}
