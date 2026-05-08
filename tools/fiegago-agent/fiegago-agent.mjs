// ═══════════════════════════════════════════════════════════════════
// FiestaGo Agent — Recorre 10 ciudades × 12 categorías
// Búsqueda REAL en Instagram, TikTok y Google via Apify
// USO:
//   node fiegago-agent.mjs            # las 120 combinaciones
//   node fiegago-agent.mjs 3          # primeras 3 combinaciones
//   LIMIT=3 node fiegago-agent.mjs    # idem
//   COUNT=5 SOURCES=instagram,google node fiegago-agent.mjs
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const envFile = readFileSync(resolve('.env'), 'utf-8')
    envFile.split('\n').forEach(line => {
      const t = line.trim()
      if (!t || t.startsWith('#')) return
      const [key, ...vals] = t.split('=')
      if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
    })
  } catch {
    console.error('❌ No se encontró el archivo .env en ' + resolve('.env'))
    process.exit(1)
  }
}
loadEnv()

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const APIFY_TOKEN   = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY

const CITIES_LIST = [
  'Valencia','Madrid','Barcelona','Sevilla','Bilbao',
  'Málaga','Zaragoza','Murcia','Alicante','Granada',
]

const CATEGORY_IDS = [
  'foto','catering','espacios','musica','flores','pastel',
  'belleza','animacion','transporte','papeleria','planner','joyeria',
]

const LIMIT = Number(process.env.LIMIT || process.argv[2] || 0)

const RUN_OPTS = {
  count:    Number(process.env.COUNT || 3),
  sources:  (process.env.SOURCES || 'instagram,google').split(',').map(s => s.trim()).filter(Boolean),
  tone:     'profesional y cercano',
  delayMs:  Number(process.env.DELAY_MS || 2000),
}

const CATEGORIES = {
  foto:       { label:'Fotografía & Video',     hashtags:['fotografobodas','weddingphotographer','fotografoevento'], tiktokTags:['fotografobodas','weddingphotography'], query:'fotógrafo bodas eventos' },
  catering:   { label:'Catering & Banquetes',   hashtags:['cateringbodas','cateringevento','banqueteboda'],         tiktokTags:['cateringbodas','cateringeventos'],      query:'catering eventos bodas' },
  espacios:   { label:'Espacios & Fincas',      hashtags:['fincabodas','saloneventos','weddingvenue'],              tiktokTags:['fincabodas','salondebodas'],            query:'finca salón eventos bodas' },
  musica:     { label:'Música & DJ',            hashtags:['djbodas','musicabodas','djboda'],                        tiktokTags:['djbodas','musicabodas'],               query:'DJ bodas eventos música' },
  flores:     { label:'Flores & Decoración',    hashtags:['floristeriabodas','decoracionbodas'],                    tiktokTags:['floristeria','bodas'],                 query:'floristería decoración bodas' },
  pastel:     { label:'Tartas & Repostería',    hashtags:['tartaboda','pastelbodas','weddingcake'],                 tiktokTags:['tartaboda','weddingcake'],             query:'pastelería tarta bodas' },
  belleza:    { label:'Belleza & Estilismo',    hashtags:['maquillajenovia','peluqueriaboda'],                      tiktokTags:['maquillajenovia','bridalmakeup'],       query:'maquillaje peluquería novias' },
  animacion:  { label:'Animación & Shows',      hashtags:['animacioneventos','animacioninfantil'],                  tiktokTags:['animacion','photocall'],               query:'animación eventos espectáculos' },
  transporte: { label:'Transporte & Limusinas', hashtags:['limusinaboda','cochesboda'],                             tiktokTags:['limusinaboda','weddingcar'],            query:'limusina transporte bodas' },
  papeleria:  { label:'Papelería & Detalles',   hashtags:['invitacionesboda','papeleriaboda'],                      tiktokTags:['invitacionesboda'],                    query:'papelería invitaciones bodas' },
  planner:    { label:'Wedding & Event Planner',hashtags:['weddingplanner','organizadorabodas'],                    tiktokTags:['weddingplanner'],                      query:'wedding planner organizador bodas' },
  joyeria:    { label:'Joyería & Accesorios',   hashtags:['joyeriaboda','alianzasboda'],                            tiktokTags:['joyeriaboda','alianzas'],              query:'joyería alianzas anillos bodas' },
}

function log(msg) { console.log(msg) }

function extractEmail(text) {
  if (!text) return ''
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  return m ? m[0] : ''
}

