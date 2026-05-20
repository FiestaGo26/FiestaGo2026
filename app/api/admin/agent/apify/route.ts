import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'
import { buildDmDraft } from '@/lib/outreach'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// Apify acepta ambas envs por compatibilidad con la documentación
// anterior del .env.example.
function apifyToken(): string | null {
  return process.env.APIFY_API_KEY || process.env.APIFY_API_TOKEN || null
}

// Actor de Apify usado: 'apify/instagram-hashtag-scraper'.
// Devuelve posts de un hashtag con ownerUsername, caption, etc.
const APIFY_ACTOR = 'apify~instagram-hashtag-scraper'

// POST /api/admin/agent/apify
// body: { hashtag, category, city, limit? }
// Lanza el actor de Apify y devuelve el runId. El scrapeo es async (2-5
// min), así que el cliente debe llamar a GET /api/admin/agent/apify?runId=
// para poll del estado e importar cuando termine.
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = apifyToken()
  if (!token) return NextResponse.json({ error: 'Falta APIFY_API_KEY en env' }, { status: 500 })

  const { hashtag, category, city, limit = 50 } = await req.json().catch(() => ({}))
  if (!hashtag || !category || !city) {
    return NextResponse.json({ error: 'hashtag, category y city requeridos' }, { status: 400 })
  }

  const cleanHashtag = String(hashtag).replace(/^#/, '').trim()
  if (!cleanHashtag) return NextResponse.json({ error: 'hashtag vacío' }, { status: 400 })

  const apifyInput = {
    hashtags:      [cleanHashtag],
    resultsLimit:  Math.min(Math.max(parseInt(String(limit)), 10), 200),
    resultsType:   'posts',
    searchType:    'hashtag',
  }

  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
    },
  )
  const data = await res.json()
  if (!res.ok || !data?.data?.id) {
    return NextResponse.json({
      error: data?.error?.message || `Apify error ${res.status}`,
      detail: data,
    }, { status: 500 })
  }

  return NextResponse.json({
    runId:           data.data.id,
    status:          data.data.status,
    defaultDatasetId: data.data.defaultDatasetId,
    hashtag:         cleanHashtag,
    category,
    city,
  })
}

// GET /api/admin/agent/apify?runId=...
// Consulta estado del run. Si está SUCCEEDED, devuelve los items extraídos
// (no los importa; el import es POST a /import abajo).
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = apifyToken()
  if (!token) return NextResponse.json({ error: 'Falta APIFY_API_KEY en env' }, { status: 500 })

  const runId = new URL(req.url).searchParams.get('runId')
  if (!runId) return NextResponse.json({ error: 'runId requerido' }, { status: 400 })

  const runRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`,
  )
  const runData = await runRes.json()
  if (!runRes.ok || !runData?.data) {
    return NextResponse.json({ error: 'Run no encontrado', detail: runData }, { status: 404 })
  }

  const status = runData.data.status as string
  const stats = {
    runId,
    status,
    startedAt:  runData.data.startedAt,
    finishedAt: runData.data.finishedAt,
    itemsRead:  runData.data?.stats?.outputBodySize || 0,
  }

  if (status !== 'SUCCEEDED') {
    return NextResponse.json(stats)
  }

  // Run terminado: leer dataset
  const datasetId = runData.data.defaultDatasetId
  const dsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=500`,
  )
  const items = await dsRes.json()

  // Extraer perfiles únicos
  const usernames = new Map<string, any>()
  for (const item of (Array.isArray(items) ? items : [])) {
    const u = item.ownerUsername || item.username
    if (!u || u.length < 2) continue
    if (usernames.has(u)) continue
    usernames.set(u, {
      username:     u,
      fullName:     item.ownerFullName || item.fullName || null,
      caption:      item.caption || null,
      postUrl:      item.url || null,
    })
  }

  return NextResponse.json({
    ...stats,
    accountsFound: usernames.size,
    accounts:      Array.from(usernames.values()),
  })
}

// PATCH /api/admin/agent/apify
// body: { runId, category, city, usernames? }
// Importa los proveedores. Si usernames se pasa, usa ese subset. Si no,
// trae el dataset completo del run.
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = apifyToken()
  if (!token) return NextResponse.json({ error: 'Falta APIFY_API_KEY en env' }, { status: 500 })

  const { runId, category, city, usernames } = await req.json().catch(() => ({}))
  if (!runId || !category || !city) {
    return NextResponse.json({ error: 'runId, category y city requeridos' }, { status: 400 })
  }
  const cat = CATEGORIES.find(c => c.id === category)
  if (!cat) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })

  // 1. Reunir las cuentas a importar
  let accounts: Array<{ username: string; fullName: string | null }> = []

  if (Array.isArray(usernames) && usernames.length > 0) {
    accounts = usernames.map((u: any) => typeof u === 'string'
      ? { username: u.replace(/^@/, ''), fullName: null }
      : { username: String(u.username || '').replace(/^@/, ''), fullName: u.fullName || null }
    ).filter(a => a.username)
  } else {
    // Si no se pasa lista, recogemos todo el dataset del run
    const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
    const runData = await runRes.json()
    const datasetId = runData?.data?.defaultDatasetId
    if (!datasetId) return NextResponse.json({ error: 'Dataset no disponible' }, { status: 400 })
    const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=500`)
    const items = await dsRes.json()
    const seen = new Set<string>()
    for (const it of (Array.isArray(items) ? items : [])) {
      const u = (it.ownerUsername || it.username || '').replace(/^@/, '')
      if (!u || seen.has(u)) continue
      seen.add(u)
      accounts.push({ username: u, fullName: it.ownerFullName || it.fullName || null })
    }
  }

  if (accounts.length === 0) return NextResponse.json({ saved: 0, skippedDup: 0, logs: ['Sin cuentas que importar'] })

  const supabase = createAdminClient()
  let saved = 0
  let skippedDup = 0

  for (const acc of accounts) {
    const ig = '@' + acc.username
    const name = acc.fullName || acc.username

    const { count: existing } = await supabase
      .from('providers')
      .select('id', { count: 'exact', head: true })
      .or(`instagram.eq.${ig},name.eq.${name}`)
    if ((existing || 0) > 0) { skippedDup++; continue }

    const provLike = { name, city, source: 'instagram' }
    const dmDraft = buildDmDraft(provLike)

    const { error } = await supabase
      .from('providers')
      .insert({
        name,
        category,
        city,
        email:        null,
        phone:        null,
        website:      null,
        instagram:    ig,
        description:  '',
        price_base:   null,
        price_unit:   'por evento',
        specialties:  [],
        source:       'instagram',
        status:       'pending',
        tag:          'Nuevo',
        contactable:  true,
        outreach_sent: false,
        outreach_dm:   dmDraft,
      })
    if (!error) saved++
  }

  return NextResponse.json({
    saved,
    skippedDup,
    totalAccounts: accounts.length,
    logs: [`✅ ${saved} guardados · ${skippedDup} duplicados de ${accounts.length} cuentas`],
  })
}
