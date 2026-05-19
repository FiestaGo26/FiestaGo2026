import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'
import { buildEmailDraft, buildDmDraft } from '@/lib/outreach'
import { emailProviderOutreach } from '@/lib/resend'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Auth para invocación por cron (GitHub Actions). El header X-Cron-Secret
// debe coincidir con la env var CRON_SECRET. Admin también puede llamar
// con su password habitual (para pruebas desde /admin si quieres).
function checkCronAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

async function claudeWebSearch(prompt: string): Promise<string> {
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
  } finally {
    clearTimeout(tick)
  }
}

// POST /api/admin/agent/auto-run
// body: { category, city, count }
// Hace ciclo completo: busca → guarda → envía email a los que tienen email.
// Pensado para invocación por cron (GitHub Actions diario).
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

    log(`🤖 Cron — ${cat.label} en ${city} (count=${count})`)

    const prompt = `Busca ${count} negocios profesionales reales de "${cat.label}" en ${city}, España.

REGLA INNEGOCIABLE: cada negocio DEBE tener email REAL (con @) o handle de Instagram (@usuario). Si no tiene ninguno, NO lo incluyas. Mejor menos que sin contacto.

Devuelve SOLO este JSON, sin texto extra:
[{"name":"","email":"","phone":"","website":"","instagram":"@","description":"","avgPrice":0,"city":"${city}","specialties":[]}]`

    const text = await claudeWebSearch(prompt)
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      log(`⚠️ Sin JSON extraíble`)
      return NextResponse.json({ saved: 0, emailsSent: 0, logs })
    }

    let providers: any[] = []
    try { providers = JSON.parse(match[0]) } catch {
      log(`⚠️ JSON inválido`)
      return NextResponse.json({ saved: 0, emailsSent: 0, logs })
    }

    providers = providers.filter((p: any) => {
      const hasEmail = typeof p.email === 'string' && p.email.includes('@') && p.email.length > 5
      const ig       = (p.instagram || '').toString().trim()
      const hasIg    = ig.length > 1 && ig !== '@'
      return hasEmail || hasIg
    })

    const supabase = createAdminClient()
    let saved = 0
    let emailsSent = 0
    let skippedDup = 0

    for (const p of providers) {
      const email = p.email || null
      const websiteRaw = p.website || ''
      const isSocial = /instagram\.com|tiktok\.com/i.test(websiteRaw)
      const website = (websiteRaw && !isSocial) ? websiteRaw : null
      const instagram = p.instagram || null
      const phone = p.phone || null
      const contactable = !!(email || phone || website || instagram)

      // Dedupe por email o instagram
      if (email || instagram) {
        const orParts: string[] = []
        if (email)     orParts.push(`email.eq.${email}`)
        if (instagram) orParts.push(`instagram.eq.${instagram}`)
        const { count: existing } = await supabase
          .from('providers')
          .select('id', { count: 'exact', head: true })
          .or(orParts.join(','))
        if ((existing || 0) > 0) { skippedDup++; continue }
      }

      const provLike = { name: p.name, city, source: 'web' }
      const emailDraft = email     ? buildEmailDraft(provLike) : ''
      const dmDraft    = instagram ? buildDmDraft(provLike)    : ''

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
          tag: 'Nuevo', contactable,
          outreach_sent: false,
          outreach_email: emailDraft,
          outreach_dm: dmDraft,
        })
        .select().single()

      if (!row) continue
      saved++

      // Envío automático del email si tiene email. Los que solo tienen IG
      // quedan en cola para envío manual desde /admin (no se puede
      // automatizar DMs sin que IG banee la cuenta).
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