function normCity(city) {
  return city.toLowerCase()
    .replace(/\s/g,'').replace(/á/g,'a').replace(/é/g,'e')
    .replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function claudeCall(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
}

async function apifyRun(actorId, input) {
  log(`   → Iniciando Apify actor: ${actorId}...`)
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(input) }
  )
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}))
    throw new Error(`Apify error: ${err.error?.message || startRes.status}`)
  }
  const run = await startRes.json()
  const runId = run.data?.id
  log(`   → Run ID: ${runId} — esperando resultados...`)

  let status = 'RUNNING', attempts = 0
  while ((status === 'RUNNING' || status === 'READY') && attempts < 30) {
    await delay(5000)
    attempts++
    const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    status = (await poll.json()).data?.status
    process.stdout.write(`\r   → Estado: ${status} (${attempts * 5}s)...`)
  }
  console.log()

  if (status !== 'SUCCEEDED') throw new Error(`Actor terminó con estado: ${status}`)

  const datasetId = run.data?.defaultDatasetId
  const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=100`)
  return await itemsRes.json()
}

async function enrichInstagramProfiles(usernames) {
  if (!usernames.length) return {}
  log(`   🔍 Enriqueciendo ${usernames.length} perfiles de Instagram...`)
  try {
    const profiles = await apifyRun('apify~instagram-profile-scraper', {
      usernames,
      resultsLimit: 1,
    })
    const map = {}
    for (const p of profiles) {
      const u = (p.username || '').toLowerCase()
      if (!u) continue
      const bio = p.biography || ''
      map[u] = {
        bio,
        fullName: p.fullName || '',
        followers: p.followersCount || 0,
        email:    extractEmail(bio) || (p.businessEmail || ''),
        website:  p.externalUrl || p.businessExternalUrl || '',
        phone:    p.businessPhoneNumber || '',
      }
    }
    log(`   ✓ ${Object.keys(map).length} perfiles enriquecidos`)
    return map
  } catch (err) {
    log(`   ⚠️ Enriquecimiento Instagram falló: ${err.message}`)
    return {}
  }
}

async function searchInstagram(catObj, city, count) {
  log(`\n📸 INSTAGRAM`)
  const cityTag = normCity(city)
  const tags = [...catObj.hashtags.slice(0,2).map(h => h+cityTag), ...catObj.hashtags.slice(0,2)]
  log(`   Hashtags: ${tags.join(', ')}`)

  const posts = await apifyRun('apify~instagram-hashtag-scraper', {
    hashtags: tags,
    resultsLimit: count * 5,
  })
  log(`   ${posts.length} posts obtenidos`)
  if (!posts.length) return []

  const compact = posts.slice(0,40).map(p => ({
    user:      p.ownerUsername || p.username || '',
    fullName:  p.ownerFullName || p.fullName || '',
    bio:       p.ownerBio || p.biography || '',
    followers: p.ownerFollowersCount || p.followersCount || 0,
    caption:   (p.caption || '').slice(0, 200),
    website:   p.ownerExternalUrl || p.externalUrl || '',
    email:     extractEmail(p.ownerBio || p.biography || p.caption || ''),
  }))

  const text = await claudeCall(
    'Agente captación FiestaGo. Extrae negocios REALES de Instagram. Solo JSON válido.',
    `Analiza estos perfiles de Instagram y extrae hasta ${count} negocios REALES de "${catObj.label}" en ${city} o España.
Solo negocios profesionales, no particulares.

Perfiles:
${JSON.stringify(compact, null, 1)}

