import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth, getAuthUser, isAdminRequest } from '@/lib/auth'

// Lista blanca de campos que el proveedor puede modificar en su perfil.
// status, featured, verified, verification_status, agent_*, outreach_* y
// otros campos de control NO entran — esos los gestiona el admin.
const ALLOWED_FIELDS = new Set([
  'name', 'phone', 'website', 'instagram', 'description', 'short_desc',
  'price_base', 'price_unit', 'specialties', 'photo_url',
  'auto_reply_message', 'reply_templates',
])

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id    = searchParams.get('id')
  const email = searchParams.get('email')

  if (!id && !email) {
    return NextResponse.json({ error: 'ID o email requerido' }, { status: 400 })
  }

  // Autenticación: admin OK, o el propio proveedor (sesión Supabase).
  if (!isAdminRequest(req)) {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const targetEmail = email || (
      id ? (await supabase.from('providers').select('email').eq('id', id).maybeSingle()).data?.email : null
    )
    if (!targetEmail || (user.email || '').toLowerCase() !== String(targetEmail).toLowerCase()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  let query = supabase.from('providers').select('*')

  if (id)         query = query.eq('id', id)
  else if (email) query = query.ilike('email', email.toLowerCase().trim())

  const { data: provider, error } = await query.single()

  if (error || !provider) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }

  // Parse services stored in agent_notes
  let services = []
  try {
    const notes = provider.agent_notes || ''
    if (notes.includes('services:')) {
      services = JSON.parse(notes.split('services:')[1].split('|')[0])
    }
  } catch {}

  return NextResponse.json({ provider, services })
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...rawUpdates } = body

  const auth = await requireProviderAuth(req, id)
  if (!auth.ok) return auth.response

  // Filtrar a campos editables. Cualquier campo fuera de ALLOWED_FIELDS
  // se ignora (esto incluye status, featured, verified, etc).
  const updates: Record<string, any> = {}
  for (const [k, v] of Object.entries(rawUpdates)) {
    if (ALLOWED_FIELDS.has(k)) updates[k] = v
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('providers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ provider: data })
}
