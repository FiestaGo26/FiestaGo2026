import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || ''

async function claudeCall(system: string, user: string, useWebSearch = false) {
  const body: any = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }],
  }
  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
    body.model = 'claude-sonnet-4-5-20250514' 
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
}

// ── APIFY Instagram scraper ───────────────────────────────────────────────
async function searchInstagram(hashtags: string[], city: string, limit: number) {
  if (!APIFY_TOKEN) return []

  const cityTag = city.toLowerCase().replace(/\s/g, '').replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  const tags = [...hashtags.slice(0,2).map(h => h + cityTag), ...hashtags.slice(0,2)]

  try {
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtags: tags, resultsLimit: limit * 4 }),
      }
    )
    if (!startRes.ok) return []
    const run = await startRes.json()
    const runId = run.data?.id
    if (!runId) return []

    // Poll max 60s
    let status = 'RUNNING'
    let attempts = 0
    while ((status === 'RUNNING' || status === 'READY') && attempts < 15) {
      await new Promise(r => setTimeout(r, 4000))
      const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
      const pd = await poll.json()
      status = pd.data?.status
      attempts++
    }

    if (status !== 'SUCCEEDED') return []

    const datasetId = run.data?.defaultDatasetId
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit * 6}`
    )
    const items = await itemsRes.json()
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

// ── APIFY TikTok scraper ──────────────────────────────────────────────────
async function searchTikTok(hashtags: string[], city: string, limit: number) {
  if (!APIFY_TOKEN) return []

  const cityTag = city.toLowerCase().replace(/\s/g, '').replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  const tags = [...hashtags.slice(0,2).map(h => h + cityTag), hashtags[0]]

  try {
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags: tags,
          resultsPerPage: limit * 3,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          proxyConfiguration: { useApifyProxy: true },
        }),
      }
    )
    if (!startRes.ok) return []
    const run = await startRes.json()
    const runId = run.data?.id
    if (!runId) return []

    let status = 'RUNNING'
    let attempts = 0
    while ((status === 'RUNNING' || status === 'READY') && attempts < 15) {
      await new Promise(r => setTimeout(r, 4000))
      const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
      const pd = await poll.json()
      status = pd.data?.status
      attempts++
    }

    if (status !== 'SUCCEEDED') return []

    const datasetId = run.data?.defaultDatasetId
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit * 6}`
    )
    const items = await itemsRes.json()
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

// ── Extract email from text ───────────────────────────────────────────────
function extractEmail(text: string) {
  if (!text) return ''
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  return m ? m[0] : ''
}

// ── Claude extracts real businesses from social posts ─────────────────────
async function extractFromSocial(posts: any[], platform: string, catObj: any, city: string, count: number) {
  if (!posts.length) return []

  const compact = posts.slice(0, 40).map(p => {
    if (platform === 'instagram') return {
      user:      p.ownerUsername || p.username || '',
      fullName:  p.ownerFullName || p.fullName || '',
      bio:       p.ownerBio || p.biography || '',
      followers: p.ownerFollowersCount || p.followersCount || 0,
      caption:   (p.caption || '').slice(0, 200),
      website:   p.ownerExternalUrl || p.externalUrl || '',
      email:     extractEmail(p.ownerBio || p.biography || p.caption || ''),
    }
    return {
      user:      p.authorMeta?.name || '',
      nickname:  p.authorMeta?.nickName || '',
      followers: p.authorMeta?.fans || 0,
      bio:       p.authorMeta?.signature || '',
      caption:   (p.text || '').slice(0, 200),
      website:   p.authorMeta?.bioLink || '',
      email:     extractEmail(p.authorMeta?.signature || p.text || ''),
    }
  })

  const text = await claudeCall(
    `Eres agente de captación de proveedores para FiestaGo, marketplace de celebraciones en España.
Analiza perfiles de ${platform} y extrae negocios REALES de "${catObj.label}" en ${city}.
Responde SOLO con JSON válido, sin markdown.`,
    `Analiza estos ${compact.length} perfiles de ${platform} y extrae hasta ${count} negocios reales de "${catObj.label}" en ${city} o España.
Solo incluye negocios profesionales (no particulares).

Perfiles:
${JSON.stringify(compact, null, 1)}

Devuelve JSON array:
[{
  "name": "nombre del negocio",
  "type": "tipo específico",
  "city": "${city}",
  "socialHandle": "@username",
  "socialPlatform": "${platform}",
  "socialUrl": "https://${platform === 'instagram' ? 'instagram.com' : 'tiktok.com'}/username",
  "followers": número,
  "email": "email si encontrado en bio, si no vacío",
  "website": "web si encontrada, si no vacío",
  "phone": "teléfono si encontrado, si no vacío",
  "avgPrice": precio estimado en euros,
  "priceUnit": "por evento",
  "description": "descripción basada en su bio",
  "specialties": ["especialidad 1"],
  "strengths": ["tiene X seguidores", "activo en redes"]
}]

Si no hay negocios reales claros devuelve [].`
  )

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) } catch { return [] }
}

