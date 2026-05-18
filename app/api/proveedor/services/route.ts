import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_FIELDS = new Set([
  'name', 'description', 'price', 'price_unit', 'duration', 'max_guests',
  'media_type', 'media_url', 'thumbnail_url', 'status', 'sort_order',
  'cancellation_policy', 'addons',
])

// GET /api/proveedor/services?provider_id=...
// Listado público de servicios de un proveedor (lo consume también la
// ficha pública /proveedores/[id]). No expone contactos.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const providerId = searchParams.get('provider_id')
  if (!providerId) return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('provider_services')
    .select('*, service_media(id, url, thumbnail_url, media_type, sort_order, is_primary)')
    .eq('provider_id', providerId!)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const services = (data || []).map((s: any) => ({
    ...s,
    media: (s.service_media || []).sort((a: any, b: any) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
      return (a.sort_order || 0) - (b.sort_order || 0)
    }),
    service_media: undefined,
  }))

  return NextResponse.json({ services })
}

// POST /api/proveedor/services
export async function POST(req: NextRequest) {
  const body = await req.json()
  const auth = await requireProviderAuth(req, body.provider_id)
  if (!auth.ok) return auth.response
  if (!body.name) return NextResponse.json({ error: 'name requerido' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('provider_services')
    .insert({
      provider_id:   body.provider_id,
      name:          body.name,
      description:   body.description || null,
      price:         body.price ? Number(body.price) : null,
      price_unit:    body.price_unit || 'por evento',
      duration:      body.duration || null,
      max_guests:    body.max_guests ? Number(body.max_guests) : null,
      media_type:    body.media_type || 'none',
      media_url:     body.media_url || null,
      thumbnail_url: body.thumbnail_url || null,
      cancellation_policy: body.cancellation_policy || 'moderate',
      addons:        Array.isArray(body.addons) ? body.addons : [],
      status:        'active',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ service: data }, { status: 201 })
}

// PATCH /api/proveedor/services — solo el dueño del servicio
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...rawUpdates } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { data: svc } = await supabase
    .from('provider_services').select('provider_id').eq('id', id).maybeSingle()
  if (!svc) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const auth = await requireProviderAuth(req, svc.provider_id)
  if (!auth.ok) return auth.response

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(rawUpdates)) {
    if (ALLOWED_FIELDS.has(k)) updates[k] = v
  }

  const { data, error } = await supabase
    .from('provider_services').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ service: data })
}

// DELETE /api/proveedor/services?id=...
export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { data: svc } = await supabase
    .from('provider_services').select('media_url, provider_id').eq('id', id).single()
  if (!svc) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const auth = await requireProviderAuth(req, svc.provider_id)
  if (!auth.ok) return auth.response

  if (svc.media_url) {
    const m = svc.media_url.match(/\/provider-media\/(.+)$/)
    if (m) await supabase.storage.from('provider-media').remove([m[1]]).catch(() => {})
  }

  const { error } = await supabase.from('provider_services').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
