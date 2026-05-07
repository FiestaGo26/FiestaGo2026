import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/services?provider_id=...
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const providerId = searchParams.get('provider_id')
  if (!providerId) return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('provider_services')
    .select('*')
    .eq('provider_id', providerId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ services: data || [] })
}

// POST /api/proveedor/services
// body: { provider_id, name, description, price, price_unit, duration, max_guests, media_type, media_url }
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  if (!body.provider_id || !body.name) {
    return NextResponse.json({ error: 'provider_id y name requeridos' }, { status: 400 })
  }
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
      status:        'active',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ service: data }, { status: 201 })
}

// PATCH /api/proveedor/services
// body: { id, ...updates }
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  updates.updated_at = new Date().toISOString()
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

  // Borrar el archivo de Storage si existía
  const { data: svc } = await supabase
    .from('provider_services').select('media_url').eq('id', id).single()
  if (svc?.media_url) {
    const m = svc.media_url.match(/\/provider-media\/(.+)$/)
    if (m) await supabase.storage.from('provider-media').remove([m[1]]).catch(() => {})
  }

  const { error } = await supabase.from('provider_services').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
