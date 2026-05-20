import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'
import { buildEmailDraft, buildDmDraft } from '@/lib/outreach'
import { emailProviderOutreach } from '@/lib/resend'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function checkCronAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

// Ángulos de búsqueda — rota para descubrir long-tail.
// Cada llamada usa uno distinto según día + hash de categoría para no
// repetir siempre el mismo prompt y exprimir lo que Google indexa.
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
        // Haiku 4.5: rate limit más alto (50k/min Tier 1 vs 30k de Sonnet),
        // 3× más rápido, suficiente para extraer JSON de resultados de
        // búsqueda. La calidad de reasoning de Sonnet no aporta aquí.
        model: 'claude-haiku-4-5',
        max_tokens: 3500,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }],
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    const data = await res.json()
    if (data.error) {
      const msg = data.error.message || ''
      const isRateLimit = /rate.?limit|exceed.*tokens|429/i.test(msg)
      // Retry automático en rate limit: esperamos 35s y volvemos a probar
      // una sola vez. Si vuelve a fallar, devolvemos el error.
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
  } finally {
    clearTimeout(tick)
  }
}

// POST /api/admin/agent/auto-run
// body: { category, city, count }
export async function POST(req: NextRequest) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const logs: string[] = []
  const log = (m: string) => { logs.push(m) }

  try {
    const body = await req.json().catch(() => ({}))
    let { category = 'foto', city = 'Madrid', count = 3 } = body
    count = Math.min(Math.max(parseInt(String(count)) || 3, 1), 3)
    const cat = CATEGORIES.find(c => c.id === category)
    if (!cat) return NextResponse.json({ error: 'Categoría inválida', logs }, { status: 400 })

    const supabase = createAdminClient()

    // 1. Cargar la lista de proveedores que YA tenemos en esta categoría
    //    y ciudad/provincia, para pasarle a Claude como exclusión.
    //    Limitamos a 80 para no saturar el prompt.
    const { data: existing } = await supabase
      .from('providers')
      .select('name, instagram, email')
      .eq('category', category)
      .ilike('city', `%${city.split(' ')[0]}%`)  // match flexible: "Valencia" hits "Valencia centro" etc.
      .limit(80)

    const existingNames = (existing || []).map((p: any) => p.name).filter(Boolean)
    const existingIg    = (existing || []).map((p: any) => p.instagram).filter(Boolean)

    // 2. Elegir un ángulo de búsqueda variado según día + categoría
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    const catHash   = category.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
    const angleIdx  = (dayOfYear * 7 + catHash) % SEARCH_ANGLES.length
    const angle     = SEARCH_ANGLES[angleIdx]

    log(`🤖 Cron — ${cat.label} en ${city} (count=${count})`)
    log(`🎯 Ángulo: ${angle}`)
    log(`🚫 Excluyendo ${existingNames.length} ya conocidos`)

    // 3. Prompt mejorado: ángulo específico + lista de exclusión + instrucciones
    //    más exigentes para que Claude busque long-tail, no los top.
    // Acotamos la lista de exclusión a 20 nombres para no inflar el prompt
    // (cada token suma al consumo). Los duplicados se siguen filtrando
    // server-side incluso si Claude no los conoce todos.
    const exclusionBlock = existingNames.length > 0
      ? `\n\nYA TENEMOS ESTOS NEGOCIOS (NO los repitas, busca DISTINTOS):\n${existingNames.slice(0, 20).join(', ')}`
      : ''

    // Pedimos a Claude el triple de candidatos para que tras filtrar
    // por exclusión y contacto válido queden suficientes.
    const overprovision = Math.min(count * 3, 9)

    const prompt = `Eres un investigador buscando negocios profesionales de eventos en España. Tu objetivo es ENCONTRAR ${overprovision} negocios REALES — no te pongas exigente. PREFERIBLEMENTE long-tail (no los top), pero si tienes que incluir conocidos para llegar al número, hazlo.

Necesito ${overprovision} negocios de "${cat.label}" en ${city} y alrededores (incluye pueblos, barrios y toda la provincia). PISTA orientativa (no obligatoria): ${angle}.

REGLAS:
1. Cada negocio DEBE tener al menos UNO: email REAL (con @), handle de Instagram (@usuario), O web propia (https://...). Teléfono solo NO sirve.
2. Si tienes la web pero no el email, rellena solo "website" — un proceso aparte scrapea la web.
3. Busca en Google Maps, Instagram (hashtags como #${cat.id}valencia, #bodasvalencia…), Páginas Amarillas, Bodas.net, Zankyou y blogs locales.
4. Un perfil de Instagram activo es contacto válido aunque no haya web.
5. Mira páginas 2-3 de Google, no solo la primera.
6. Si no encuentras suficientes en ${city}, AMPLÍA a toda la provincia con tal de llegar a ${overprovision}.${exclusionBlock}

CRÍTICO: Devuelve MÍNIMO ${Math.min(overprovision, 5)} resultados. Es preferible incluir uno con poca información que devolver un array vacío.

Formato — SOLO este JSON, sin texto extra:
[{"name":"","email":"","phone":"","website":"","instagram":"@","description":"","avgPrice":0,"city":"${city}","specialties":[]}]`

    // max_uses 6 — más búsquedas para llegar al mínimo
    const text = await claudeWebSearch(prompt, 6)

    // Intento 1: array completo. Intento 2 (recovery): si Haiku trunca
    // por max_tokens y no cierra ']', recortamos hasta el último '}' y
    // añadimos ']' nosotros para no perder los items ya emitidos.
    let jsonStr: string | null = null
    const fullMatch = text.match(/\[[\s\S]*\]/)
    if (fullMatch) jsonStr = fullMatch[0]
    else {
      const startIdx = text.indexOf('[')
      const lastObj  = text.lastIndexOf('}')
      if (startIdx >= 0 && lastObj > startIdx) {
        jsonStr = text.slice(startIdx, lastObj + 1) + ']'
        log(`🩹 Respuesta truncada — recuperando JSON parcial`)
      }
    }
    if (!jsonStr) {
      log(`⚠️ Sin JSON extraíble: ${text.slice(0, 200).replace(/\s+/g, ' ')}…`)
      return NextResponse.json({ saved: 0, emailsSent: 0, logs })
    }

    let providers: any[] = []
    try { providers = JSON.parse(jsonStr) } catch {
      log(`⚠️ JSON inválido: ${jsonStr.slice(0, 200).replace(/\s+/g, ' ')}…`)
      return NextResponse.json({ saved: 0, emailsSent: 0, logs })
    }

    log(`📦 Claude devolvió ${providers.length}`)

    // Normalización: protocolo en URL + handle IG si viene como URL.
    providers = providers.map((p: any) => {
      const w = (p.website || '').toString().trim()
      if (w) {
        const igMatch = w.match(/instagram\.com\/@?([A-Za-z0-9_.]{1,30})/i)
        if (igMatch) {
          if (!p.instagram || !p.instagram.toString().trim().startsWith('@')) {
            p.instagram = '@' + igMatch[1]
          }
          p.website = ''
        } else if (!/^https?:\/\//i.test(w) && /\.[a-z]{2,}/i.test(w)) {
          p.website = 'https://' + w.replace(/^\/+/, '')
        }
      }
      const ig = (p.instagram || '').toString().trim()
      if (ig) {
        const m = ig.match(/(?:instagram\.com\/)?@?([A-Za-z0-9_.]{1,30})/i)
        if (m) p.instagram = '@' + m[1]
      }
      return p
    })

    // Filtro: email, IG o web + no presente en exclusión local.
    const beforeFilter = providers.length
    let rejNoContact = 0, rejDupName = 0, rejDupIg = 0
    providers = providers.filter((p: any) => {
      const hasEmail = typeof p.email === 'string' && p.email.includes('@') && p.email.length > 5
      const ig       = (p.instagram || '').toString().trim()
      const hasIg    = ig.length > 1 && ig !== '@'
      const webRaw   = (p.website || '').toString().trim()
      const hasWeb   = /^https?:\/\//i.test(webRaw)
      if (!hasEmail && !hasIg && !hasWeb) { rejNoContact++; return false }

      const nameLow = (p.name || '').toLowerCase().trim()
      if (existingNames.some((n: string) => n.toLowerCase() === nameLow)) { rejDupName++; return false }
      if (hasIg && existingIg.some((n: string) => n === ig)) { rejDupIg++; return false }
      return true
    })

    log(`✂️  Filtro: ${providers.length}/${beforeFilter} (sin contacto: ${rejNoContact}, dup nombre: ${rejDupName}, dup IG: ${rejDupIg})`)

    // Priorizamos email > IG > web. NO cortamos a count: dejamos buffer
    // para que el dedupe BD pueda saltar dups y aun así llegar a count.
    providers.sort((a: any, b: any) => {
      const aScore = (a.email ? 10 : 0) + (a.instagram ? 5 : 0) + (a.website ? 1 : 0)
      const bScore = (b.email ? 10 : 0) + (b.instagram ? 5 : 0) + (b.website ? 1 : 0)
      return bScore - aScore
    })

    let saved = 0
    let emailsSent = 0
    let skippedDup = 0

    for (const p of providers) {
      if (saved >= count) break
      const email = p.email || null
      const websiteRaw = p.website || ''
      const isSocial = /instagram\.com|tiktok\.com/i.test(websiteRaw)
      const website = (websiteRaw && !isSocial) ? websiteRaw : null
      const instagram = p.instagram || null
      const phone = p.phone || null
      const contactable = !!(email || phone || website || instagram)

      // Dedupe BD: email, instagram o website.
      const orParts: string[] = []
      if (email)     orParts.push(`email.eq.${email}`)
      if (instagram) orParts.push(`instagram.eq.${instagram}`)
      if (website)   orParts.push(`website.eq.${website}`)
      if (orParts.length > 0) {
        const { count: dbExisting } = await supabase
          .from('providers')
          .select('id', { count: 'exact', head: true })
          .or(orParts.join(','))
        if ((dbExisting || 0) > 0) { skippedDup++; continue }
      }

      const provLike = { name: p.name, city, source: 'web' }
      const emailDraft = email     ? buildEmailDraft(provLike) : ''
      const dmDraft    = instagram ? buildDmDraft(provLike)    : ''
      // Si tiene email/IG → 'Nuevo' (outreach listo).
      // Si solo tiene web → 'Investigar web' (extract-email lo procesará).
      const tag = (email || instagram) ? 'Nuevo' : 'Investigar web'

      const { data: row } = await supabase
        .from('providers')
        .insert({
          name: p.name, category, city: p.city || city,
          email, phone, website, instagram,
          description: p.description || '',
          price_base: p.avgPrice || null,
          price_unit: 'por evento',
          specialties: p.specialties || [],
          source: 'web', status: 'pending',
          tag, contactable,
          outreach_sent: false,
          outreach_email: emailDraft,
          outreach_dm: dmDraft,
        })
        .select().single()

      if (!row) continue
      saved++

      if (email && emailDraft) {
        const send = await emailProviderOutreach(row)
        if (send.ok) {
          emailsSent++
          await supabase.from('providers')
            .update({
              outreach_sent:  true,
              outreach_at:    new Date().toISOString(),
              tag:            'Contactado por email',
              contacted_via:  'email',
            })
            .eq('id', row.id)
        } else {
          log(`✗ Email a ${email} falló: ${send.error || 'unknown'}`)
        }
      }
    }

    log(`✅ ${saved} guardados · ${emailsSent} emails enviados · ${skippedDup} duplicados`)
    return NextResponse.json({ saved, emailsSent, skippedDup, logs })
  } catch (err: any) {
    log(`❌ ${err.message}`)
    return NextResponse.json({ error: err.message, logs }, { status: 500 })
  }
}