JSON array (o [] si no hay):
[{"name":"nombre","type":"tipo","city":"${city}","socialHandle":"@user","socialPlatform":"instagram",
"socialUrl":"https://instagram.com/user","followers":0,"email":"","website":"","phone":"",
"avgPrice":1200,"priceUnit":"por evento","description":"desc","specialties":["e1"],"strengths":["s1"]}]`
  )
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  let providers
  try {
    providers = JSON.parse(match[0])
  } catch { return [] }
  log(`   ✅ ${providers.length} negocios reales detectados`)

  const usernames = [...new Set(
    providers
      .map(p => (p.socialHandle || '').replace(/^@/, '').trim())
      .filter(Boolean)
  )]
  const enriched = await enrichInstagramProfiles(usernames)
  return providers.map(p => {
    const u = (p.socialHandle || '').replace(/^@/, '').trim().toLowerCase()
    const e = enriched[u] || {}
    return {
      ...p,
      source:    'instagram',
      email:     p.email    || e.email    || '',
      website:   p.website  || e.website  || '',
      phone:     p.phone    || e.phone    || '',
      followers: p.followers || e.followers || 0,
    }
  })
}

async function searchTikTok(catObj, city, count) {
  log(`\n🎵 TIKTOK`)
  const cityTag = normCity(city)
  const tags = [...catObj.tiktokTags.slice(0,2).map(h => h+cityTag), catObj.tiktokTags[0]]
  log(`   Hashtags: ${tags.join(', ')}`)

  const videos = await apifyRun('clockworks~tiktok-scraper', {
    hashtags: tags,
    resultsPerPage: count * 3,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    proxyConfiguration: { useApifyProxy: true },
  })
  log(`   ${videos.length} vídeos obtenidos`)
  if (!videos.length) return []

  const compact = videos.slice(0,40).map(p => ({
    user:      p.authorMeta?.name || '',
    followers: p.authorMeta?.fans || 0,
    bio:       p.authorMeta?.signature || '',
    caption:   (p.text || '').slice(0, 200),
    website:   p.authorMeta?.bioLink || '',
    email:     extractEmail(p.authorMeta?.signature || p.text || ''),
  }))

  const text = await claudeCall(
    'Agente captación FiestaGo. Extrae negocios REALES de TikTok. Solo JSON válido.',
    `Analiza estos perfiles de TikTok y extrae hasta ${count} negocios REALES de "${catObj.label}" en ${city} o España.
Solo negocios profesionales, no particulares.

Perfiles:
${JSON.stringify(compact, null, 1)}

JSON array (o [] si no hay):
[{"name":"nombre","type":"tipo","city":"${city}","socialHandle":"@user","socialPlatform":"tiktok",
"socialUrl":"https://tiktok.com/@user","followers":0,"email":"","website":"","phone":"",
"avgPrice":1200,"priceUnit":"por evento","description":"desc","specialties":["e1"],"strengths":["s1"]}]`
  )
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const providers = JSON.parse(match[0])
    log(`   ✅ ${providers.length} negocios reales detectados`)
    return providers.map(p => ({ ...p, source: 'tiktok' }))
  } catch { return [] }
}

async function searchGoogle(catObj, city, count) {
  log(`\n🌐 GOOGLE`)
  const query = `${catObj.query} ${city} España contacto email teléfono`
  log(`   Query: "${query}"`)

  const results = await apifyRun('apify~google-search-scraper', {
    queries: query,
    maxPagesPerQuery: 2,
    resultsPerPage: 10,
  })

  const organicResults = results?.[0]?.organicResults || []
  log(`   ${organicResults.length} resultados de Google`)
  if (!organicResults.length) return []

  const text = await claudeCall(
    'Agente captación FiestaGo. Extrae negocios reales de resultados de Google. Solo JSON válido.',
    `Analiza estos resultados de Google para "${catObj.label}" en ${city} y extrae hasta ${count} negocios REALES.

Resultados:
${JSON.stringify(organicResults.slice(0,10).map(r => ({ title:r.title, url:r.url, description:r.description })), null, 1)}

