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

// Ángulos de búsqueda — rota para descubrir long-tail.
const SEARCH_ANGLES = [
  'recién abiertos en los últimos 2 años',
  'pequeños y boutique con menos de 10 trabajadores',
  'con presencia activa en Instagram (cuentas con >1.000 seguidores)',
  'especializados en bodas íntimas o pequeños eventos',
  'enfocados en cumpleaños infantiles o comuniones',
  'especializados en eventos corporativos o despedidas',
  'que aparecen en blogs o medios locales del sector eventos',
  'con buen ratio calidad-precio (no los más caros del mercado)',
  'recomendados en grupos de Facebook de novias o foros de bodas',
  'que trabajan también en pueblos y áreas alrededor de la ciudad',
]

async function claudeWebSearch(prompt: string, maxUses: number = 4, attempt: number = 0): Promise<string> {
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
        model: 'claude-haiku-4-5',
        max_tokens: 1800,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }],
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    const data = await res.json()
    if (data.error) {
      const msg = data.error.message || ''
      const isRateLimit = /rate.?limit|exceed.*tokens|429/i.test(msg)
      if (isRateLimit && attempt === 0) {
        clearTimeout(tick)
        await new Promise(r => setTimeout(r, 35_000))
        return claudeWebSearch(prompt, maxUses, 1)
      }
      throw new Error(msg || 'Claude error')
    }
    return (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Búsqueda demasiado lenta. Prueba con menos proveedores o reintenta.')
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
    count = Math.min(Math.max(parseInt(String(count)) || 2, 1), 3)
    const cat = CATEGORIES.find(c => c.id === category)
    if (!cat) return NextResponse.json({ error: 'Categoría inválida', logs }, { status: 400 })

    const supabase = createAdminClient()

    // 1. Pre-cargar exclusión: hasta 80 nombres + IG ya existentes en
    //    (categoría, ciudad). Le pasamos a Claude los primeros 20 en el
    //    prompt para que sepa que NO los repita.
    const { data: existing } = await supabase
      .from('providers')
      .select('name, instagram')
      .eq('category', category)
      .ilike('city', `%${city.split(' ')[0]}%`)
      .limit(80)
    const existingNames = (existing || []).map((p: any) => p.name).filter(Boolean)
    const existingIg    = (existing || []).map((p: any) => p.instagram).filter(Boolean)

    // 2. Elegir ángulo de búsqueda variado según día + categoría
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    const catHash   = category.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
    const angleIdx  = (dayOfYear * 7 + catHash) % SEARCH_ANGLES.length
    const angle     = SEARCH_ANGLES[angleIdx]

    log(`🤖 Agente — ${cat.label} en ${city} (count=${count})`)
    log(`🎯 Ángulo: ${angle}`)
    log(`🚫 Excluyendo ${existingNames.length} ya conocidos del prompt`)

    // 3. Overprovision: pedimos 3× para que tras filtrar sobrevivan
    const overprovision = Math.min(count * 3, 9)

    const exclusionBlock = existingNames.length > 0
      ? `\n\nYA TENEMOS ESTOS NEGOCIOS (NO los repitas, busca DISTINTOS):\n${existingNames.slice(0, 20).join(', ')}`
      : ''

    const prompt = `Eres un investigador buscando negocios profesionales de eventos en España. NO uses los nombres más conocidos ni los top resultados de Google. Tu trabajo es encontrar el LONG-TAIL: negocios reales pero menos visibles.

Necesito hasta ${overprovision} negocios de "${cat.label}" en ${city} (incluye pueblos, barrios y provincia), ${angle}.

REGLAS:
1. Cada negocio DEBE tener email REAL (con @) O handle de Instagram (@usuario). Si no tiene ninguno, NO lo incluyas.
2. Busca en Google Maps, en Instagram con hashtags locales (#${cat.id}valencia, #bodasvalencia…), en Páginas Amarillas y en directorios locales (Bodas.net, Zankyou).
3. Si encuentras un perfil de Instagram activo, considéralo aunque no tenga web — el handle @ es contacto válido.
4. Mira páginas 2-3 de los resultados, no solo la primera.
5. Considera autónomos, negocios pequeños, recién abiertos, cuentas IG con menos de 5.000 seguidores.${exclusionBlock}

Devuelve SOLO este JSON (mínimo 1, máximo ${overprovision} resultados), sin texto extra:
[{"name":"","email":"","phone":"","website":"","instagram":"@","description":"","avgPrice":0,"city":"${city}","specialties":[]}]`

    const text = await claudeWebSearch(prompt, 4)
    log(`✅ Búsqueda completada`)

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      log(`⚠️ No se pudo extraer JSON de la respuesta`)
      return NextResponse.json({ error: 'No se encontraron proveedores en formato válido', logs }, { status: 200 })
    }

    let providers: any[] = []
    try { providers = JSON.parse(match[0]) }
    catch { log(`⚠️ JSON inválido`); return NextResponse.json({ error: 'Formato JSON inválido', logs }, { status: 200 }) }

    log(`📦 Claude devolvió ${providers.length}`)

    if (!providers.length) {
      return NextResponse.json({ providers: [], logs, stats: { found: 0, saved: 0 } })
    }

    // Filtro: email/IG válido + no presente en exclusión local
    const beforeFilter = providers.length
    providers = providers.filter((p: any) => {
      const hasEmail = typeof p.email === 'string' && p.email.includes('@') && p.email.length > 5
      const ig       = (p.instagram || '').toString().trim()
      const hasIg    = ig.length > 1 && ig !== '@'
      if (!hasEmail && !hasIg) return false

      const nameLow = (p.name || '').toLowerCase().trim()
      if (existingNames.some((n: string) => n.toLowerCase() === nameLow)) return false
      if (hasIg && existingIg.some((n: string) => n === ig)) return false
      return true
    })
    log(`✂️  Tras filtrar contacto + exclusión local: ${providers.length}`)

    if (!providers.length) {
      log(`❌ Sin proveedores nuevos. Esta categoría/ciudad puede estar saturada.`)
      return NextResponse.json({ providers: [], logs, stats: { found: beforeFilter, saved: 0 } })
    }

    // Sortear por calidad: email > IG, y limitar al count solicitado
    providers.sort((a: any, b: any) => {
      const aScore = (a.email ? 10 : 0) + (a.instagram ? 5 : 0)
      const bScore = (b.email ? 10 : 0) + (b.instagram ? 5 : 0)
      return bScore - aScore
    })
    providers = providers.slice(0, count)

    log(`📊 ${providers.length} proveedores válidos. Guardando en Supabase...`)

    const saved: any[] = []
    let skippedDup = 0
    for (const p of providers) {
      const email = p.email || null
      const phone = p.phone || null
      const websiteRaw = p.website || ''
      const isSocial = /instagram\.com|tiktok\.com/i.test(websiteRaw)
      const website = (websiteRaw && !isSocial) ? websiteRaw : null
      const instagram = p.instagram || null
      const contactable = !!(email || phone || website || instagram)

      // Dedupe final contra BD (por si entró entre nuestra carga local y ahora)
      if (email || instagram) {
        const orParts: string[] = []
        if (email)     orParts.push(`email.eq.${email}`)
        if (instagram) orParts.push(`instagram.eq.${instagram}`)
        const { count: existingCount } = await supabase
          .from('providers')
          .select('id', { count: 'exact', head: true })
          .or(orParts.join(','))
        if ((existingCount || 0) > 0) { skippedDup++; continue }
      }

      const provLike = { name: p.name, city, source: 'web' }
      const emailDraft = email     ? buildEmailDraft(provLike) : ''
      const dmDraft    = instagram ? buildDmDraft(provLike)    : ''

      const { data: row } = await supabase
        .from('providers')
        .insert({
          name:            p.name,
          category:        category,
          city:            p.city || city,
          email, phone, website, instagram,
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
        .select().single()

      saved.push({ ...p, id: row?.id, savedToDb: !!row, score: 'A', emailDraft })
      log(`   ✓ ${p.name} | ${email || instagram || 'sin contacto directo'}`)
    }

    log(``)
    if (skippedDup > 0) log(`♻️  ${skippedDup} duplicados saltados (ya estaban)`)
    log(`🎉 ${saved.length} proveedores guardados como pendientes`)
    log(`📋 Apruébalos desde el panel para enviar el outreach`)

    return NextResponse.json({
      success: true,
      providers: saved,
      stats: {
        found:    providers.length,
        saved:    saved.length,
        skippedDup,
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
