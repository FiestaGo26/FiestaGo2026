import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'
import { buildEmailDraft, buildDmDraft } from '@/lib/outreach'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// Versión RÁPIDA del agente que cabe en el timeout de Netlify (10-26s).
// Hace una sola llamada a Claude Sonnet con la herramienta web_search,
// le pide que devuelva JSON con los proveedores encontrados, y los guarda.
//
// Para captación masiva (10×12 combinaciones) sigue usando el script local
// `fiegago-agent.mjs` que NO tiene limite de tiempo.

async function claudeWebSearch(prompt: string): Promise<string> {
  // Margen ajustado: maxDuration de la function es 30s, dejamos 27s
  // para Claude + 3s de slack para enviar la respuesta.
  const controller = new AbortController()
  const tick = setTimeout(() => controller.abort(), 27_000)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2200,
        // max_uses bajado de 4 → 2 para acotar latencia. Con 2 búsquedas
        // Claude tiene suficiente para encontrar 1-3 proveedores reales.
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message || 'Claude error')
    return (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Búsqueda demasiado lenta. Prueba con menos proveedores (1-2) o reintenta — a veces Google tarda.')
    }
    throw err
  } finally {
    clearTimeout(tick)
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const logs: string[] = []
  const log = (m: string) => { logs.push(m) }

  try {
    const body = await req.json().catch(() => ({}))
    let { category = 'foto', city = 'Madrid', count = 2 } = body
    // Capear a 3 para que entre con margen en el timeout (30s).
    // Si quieres 10 proveedores, lanza la búsqueda 4-5 veces — es más
    // fiable que pedirle muchos a la vez.
    count = Math.min(Math.max(parseInt(String(count)) || 2, 1), 3)
    const cat = CATEGORIES.find(c => c.id === category)
    if (!cat) {
      return NextResponse.json({ error: 'Categoría inválida', logs }, { status: 400 })
    }

    log(`🤖 Agente rápido — ${cat.label} en ${city}`)
    log(`🌐 Buscando ${count} proveedores reales en Google...`)

    const prompt = `Busca ${count} negocios profesionales reales de "${cat.label}" en ${city}, España.

REGLA INNEGOCIABLE: cada negocio DEBE tener email REAL (con @) o handle de Instagram (@usuario). Si no tiene ninguno, NO lo incluyas. Mejor menos que sin contacto.

Devuelve SOLO este JSON, sin texto extra:
[{"name":"","email":"","phone":"","website":"","instagram":"@","description":"","avgPrice":0,"city":"${city}","specialties":[]}]`

    const text = await claudeWebSearch(prompt)
    log(`✅ Búsqueda completada`)

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      log(`⚠️ No se pudo extraer JSON de la respuesta`)
      return NextResponse.json({ error: 'No se encontraron proveedores en formato válido', logs }, { status: 200 })
    }

    let providers: any[] = []
    try {
      providers = JSON.parse(match[0])
    } catch (e) {
      log(`⚠️ JSON inválido en respuesta`)
      return NextResponse.json({ error: 'Formato JSON inválido', logs }, { status: 200 })
    }

    if (!providers.length) {
      log(`❌ Sin resultados`)
      return NextResponse.json({ providers: [], logs, stats: { found: 0, saved: 0 } })
    }

    // Filtro DURO: solo proveedores con email o Instagram. Sin canal de contacto
    // no podemos hacer outreach automatizado.
    const beforeFilter = providers.length
    providers = providers.filter((p: any) => {
      const hasEmail = typeof p.email === 'string' && p.email.includes('@') && p.email.length > 5
      const ig       = (p.instagram || '').toString().trim()
      const hasIg    = ig.length > 1 && ig !== '@'
      return hasEmail || hasIg
    })
    const rejected = beforeFilter - providers.length
    if (rejected > 0) log(`🚫 ${rejected} descartados (sin email ni Instagram)`)

    if (!providers.length) {
      log(`❌ Ningún proveedor con contacto válido`)
      return NextResponse.json({ providers: [], logs, stats: { found: beforeFilter, saved: 0, rejected } })
    }

    log(`📊 ${providers.length} proveedores válidos. Guardando en Supabase...`)

    const supabase = createAdminClient()
    const saved: any[] = []
    for (const p of providers) {
      const email = p.email || null
      const phone = p.phone || null
      const websiteRaw = p.website || ''
      const isSocial = /instagram\.com|tiktok\.com/i.test(websiteRaw)
      const website = (websiteRaw && !isSocial) ? websiteRaw : null
      const instagram = p.instagram || null
      const contactable = !!(email || phone || website || instagram)

      // Drafts de outreach (email + DM) — plantillas en lib/outreach.ts
      const provLike = { name: p.name, city, source: 'web' }
      const emailDraft = email     ? buildEmailDraft(provLike) : ''
      const dmDraft    = instagram ? buildDmDraft(provLike)    : ''

      const { data: row } = await supabase
        .from('providers')
        .insert({
          name:            p.name,
          category:        category,
          city:            p.city || city,
          email,
          phone,
          website,
          instagram,
          description:     p.description || '',
          price_base:      p.avgPrice || null,
          price_unit:      'por evento',
          specialties:     p.specialties || [],
          source:          'web',
          status:          'pending',
          tag:             'Nuevo',
          contactable,
          outreach_sent:   false,
          outreach_email:  emailDraft,
          outreach_dm:     dmDraft,
        })
        .select()
        .single()

      saved.push({ ...p, id: row?.id, savedToDb: !!row, score: 'A', emailDraft })
      log(`   ✓ ${p.name} | ${email || instagram || 'sin contacto directo'}`)
    }

    log(``)
    log(`🎉 ${saved.length} proveedores guardados como pendientes`)
    log(`📋 Apruébalos desde el panel para enviar el outreach`)

    return NextResponse.json({
      success: true,
      providers: saved,
      stats: {
        found: providers.length,
        saved: saved.length,
        withEmail:     saved.filter((p: any) => p.email).length,
        withInstagram: saved.filter((p: any) => p.instagram).length,
        web: saved.length,
      },
      logs,
    })
  } catch (err: any) {
    log(`❌ Error: ${err.message}`)
    return NextResponse.json({ error: err.message, logs }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('agent_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  return NextResponse.json({ sessions: data || [] })
}
