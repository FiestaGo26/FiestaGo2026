import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'
import { buildEmailDraft, buildDmDraft, buildWhatsAppDraft } from '@/lib/outreach'
import { emailProviderOutreach } from '@/lib/resend'
import { osmSearch, osmSupportsCategory } from '@/lib/osm-search'
import { ddgSearch } from '@/lib/ddg-search'
import { extractEmailFromWeb } from '@/lib/extract-email'
import { hasValidWhatsapp } from '@/lib/whatsapp'

// MODO ESTRICTO: solo guardamos leads que tengan WhatsApp utilizable
// (móvil ES 6XX/7XX o wa.me/api.whatsapp extraído de la web). Es la
// única vía de captación real que estamos usando — guardar leads sin
// WhatsApp solo ensucia BD y desperdicia ciclos del scraper.
const ONLY_WHATSAPP = true

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

// POST /api/admin/agent/free-run
//   body: { category, city, count? }
//
// Buscador 100% gratis. NO usa la API de Anthropic.
//   1. OSM (Overpass) si la categoría tiene cobertura razonable.
//   2. DuckDuckGo HTML para categorías que OSM no cubre o como
//      complemento si OSM devolvió pocos.
//   3. Para cada candidato sin email, scrapea su web (extractEmailFromWeb)
//      para obtener email + contact_form_url.
//   4. Dedupe contra BD, guarda como pending, dispara outreach automático
//      si hay email (Resend gratis hasta 3k/mes).
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const logs: string[] = []
  const log = (m: string) => { logs.push(m) }

  try {
    const body = await req.json().catch(() => ({}))
    let { category = 'flores', city = 'Valencia', count = 5 } = body
    count = Math.min(Math.max(parseInt(String(count)) || 5, 1), 15)
    const cat = CATEGORIES.find(c => c.id === category) as any
    if (!cat) return NextResponse.json({ error: 'Categoría inválida', logs }, { status: 400 })

    log(`🤖 Free-run · ${cat.label} en ${city} (target ${count})`)
    const supabase = createAdminClient()

    type Candidate = {
      name: string
      phone: string | null
      website: string | null
      email: string | null
      instagram: string | null
      address: string | null
      sourceTag: 'osm' | 'ddg'
    }

    let candidates: Candidate[] = []

    // 1. OSM si soporta la categoría.
    if (osmSupportsCategory(category)) {
      log(`🌍 OSM · buscando ${cat.query || cat.label}…`)
      const osmResults = await osmSearch(category, city)
      candidates.push(...osmResults.map(r => ({ ...r, sourceTag: 'osm' as const })))
      log(`   ${osmResults.length} candidatos OSM`)
    } else {
      log(`🌍 OSM · sin cobertura para "${category}" — salto a DDG`)
    }

    // 2. DDG como complemento (siempre si OSM devolvió < count*2).
    if (candidates.length < count * 2) {
      const queries = [
        `${cat.query || cat.label} ${city}`,
        `${cat.label.split(' ')[0]} ${city} bodas eventos`,
        `mejores ${cat.label.toLowerCase()} ${city}`,
      ]
      for (const q of queries) {
        if (candidates.length >= count * 3) break
        log(`🦆 DDG · "${q}"`)
        const ddg = await ddgSearch(q, 10)
        log(`   ${ddg.length} resultados`)
        for (const r of ddg) {
          candidates.push({
            name: r.title.replace(/\s+-\s+.*$/, '').trim().slice(0, 80),
            phone: null,
            website: r.url,
            email: null,
            instagram: null,
            address: null,
            sourceTag: 'ddg',
          })
        }
      }
    }

    // Dedupe candidatos por nombre/website ANTES de scrapear (evita
    // visitar 3 veces la misma web).
    const seen = new Set<string>()
    candidates = candidates.filter(c => {
      const key = (c.website || c.name).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    log(`📦 ${candidates.length} candidatos únicos`)

    // 3. Enriquecer con scraping de web (cap a count*2 visitas para no
    //    pasarnos del timeout de 60s).
    let scraped = 0
    let saved = 0
    let emailsSent = 0
    let skippedDup = 0
    let skippedNoWa = 0

    // Teléfonos guardados en ESTA ejecución — para no insertar 2 candidatos
    // OSM distintos que en realidad son el mismo negocio con el mismo número.
    const phonesUsed = new Set<string>()
    const normalizePhone = (p: string | null) => p ? p.replace(/[^\d]/g, '').slice(-9) : ''

    for (const c of candidates) {
      if (saved >= count) break

      // Dedupe in-batch por teléfono (mismo negocio en 2 nodos OSM).
      const phoneKey = normalizePhone(c.phone)
      if (phoneKey && phonesUsed.has(phoneKey)) {
        log(`   ⨯ ${c.name} · dup teléfono in-batch (${c.phone})`)
        skippedDup++
        continue
      }

      // MODO ESTRICTO: pre-filtro antes de scrape. Si NO tiene teléfono móvil
      // a la mano Y NO tiene web (donde podríamos extraer wa.me), descartar
      // sin gastar el scraper. Si tiene web, le damos una oportunidad: el
      // scraper puede sacar el wa.me en el siguiente paso.
      if (ONLY_WHATSAPP) {
        const preCheckPasses =
          hasValidWhatsapp({ phone: c.phone }) ||
          !!c.website  // tiene web → puede salir wa.me al scrapear
        if (!preCheckPasses) {
          log(`   ⨯ ${c.name} · sin móvil y sin web (descarta pre-scrape)`)
          skippedNoWa++
          continue
        }
      }

      // Solo scraping si tiene web y no tiene ya email.
      if (c.website && !c.email && scraped < count * 2) {
        scraped++
        const extracted = await extractEmailFromWeb(c.website)
        if (extracted?.email) c.email = extracted.email
        const contactFormUrl = extracted?.contactFormUrl || null
        const whatsappUrl    = extracted?.whatsappUrl    || null

        // Dedupe BD por email/website/teléfono.
        const orParts: string[] = []
        if (c.email)    orParts.push(`email.eq.${c.email}`)
        if (c.website)  orParts.push(`website.eq.${c.website}`)
        if (c.phone)    orParts.push(`phone.eq.${c.phone}`)
        if (orParts.length > 0) {
          const { count: dbExisting } = await supabase
            .from('providers').select('id', { count: 'exact', head: true })
            .or(orParts.join(','))
          if ((dbExisting || 0) > 0) { skippedDup++; continue }
        }

        // MODO ESTRICTO: tras el scrape, solo guardamos si tiene WhatsApp
        // real (wa.me extraído o móvil ES). Si la web no tenía wa.me y el
        // teléfono no es móvil, descarta.
        if (ONLY_WHATSAPP && !hasValidWhatsapp({ phone: c.phone, whatsapp_url: whatsappUrl })) {
          log(`   ⨯ ${c.name} · sin WhatsApp tras scrape (web sin wa.me, sin móvil)`)
          skippedNoWa++
          continue
        }
        // (modo no estricto): filtro mínimo legacy — al menos UNA vía
        if (!ONLY_WHATSAPP && !c.email && !c.phone && !c.instagram && !contactFormUrl && !whatsappUrl) {
          log(`   ⨯ ${c.name} · sin canal accionable`)
          continue
        }

        const ok = await persistProvider(c, contactFormUrl, whatsappUrl, category, city, supabase, log)
        if (!ok) continue
        saved++
        if (phoneKey) phonesUsed.add(phoneKey)

        // Outreach automático por email si hay
        if (c.email) {
          const { data: fresh } = await supabase
            .from('providers').select('*').eq('email', c.email).maybeSingle()
          if (fresh) {
            const send = await emailProviderOutreach(fresh)
            if (send.ok) {
              emailsSent++
              await supabase.from('providers').update({
                outreach_sent: true,
                outreach_at:   new Date().toISOString(),
                tag:           'Contactado por email',
                contacted_via: 'email',
              }).eq('id', fresh.id)
            }
          }
        }
      } else if (c.email || c.phone || c.instagram) {
        // Tiene contacto directo desde OSM — saltarse el scrape, guardar ya.

        // MODO ESTRICTO: si OSM nos da teléfono fijo (no móvil) sin web, no
        // hay chance de que tenga WhatsApp. Descartar.
        if (ONLY_WHATSAPP && !hasValidWhatsapp({ phone: c.phone })) {
          log(`   ⨯ ${c.name} · OSM trae solo fijo/email/IG sin móvil (sin WA)`)
          skippedNoWa++
          continue
        }

        const orParts: string[] = []
        if (c.email)     orParts.push(`email.eq.${c.email}`)
        if (c.website)   orParts.push(`website.eq.${c.website}`)
        if (c.instagram) orParts.push(`instagram.eq.${c.instagram}`)
        if (c.phone)     orParts.push(`phone.eq.${c.phone}`)
        if (orParts.length > 0) {
          const { count: dbExisting } = await supabase
            .from('providers').select('id', { count: 'exact', head: true })
            .or(orParts.join(','))
          if ((dbExisting || 0) > 0) { skippedDup++; continue }
        }
        const ok = await persistProvider(c, null, null, category, city, supabase, log)
        if (ok) {
          saved++
          if (phoneKey) phonesUsed.add(phoneKey)
        }
      }
    }

    log(`✅ ${saved} guardados · ${emailsSent} emails auto · ${skippedDup} duplicados · ${skippedNoWa} sin WhatsApp · ${scraped} webs scraped`)
    return NextResponse.json({ saved, emailsSent, skippedDup, skippedNoWa, scraped, logs })
  } catch (err: any) {
    log(`❌ ${err.message}`)
    return NextResponse.json({ error: err.message, logs }, { status: 500 })
  }
}

async function persistProvider(
  c: { name: string; phone: string | null; website: string | null; email: string | null;
       instagram: string | null; address: string | null; sourceTag: 'osm' | 'ddg' },
  contactFormUrl: string | null,
  whatsappUrl: string | null,
  category: string,
  city: string,
  supabase: any,
  log: (m: string) => void,
): Promise<boolean> {
  const provLike = { name: c.name, city, source: 'web' }
  const emailDraft = c.email                ? buildEmailDraft(provLike)    : ''
  const dmDraft    = c.instagram            ? buildDmDraft(provLike)       : ''
  const waDraft    = (c.phone || whatsappUrl) ? buildWhatsAppDraft(provLike) : ''
  const contactable = !!(c.email || c.phone || c.website || c.instagram || contactFormUrl || whatsappUrl)
  const tag = (c.email || c.instagram || c.phone || whatsappUrl) ? 'Nuevo'
            : contactFormUrl                                       ? 'Nuevo'
            : 'Investigar web'

  const { error } = await supabase.from('providers').insert({
    name:              c.name,
    category,
    city,
    email:             c.email,
    phone:             c.phone,
    website:           c.website,
    instagram:         c.instagram,
    description:       '',
    price_base:        null,
    price_unit:        'por evento',
    specialties:       [],
    source:            'web',
    status:            'pending',
    tag,
    contactable,
    outreach_sent:     false,
    outreach_email:    emailDraft,
    outreach_dm:       dmDraft,
    outreach_whatsapp: waDraft,
    contact_form_url:  contactFormUrl,
    whatsapp_url:      whatsappUrl,
  })
  if (error) {
    log(`   ⨯ ${c.name} · insert error: ${error.message}`)
    // Si el error es "columna no encontrada en schema cache" → es un
    // bug crítico de esquema (migración no aplicada). Lo escalamos a
    // agent_alerts para que sea visible en /admin sin tener que cazar
    // logs de GitHub Actions.
    if (/Could not find the .* column.* in the schema cache/i.test(error.message)) {
      const colMatch = error.message.match(/'([^']+)' column/)
      const missingCol = colMatch?.[1] || 'desconocida'
      await supabase.from('agent_alerts').insert({
        source:   'agent/free-run',
        severity: 'critical',
        title:    `Columna faltante en providers: ${missingCol}`,
        detail:   `El insert de candidatos está fallando porque la columna '${missingCol}' no existe en la tabla 'providers'. Aplica la migración correspondiente en Supabase.`,
        context:  { table: 'providers', missing_column: missingCol, sample_error: error.message },
      }).then(() => {}, () => {})
    }
    return false
  }
  log(`   ✓ ${c.name} [${c.sourceTag}]` +
    (c.email ? ` · ${c.email}` : '') +
    (c.phone ? ` · ${c.phone}` : '') +
    (whatsappUrl ? ' · 💬' : '') +
    (contactFormUrl ? ' · form' : ''))
  return true
}
