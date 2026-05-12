import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailProviderWelcome, emailProviderRejection, emailProviderOutreach } from '@/lib/resend'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// Usa la función compartida emailProviderOutreach de lib/resend.ts
// (mismo diseño HTML que el botón "Enviar email" manual del admin)

// Generación de imagen hero al aprobar (Flux 1.1 Pro)
async function generateProviderImage(provider: any): Promise<string | null> {
  const FAL_KEY = process.env.FAL_KEY
  if (!FAL_KEY) { console.log('[IMG] FAL_KEY no configurada'); return null }

  const categoryHooks: Record<string, string> = {
    foto:       'professional wedding photographer at golden hour, intimate moment',
    catering:   'elegant Spanish wedding banquet on candlelit table',
    espacios:   'luxurious wedding venue at twilight with festoon lights',
    musica:     'wedding DJ booth with ambient golden lighting',
    flores:     'lush wedding floral arrangements with pampas and roses',
    pastel:     'multi-tier elegant wedding cake on marble',
    belleza:    'bride preparation with vintage vanity and flowers',
    animacion:  'joyful wedding guests celebrating with sparklers',
    transporte: 'classic vintage wedding car with floral arrangement',
    papeleria:  'wedding invitation suite on textured paper with wax seal',
    planner:    'wedding planner reviewing details in sunlit Mediterranean venue',
    joyeria:    'gold wedding bands on textile with delicate flowers',
  }

  const baseScene = categoryHooks[provider.category] || categoryHooks.foto
  const prompt = `${baseScene}, ${provider.city || 'Spain'} ambience, golden hour, premium editorial wedding magazine quality, cinematic, 4k, no text or logos`

  try {
    const res = await fetch('https://fal.run/fal-ai/flux-pro/v1.1', {
      method: 'POST',
      headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt, image_size: 'landscape_16_9', num_images: 1, output_format: 'jpeg',
        enable_safety_checker: true, safety_tolerance: '5',
      }),
    })
    const data = await res.json()
    if (!res.ok) { console.error('[IMG] Flux error:', data); return null }
    const url = data.images?.[0]?.url
    if (!url) return null

    // Re-host en Supabase Storage para no depender del CDN de fal.ai
    const supabase = createAdminClient()
    const imgRes = await fetch(url)
    if (!imgRes.ok) return url // fallback al CDN externo
    const buf = Buffer.from(await imgRes.arrayBuffer())
    const path = `providers/${provider.id}/hero.jpg`
    const { error: upErr } = await supabase.storage
      .from('social-posts')
      .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
    if (upErr) { console.error('[IMG] Storage:', upErr); return url }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/social-posts/${path}`
    return publicUrl
  } catch (err) {
    console.error('[IMG]', err)
    return null
  }
}

// GET /api/admin/providers
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const category = searchParams.get('category')
  const city     = searchParams.get('city')
  const search   = searchParams.get('search')
  const limit    = parseInt(searchParams.get('limit') || '100')

  let query = supabase
    .from('providers').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status)   query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (city)     query = query.eq('city', city)
  if (search)   query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ providers: data })
}

// PATCH /api/admin/providers
//
// Distingue dos flujos al cambiar status a "approved":
//
// 1. RECRUITMENT (prospect del agente, primera vez):
//    Si tiene outreach_email draft Y outreach_sent=false → manda outreach,
//    deja pending y marca outreach_sent=true. NO se aprueba todavía.
//
// 2. APPROVAL REAL (proveedor que se autoregistró o ya contactaste):
//    No tiene outreach pendiente → aprueba de verdad, envía email bienvenida,
//    genera imagen hero con fal.ai, lo hace visible en marketplace.
//
// Al cambiar status a "rejected" → email de rechazo.
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const result: any = { ok: true }

  // Cargar provider actual para decidir flujo
  const { data: current } = await supabase.from('providers').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

  // ── APROBAR ──
  if (updates.status === 'approved') {
    const isRecruitment = !!(current.outreach_email && !current.outreach_sent)

    if (isRecruitment) {
      // Flow 1: enviar outreach con el diseño completo (HTML + sello + List-Unsubscribe), mantener pending
      const sent = await emailProviderOutreach(current)
      if (sent.ok) {
        updates.status        = 'pending'
        updates.outreach_sent = true
        updates.outreach_at   = new Date().toISOString()
        updates.tag           = 'Contactado'
        result.flow = 'outreach_sent'
      } else {
        result.flow = 'outreach_failed'
        result.outreachError = sent.error
      }
    } else {
      // Flow 2: aprobación real
      result.flow = 'approval'
      // Welcome email (no bloquea si falla)
      const welcome = await emailProviderWelcome(current)
      result.welcomeEmail = welcome.ok

      // Generar imagen hero (no bloquea si falla)
      try {
        const imgUrl = await generateProviderImage(current)
        if (imgUrl) {
          updates.photo_url = imgUrl
          result.imageGenerated = true
        }
      } catch (err: any) {
        console.error('[APPROVE]', err.message)
      }
    }
  }

  // ── RECHAZAR ──
  if (updates.status === 'rejected') {
    const reason = updates.rejected_reason || ''
    const sent = await emailProviderRejection(current, reason)
    result.rejectionEmail = sent.ok
  }

  // Update final
  const { data, error } = await supabase
    .from('providers').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ provider: data, ...result })
}

export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const { error } = await supabase.from('providers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
