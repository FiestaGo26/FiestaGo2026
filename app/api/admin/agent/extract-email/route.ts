import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { extractEmailFromWeb } from '@/lib/extract-email'
import { buildEmailDraft } from '@/lib/outreach'
import { emailProviderOutreach } from '@/lib/resend'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST /api/admin/agent/extract-email
// body: { provider_id } o { batch: true } para procesar todos con tag
//       "Investigar web" en una sola pasada (cap a 8 por timeout).
//
// Para cada proveedor sin email pero con web, fetcha la web e intenta
// extraer email. Si lo encuentra: actualiza el proveedor, genera el
// draft de outreach, lo manda automáticamente y cambia tag a
// "Contactado por email".
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  // Cargar candidatos
  let candidates: any[] = []
  if (body.provider_id) {
    const { data } = await supabase
      .from('providers')
      .select('id, name, website, email, city, source')
      .eq('id', body.provider_id)
      .single()
    if (data) candidates = [data]
  } else if (body.batch) {
    const { data } = await supabase
      .from('providers')
      .select('id, name, website, email, city, source')
      .is('email', null)
      .not('website', 'is', null)
      .in('tag', ['Investigar web', 'Nuevo'])
      .eq('status', 'pending')
      .limit(8)
    candidates = data || []
  } else {
    return NextResponse.json({ error: 'provider_id o batch=true requerido' }, { status: 400 })
  }

  const results: any[] = []
  let extracted = 0
  let emailsSent = 0

  for (const p of candidates) {
    if (!p.website) {
      results.push({ id: p.id, name: p.name, status: 'sin-web' })
      continue
    }
    if (p.email) {
      results.push({ id: p.id, name: p.name, status: 'ya-tiene-email', email: p.email })
      continue
    }

    const found = await extractEmailFromWeb(p.website)
    if (!found) {
      results.push({ id: p.id, name: p.name, status: 'no-encontrado', website: p.website })
      // Marcar como ya intentado (cambiar tag para no reintentar en bucle)
      await supabase.from('providers')
        .update({ tag: 'Investigar manualmente' })
        .eq('id', p.id)
      continue
    }

    extracted++

    // Comprobar que el email no existe ya en otro proveedor (dedupe)
    const { count: dup } = await supabase
      .from('providers')
      .select('id', { count: 'exact', head: true })
      .eq('email', found.email)
      .neq('id', p.id)
    if ((dup || 0) > 0) {
      results.push({ id: p.id, name: p.name, status: 'email-duplicado', email: found.email })
      // Lo dejamos sin actualizar (otro proveedor ya tiene ese email)
      await supabase.from('providers')
        .update({ tag: 'Investigar manualmente' })
        .eq('id', p.id)
      continue
    }

    // Actualizar el proveedor con el email + draft de outreach
    const draft = buildEmailDraft({ name: p.name, city: p.city, source: p.source || 'web' })
    await supabase.from('providers')
      .update({
        email:          found.email,
        outreach_email: draft,
        tag:            'Nuevo',
      })
      .eq('id', p.id)

    // Disparar outreach automático (igual que el cron). No bloquea respuesta.
    const send = await emailProviderOutreach({ ...p, email: found.email, outreach_email: draft })
    if (send.ok) {
      emailsSent++
      await supabase.from('providers')
        .update({
          outreach_sent: true,
          outreach_at:   new Date().toISOString(),
          tag:           'Contactado por email',
          contacted_via: 'email',
        })
        .eq('id', p.id)
    }

    results.push({
      id:     p.id,
      name:   p.name,
      status: send.ok ? 'extraido-y-contactado' : 'extraido',
      email:  found.email,
      source: found.source,
    })
  }

  return NextResponse.json({
    processed:   candidates.length,
    extracted,
    emailsSent,
    results,
  })
}