JSON array (o [] si no hay negocios claros):
[{"name":"nombre real","type":"tipo","city":"${city}","email":"","phone":"","website":"URL",
"source":"URL donde encontraste info","avgPrice":1200,"priceUnit":"por evento",
"specialties":["e1"],"description":"desc basada en resultado","strengths":["s1"]}]`
  )
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const providers = JSON.parse(match[0])
    log(`   ✅ ${providers.length} proveedores encontrados en Google`)
    return providers.map(p => ({ ...p, source: 'web' }))
  } catch { return [] }
}

async function saveToSupabase(provider, categoryId, city) {
  const email     = provider.email   || null
  const phone     = provider.phone   || null
  // Website: solo guardar si es web propia (no perfil de IG/TikTok)
  const websiteRaw = provider.website || ''
  const isSocialUrl = /instagram\.com|tiktok\.com/i.test(websiteRaw)
  const website   = (websiteRaw && !isSocialUrl) ? websiteRaw : null
  const instagram = provider.source === 'instagram' ? provider.socialHandle : (provider.instagram || null)
  const tiktok    = provider.source === 'tiktok'    ? provider.socialHandle : (provider.tiktok || null)
  const contactable = !!(email || phone || website || instagram || tiktok)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/providers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      name:            provider.name,
      category:        categoryId,
      city:            provider.city || city,
      email,
      phone,
      website,
      instagram,
      tiktok,
      description:     provider.description,
      price_base:      provider.avgPrice || null,
      price_unit:      provider.priceUnit || 'por evento',
      specialties:     provider.specialties || [],
      source:          provider.source === 'web' ? 'web' : provider.source || 'web',
      status:          'pending',
      tag:             provider.suggestedTag || 'Nuevo',
      agent_score:     (provider.score || 'B').charAt(0).toUpperCase(),
      agent_notes:     provider.notes || '',
      agent_fit_score: provider.fitScore || 5,
      conversion_prob: provider.estimatedConversionProb || 40,
      outreach_sent:   false,
      outreach_email:  provider.emailDraft || '',
      outreach_dm:     provider.dmDraft    || '',
      social_handle:   provider.socialHandle || null,
      social_platform: provider.source !== 'web' ? provider.source : null,
      social_url:      provider.socialUrl || null,
      followers:       provider.followers || 0,
      contactable,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return { contactable, data: await res.json() }
}

async function runOne(categoryId, city) {
  const catObj = CATEGORIES[categoryId]
  if (!catObj) { log(`❌ Categoría inválida: ${categoryId}`); return { saved: 0, found: 0 } }

  log(`\n${'━'.repeat(56)}`)
  log(`▶ ${catObj.label}  ·  ${city}  ·  fuentes: ${RUN_OPTS.sources.join(', ')}`)
  log('━'.repeat(56))

  let rawProviders = []
  const seen = new Set()

  if (RUN_OPTS.sources.includes('instagram')) {
    try {
      const igP = await searchInstagram(catObj, city, RUN_OPTS.count)
      rawProviders.push(...igP)
    } catch (err) { log(`   ⚠️ Instagram falló: ${err.message}`) }
  }

  if (RUN_OPTS.sources.includes('tiktok')) {
    try {
      const ttP = await searchTikTok(catObj, city, RUN_OPTS.count)
      rawProviders.push(...ttP)
    } catch (err) { log(`   ⚠️ TikTok falló: ${err.message}`) }
  }

  if (RUN_OPTS.sources.includes('google')) {
    try {
      const gP = await searchGoogle(catObj, city, RUN_OPTS.count)
      rawProviders.push(...gP)
    } catch (err) { log(`   ⚠️ Google falló: ${err.message}`) }
  }

  rawProviders = rawProviders.filter(p => {
    const key = (p.name || '').toLowerCase().replace(/\s/g, '')
    if (!key || seen.has(key)) return false
    seen.add(key); return true
  }).slice(0, RUN_OPTS.count * 2)

  log(`\n📊 ${rawProviders.length} candidatos detectados para ${catObj.label} en ${city}`)
  if (rawProviders.length === 0) return { saved: 0, found: 0 }

  let savedCount = 0
  for (const p of rawProviders.slice(0, RUN_OPTS.count)) {
    log(`   📊 ${p.name} (${p.source})`)

    let qual
    try {
      const qualText = await claudeCall(
        'Analista FiestaGo. Solo JSON válido.',
        `Evalúa proveedor REAL:
Nombre: ${p.name} | Cat: ${catObj.label} | Ciudad: ${p.city || city}
Email: ${p.email?'SÍ':'NO'} | Web: ${p.website?'SÍ':'NO'} | Seguidores: ${p.followers||0}

{"score":"A","scoreReason":"1 frase","fitScore":8,"recommendation":"AÑADIR",
"priority":"ALTA","notes":"nota","estimatedConversionProb":70,
"suggestedTag":"Nuevo","missingData":["email"]}`
      )
      const qualMatch = qualText.match(/\{[\s\S]*\}/)
      qual = qualMatch ? JSON.parse(qualMatch[0]) : null
    } catch (err) {
      log(`     ⚠️ Cualificación falló: ${err.message}`)
    }
    qual = qual || {
      score:'B', recommendation:'CONTACTAR', fitScore:5,
      scoreReason:'Sin análisis', notes:'', estimatedConversionProb:40,
      suggestedTag:'Nuevo', missingData:[],
    }

    const emailDraft = qual.recommendation !== 'DESCARTAR'
      ? `ASUNTO: ${p.name}, tus primeros clientes te esperan en FiestaGo

Hola ${p.name},

Somos FiestaGo, el nuevo marketplace de celebraciones en España donde parejas y familias encuentran los mejores profesionales para sus eventos.

Hemos encontrado tu negocio${p.source==='instagram'?' en Instagram':p.source==='tiktok'?' en TikTok':''} y creemos que encajas perfectamente con lo que buscan nuestros clientes.

Por qué unirte ahora:

