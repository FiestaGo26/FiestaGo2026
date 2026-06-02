import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Endpoint que detecta auth.users con role=provider en su metadata pero SIN
// fila correspondiente en providers (caso "huérfano": signup OK, INSERT del
// provider falló o nunca se ejecutó). Devuelve la lista para que /admin
// pueda mostrarlos y permitir recuperarlos o eliminarlos.
//
// Protegido por header x-admin-token (mismo que /api/admin/test-email).

export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'ADMIN_TOKEN no configurada' }, { status: 503 })
  }
  if (req.headers.get('x-admin-token') !== expected) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 1. Auth users con role=provider en metadata
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  const providerCandidates = (authData?.users || []).filter((u: any) =>
    u.user_metadata?.role === 'provider' || u.raw_user_meta_data?.role === 'provider'
  )

  // 2. Para cada uno, comprobar si existe fila en providers (por email)
  const emails = providerCandidates.map((u: any) => u.email).filter(Boolean)
  if (emails.length === 0) return NextResponse.json({ orphans: [] })

  const { data: providers } = await supabase
    .from('providers')
    .select('email')
    .in('email', emails)

  const providerEmails = new Set((providers || []).map((p: any) => p.email?.toLowerCase()))

  const orphans = providerCandidates
    .filter((u: any) => !providerEmails.has((u.email || '').toLowerCase()))
    .map((u: any) => ({
      auth_user_id:   u.id,
      email:          u.email,
      name_hint:      u.user_metadata?.name || u.raw_user_meta_data?.name || null,
      created_at:     u.created_at,
      email_confirmed_at: u.email_confirmed_at,
    }))
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ orphans, count: orphans.length })
}

// POST recovers an orphan by creating the missing provider row with minimal
// data provided by the admin (name, category, city) and linking it to the
// existing auth user.
export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return NextResponse.json({ error: 'ADMIN_TOKEN no configurada' }, { status: 503 })
  if (req.headers.get('x-admin-token') !== expected) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as any))
  const { auth_user_id, email, name, category, city } = body
  if (!auth_user_id || !email || !name || !category || !city) {
    return NextResponse.json({ error: 'Faltan auth_user_id, email, name, category o city' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Idempotencia: si ya existe la fila, no duplicamos
  const { data: existing } = await supabase
    .from('providers').select('id, email')
    .ilike('email', email.toLowerCase().trim())
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ provider: existing, alreadyExists: true }, { status: 200 })
  }

  // Mismos campos que el INSERT normal de /api/providers para evitar
  // fallos por columnas NOT NULL sin default (terms_*, price_unit, etc.).
  const { TERMS_VERSION_CURRENT } = await import('@/lib/terms')
  const insertPayload: any = {
    name, category, city, email,
    phone:        null,
    website:      null,
    instagram:    null,
    description:  null,
    price_base:   null,
    price_unit:   'por evento',
    specialties:  [],
    source:       'web',
    status:       'pending',
    contactable:  true,
    referred_by:  null,
    self_registered:    true,
    self_registered_at: new Date().toISOString(),
    terms_accepted_at:  new Date().toISOString(),
    terms_version:      TERMS_VERSION_CURRENT,
    terms_accepted_ip:  null,
  }

  const { data, error } = await supabase
    .from('providers')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    console.error('[orphan-providers POST] INSERT failed:', JSON.stringify(error), { email, name })
    return NextResponse.json({
      error:   error.message,
      details: error,
      hint:    'El INSERT falló a nivel BD. Mira details.code y details.message para la causa exacta (constraint, NOT NULL, RLS, etc.).',
      payload: insertPayload,
    }, { status: 500 })
  }

  return NextResponse.json({ provider: data, recovered: true }, { status: 201 })
}

// DELETE removes both the auth user and (if exists) the provider row for a
// given email. Use when the orphan is a duplicate test or bot signup.
export async function DELETE(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return NextResponse.json({ error: 'ADMIN_TOKEN no configurada' }, { status: 503 })
  if (req.headers.get('x-admin-token') !== expected) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const authUserId = searchParams.get('auth_user_id')
  if (!authUserId) return NextResponse.json({ error: 'Falta auth_user_id' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(authUserId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