// ── Web search fallback ───────────────────────────────────────────────────
async function searchWeb(catObj: any, city: string, count: number) {
  const text = await claudeCall(
    'Agente captación FiestaGo. Busca negocios REALES. Responde SOLO JSON válido.',
    `Busca en internet ${count} proveedores reales de "${catObj.label}" en ${city}, España.
Devuelve JSON array:
[{
  "name":"nombre real","type":"tipo","city":"${city}",
  "email":"","phone":"","website":"","instagram":"",
  "source":"URL donde encontraste info",
  "avgPrice":1200,"priceUnit":"por evento",
  "specialties":["e1"],"description":"desc real basada en lo encontrado",
  "strengths":["s1"]
}]`,
    true // use web search
  )
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) } catch { return [] }
}

// ── Main pipeline ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { category, city, count = 3, tone = 'profesional y cercano', sources = ['instagram', 'tiktok', 'web'] } = await req.json()

  const catObj = CATEGORIES.find(c => c.id === category)
  if (!catObj) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })

  const logs: string[] = []
  const addLog = (msg: string) => { logs.push(msg); console.log('[AGENT]', msg) }

  try {
    addLog(`🤖 Agente iniciado — ${catObj.label} en ${city}`)
    addLog(`🔌 Fuentes: ${sources.join(', ')}`)

    let rawProviders: any[] = []
    const seen = new Set<string>()

    // ── Instagram ──
    if (sources.includes('instagram') && APIFY_TOKEN) {
      addLog(`📸 Buscando en Instagram...`)
      const posts = await searchInstagram([...catObj.hashtags], city, count)
      addLog(`   ${posts.length} posts encontrados`)
      if (posts.length > 0) {
        const igProviders = await extractFromSocial(posts, 'instagram', catObj, city, count)
        igProviders.forEach((p: any) => { p.source = 'instagram' })
        addLog(`   ✅ ${igProviders.length} negocios reales detectados en Instagram`)
        rawProviders.push(...igProviders)
      }
    }

    // ── TikTok ──
    if (sources.includes('tiktok') && APIFY_TOKEN) {
      addLog(`🎵 Buscando en TikTok...`)
      const videos = await searchTikTok([...catObj.tiktokTags], city, count)
      addLog(`   ${videos.length} vídeos encontrados`)
      if (videos.length > 0) {
        const ttProviders = await extractFromSocial(videos, 'tiktok', catObj, city, count)
        ttProviders.forEach((p: any) => { p.source = 'tiktok' })
        addLog(`   ✅ ${ttProviders.length} negocios reales detectados en TikTok`)
        rawProviders.push(...ttProviders)
      }
    }

    // ── Web search ──
    if (sources.includes('web') || rawProviders.length < count) {
      addLog(`🌐 Buscando en internet...`)
      try {
        const webProviders = await searchWeb(catObj, city, count)
        webProviders.forEach((p: any) => { p.source = 'web' })
        addLog(`   ✅ ${webProviders.length} proveedores encontrados en web`)
        rawProviders.push(...webProviders)
      } catch (err: any) {
        addLog(`   ⚠️ Búsqueda web no disponible: ${err.message}`)
      }
    }

    // Deduplicate
    rawProviders = rawProviders.filter(p => {
      const key = (p.name || '').toLowerCase().replace(/\s/g, '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, count * 2)

    if (rawProviders.length === 0) {
      addLog(`❌ No se encontraron proveedores reales`)
      return NextResponse.json({ error: 'No se encontraron proveedores', logs }, { status: 404 })
    }

    addLog(`📊 Total: ${rawProviders.length} proveedores reales encontrados`)
    addLog(`🔬 Cualificando con IA...`)

    // Qualify + generate emails in one call per provider
    const saved = []
    for (const p of rawProviders.slice(0, count)) {
      const qualText = await claudeCall(
        'Analista FiestaGo. Solo JSON válido.',
        `Evalúa este proveedor REAL para FiestaGo:
Nombre: ${p.name} | Cat: ${catObj.label} | Ciudad: ${p.city}
Email: ${p.email ? 'SÍ' : 'NO'} | Web: ${p.website ? 'SÍ' : 'NO'}
Seguidores: ${p.followers || 0} | Fuente: ${p.source}
Desc: ${p.description}

Score A=añadir,B=contactar,C=revisar,D=descartar

{"score":"A","scoreReason":"1 frase","fitScore":8,
"recommendation":"AÑADIR","priority":"ALTA",
"notes":"nota","estimatedConversionProb":70,
"suggestedTag":"Nuevo","missingData":["email"]}`
      )

      const qualMatch = qualText.match(/\{[\s\S]*\}/)
      const qual = qualMatch ? JSON.parse(qualMatch[0]) : {
        score: 'B', recommendation: 'CONTACTAR', priority: 'MEDIA',
        fitScore: 5, scoreReason: 'Sin análisis', notes: '',
        estimatedConversionProb: 40, suggestedTag: 'Nuevo', missingData: [],
      }

      const contactInfo = p.email
        ? `Email: ${p.email}`
        : p.socialHandle
        ? `${p.source}: ${p.socialHandle}`
        : 'sin contacto directo'

      const emailDraft = qual.recommendation !== 'DESCARTAR'
        ? `ASUNTO: ${p.name}, tus primeros clientes te esperan en FiestaGo

Hola ${p.name},

Somos FiestaGo, el nuevo marketplace de celebraciones en España donde parejas y familias encuentran los mejores profesionales para sus eventos.

Hemos encontrado tu negocio${p.source === 'instagram' ? ' en Instagram' : p.source === 'tiktok' ? ' en TikTok' : ''} y creemos que encajas perfectamente con lo que buscan nuestros clientes.

Por qué unirte ahora:

- Registro 100% gratuito, sin permanencia
- Tu primera transacción sin ninguna comisión (0%)
- Solo el 8% desde la segunda venta real
- Acceso a clientes cualificados que ya están buscando tu servicio
- Sin inversión en publicidad, nosotros llevamos el tráfico

Estamos en fase de lanzamiento y estamos seleccionando a los mejores profesionales de ${city} en ${catObj.label}. Las primeras plazas son limitadas.

Regístrate gratis en menos de 5 minutos:
https://fiestago.es/registro-proveedor

¿Tienes dudas? Estamos aquí para ayudarte:
contacto@fiestago.es

Un saludo,
El equipo de FiestaGo`
        : ''

      const { data: savedProvider } = await supabase
        .from('providers')
        .insert({
          name:            p.name,
          category,
          city:            p.city || city,
          email:           p.email || null,
          phone:           p.phone || null,
          website:         p.website || p.socialUrl || null,
          instagram:       p.source === 'instagram' ? p.socialHandle : (p.instagram || null),
          description:     p.description,
          price_base:      p.avgPrice || null,
          price_unit:      p.priceUnit || 'por evento',
          specialties:     p.specialties || [],
          source:          (p.source || 'web') as any,
          status:          'pending',
          tag:             qual.suggestedTag || 'Nuevo',
          agent_score:     (qual.score || 'B').charAt(0).toUpperCase(),
          agent_notes:     qual.notes,
          agent_fit_score: qual.fitScore,
          conversion_prob: qual.estimatedConversionProb,
          outreach_sent:   false,
          outreach_email:  emailDraft,
          social_handle:   p.socialHandle || null,
          social_platform: p.source !== 'web' ? p.source : null,
          followers:       p.followers || 0,
        })
        .select()
        .single()

      saved.push({ ...p, ...qual, id: savedProvider?.id, emailDraft, savedToDb: !!savedProvider })
      addLog(`   ✓ ${p.name} (${p.source}) — Score ${qual.score} | ${p.email || contactInfo}`)
    }

    addLog(``)
    addLog(`🎉 ${saved.length} proveedores reales guardados como pendientes`)
    addLog(`📋 Apruébalos desde el panel para enviar el email de outreach`)

    return NextResponse.json({
      success: true,
      providers: saved,
      stats: {
        found:   rawProviders.length,
        saved:   saved.length,
        withEmail: saved.filter(p => p.email).length,
        instagram: saved.filter(p => p.source === 'instagram').length,
        tiktok:    saved.filter(p => p.source === 'tiktok').length,
        web:       saved.filter(p => p.source === 'web').length,
      },
      logs,
    })

  } catch (err: any) {
    addLog(`❌ Error: ${err.message}`)
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