- Registro 100% gratuito, sin permanencia
- Tu primera transacción sin ninguna comisión (0%)
- Solo el 8% desde la segunda venta real
- Acceso a clientes cualificados buscando exactamente tu servicio
- Sin inversión en publicidad, nosotros llevamos el tráfico

Las primeras plazas en ${city} son limitadas.

Regístrate gratis en menos de 5 minutos:
https://fiestago.es/registro-proveedor

¿Tienes dudas?
contacto@fiestago.es

El equipo de FiestaGo` : ''

    const firstName = (p.name || '').split(/[\s|·\-_]/)[0] || ''
    const dmDraft = qual.recommendation !== 'DESCARTAR'
      ? `¡Hola ${firstName}! 👋

Soy del equipo de FiestaGo, nuevo marketplace de celebraciones en España. Tu trabajo nos encaja muy bien con lo que buscan nuestros clientes en ${city}.

Te ofrecemos plaza gratuita: 0% comisión en tu primera venta y solo 8% después. Sin permanencia.

¿Te lo cuento en 1 minuto?
👉 https://fiestago.es/registro-proveedor

Cualquier duda, por aquí.` : ''

    const fullProvider = { ...p, ...qual, emailDraft, dmDraft }
    try {
      const r = await saveToSupabase(fullProvider, categoryId, city)
      savedCount++
      const channels = []
      if (p.email)        channels.push(`✉️ ${p.email}`)
      if (p.phone)        channels.push(`📞 ${p.phone}`)
      if (p.website && !/instagram\.com|tiktok\.com/i.test(p.website)) channels.push(`🌐`)
      if (p.source === 'instagram') channels.push(`📸 ${p.socialHandle}`)
      if (p.source === 'tiktok')    channels.push(`🎵 ${p.socialHandle}`)
      const flag = r.contactable ? '✓' : '⚠'
      log(`     ${flag} Guardado — Score ${qual.score} | ${channels.join(' · ') || 'sin canales'}`)
    } catch (err) {
      log(`     ✗ Error guardando: ${err.message}`)
    }
  }

  return { saved: savedCount, found: rawProviders.length }
}

async function main() {
  const missing = []
  if (!SUPABASE_URL)  missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_KEY)  missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!ANTHROPIC_KEY) missing.push('ANTHROPIC_API_KEY')
  if (!APIFY_TOKEN)   missing.push('APIFY_API_TOKEN')
  if (missing.length) {
    console.error(`\n❌ Faltan variables en .env: ${missing.join(', ')}`)
    process.exit(1)
  }

  console.log('\n' + '═'.repeat(56))
  console.log('🤖 FiestaGo Agent — recorrido 10 ciudades × 12 categorías')
  console.log('═'.repeat(56))

  const combos = []
  for (const city of CITIES_LIST) {
    for (const catId of CATEGORY_IDS) {
      combos.push({ city, catId })
    }
  }

  const total = LIMIT > 0 ? Math.min(LIMIT, combos.length) : combos.length
  log(`📋 Combinaciones totales: ${combos.length}`)
  log(`▶  Ejecutando: ${total} (LIMIT=${LIMIT || 'sin límite'})`)
  log(`🔢 Proveedores por combinación: ${RUN_OPTS.count}`)
  log(`🔌 Fuentes: ${RUN_OPTS.sources.join(', ')}`)

  let totalSaved = 0, totalFound = 0
  const startedAt = Date.now()

  for (let i = 0; i < total; i++) {
    const { city, catId } = combos[i]
    log(`\n[${i + 1}/${total}]`)
    try {
      const r = await runOne(catId, city)
      totalSaved += r.saved
      totalFound += r.found
    } catch (err) {
      log(`   ❌ Error fatal en combinación ${catId}/${city}: ${err.message}`)
    }
    if (i < total - 1) await delay(RUN_OPTS.delayMs)
  }

  const mins = Math.round((Date.now() - startedAt) / 60000)
  log(`\n${'═'.repeat(56)}`)
  log(`🎉 RECORRIDO COMPLETADO  (${mins} min)`)
  log(`📊 Combinaciones procesadas: ${total}`)
  log(`📊 Candidatos encontrados:   ${totalFound}`)
  log(`💾 Guardados en Supabase:    ${totalSaved}`)
  log(`📋 Apruébalos en https://fiestago.es/admin`)
  log('═'.repeat(56) + '\n')
}

main().catch(err => {
  console.error(`\n❌ Error fatal: ${err.message}`)
  console.error(err.stack)
  process.exit(1)
})
