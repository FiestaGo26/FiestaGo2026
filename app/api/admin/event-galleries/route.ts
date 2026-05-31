import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80)
}

// GET — todas las galerías (incluso drafts) para el admin
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('event_galleries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ galleries: data })
}

// POST — crear galería nueva
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  if (!body.title || !body.event_type || !body.city || !body.cover_photo_url) {
    return NextResponse.json({ error: 'Faltan campos obligatorios (title, event_type, city, cover_photo_url)' }, { status: 400 })
  }
  const supabase = createAdminClient()
  const slug = slugify(body.title) + '-' + Date.now().toString(36).slice(-4)
  const insertable: any = {
    title:           body.title,
    slug,
    event_type:      body.event_type,
    city:            body.city,
    cover_photo_url: body.cover_photo_url,
    description:     body.description || null,
    date_held:       body.date_held || null,
    guests:          body.guests || null,
    vibe:            body.vibe || null,
    photos:          Array.isArray(body.photos) ? body.photos : [],
    provider_ids:    Array.isArray(body.provider_ids) ? body.provider_ids : [],
    featured:        !!body.featured,
    status:          body.status || 'published',
  }
  const { data, error } = await supabase
    .from('event_galleries')
    .insert(insertable)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ gallery: data }, { status: 201 })
}

// PATCH — actualizar galería
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('event_galleries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ gallery: data })
}

// DELETE — eliminar galería
export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const supabase = createAdminClient()
  const { error } = await supabase.from('event_galleries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
