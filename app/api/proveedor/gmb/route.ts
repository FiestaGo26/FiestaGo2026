import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { generateGmbPost } from '@/lib/gmb-generator'

export const runtime = 'nodejs'
export const maxDuration = 45
export const dynamic = 'force-dynamic'

// GET /api/proveedor/gmb?providerId=XXX
// Lista los posts + settings del proveedor (URL del dashboard + toggle
// de recordatorios semanales). Todo en un solo GET para que el tab lo
// pinte sin llamadas extra.
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('providerId')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const supabase = createAdminClient()

  const [postsRes, provRes] = await Promise.all([
    supabase
      .from('provider_gmb_posts')
      .select('id, topic, body, cta_label, cta_url, status, published_at, created_at')
      .eq('provider_id', providerId!)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('providers')
      .select('google_business_url, gmb_weekly_reminders_enabled')
      .eq('id', providerId!)
      .maybeSingle(),
  ])
  if (postsRes.error) return NextResponse.json({ error: postsRes.error.message }, { status: 500 })

  return NextResponse.json({
    posts: postsRes.data || [],
    settings: {
      google_business_url:          provRes.data?.google_business_url          ?? null,
      gmb_weekly_reminders_enabled: provRes.data?.gmb_weekly_reminders_enabled ?? true,
    },
  })
}

// PUT /api/proveedor/gmb — actualiza settings del proveedor.
// body: { providerId, google_business_url?, gmb_weekly_reminders_enabled? }
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const update: Record<string, any> = {}
  if ('google_business_url' in body) {
    const raw = (body.google_business_url || '').toString().trim()
    // Solo aceptamos URLs de business.google.com/… (evita phishing y typos)
    if (raw && !/^https?:\/\/([\w-]+\.)?business\.google\.com\//i.test(raw)) {
      return NextResponse.json({
        error: 'La URL debe empezar por https://business.google.com/…',
      }, { status: 400 })
    }
    update.google_business_url = raw || null
  }
  if ('gmb_weekly_reminders_enabled' in body) {
    update.gmb_weekly_reminders_enabled = !!body.gmb_weekly_reminders_enabled
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('providers').update(update).eq('id', providerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, settings: update })
}

// POST /api/proveedor/gmb — genera un nuevo post IA y lo guarda como draft.
// body: { providerId, topic }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const topic: string = (body.topic || '').toString().trim()
  if (topic.length < 5) {
    return NextResponse.json({ error: 'El tema debe tener al menos 5 caracteres' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: provider, error: pErr } = await supabase
    .from('providers').select('name, category, city, slug, email')
    .eq('id', providerId).single()
  if (pErr || !provider) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }

  try {
    const post = await generateGmbPost({ provider: provider as any, topic })
    const { data: row, error: insErr } = await supabase
      .from('provider_gmb_posts').insert({
        provider_id: providerId,
        topic,
        body:      post.body,
        cta_label: post.ctaLabel,
        cta_url:   post.ctaUrl,
        status:    'draft',
      })
      .select('id, body, cta_label, cta_url, created_at')
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      ...row,
      hashtagsHint: post.hashtagsHint,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error generando' }, { status: 500 })
  }
}

// PATCH — marca como copiado o publicado. body: { providerId, id, status }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  if (!body.id || !['copied', 'published'].includes(body.status)) {
    return NextResponse.json({ error: 'id y status válido requeridos' }, { status: 400 })
  }
  const supabase = createAdminClient()
  const update: any = { status: body.status }
  if (body.status === 'published') update.published_at = new Date().toISOString()
  const { error } = await supabase.from('provider_gmb_posts')
    .update(update).eq('id', body.id).eq('provider_id', providerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/proveedor/gmb?providerId=X&id=Y
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const providerId = url.searchParams.get('providerId')
  const id         = url.searchParams.get('id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const supabase = createAdminClient()
  const { error } = await supabase.from('provider_gmb_posts')
    .delete().eq('id', id).eq('provider_id', providerId!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
