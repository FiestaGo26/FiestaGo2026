import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase'
import { zoneOf } from '@/lib/captacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/analytics/pageview — visitas de la web para el panel (pestaña Visitas).
// Sin cookies ni datos personales: el visitante es un resumen (hash) de la IP y el
// navegador mezclados con la fecha del día, así que cambia cada día y no permite
// identificar a nadie ni seguirle entre días. No se guarda la IP.
// body { path, referrer?, utm_source?, utm_medium?, utm_campaign?, entry?, zone? }

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|facebookexternalhit|whatsapp\//i

function sourceOf(referrer: string, utm: string | null, entry: boolean) {
  const u = (utm || '').toLowerCase()
  if (u) {
    if (/^(ig|instagram)/.test(u)) return 'instagram'
    if (/tiktok/.test(u)) return 'tiktok'
    if (/^(fb|facebook|meta)/.test(u)) return 'facebook'
    if (/^(wa|whatsapp)/.test(u)) return 'whatsapp'
    if (/google/.test(u)) return 'google'
    if (/mail|newsletter|resend/.test(u)) return 'email'
    return u.slice(0, 30)
  }
  if (!entry) return 'interno'
  let host = ''
  try { host = new URL(referrer).hostname.replace(/^www\./, '') } catch { return 'directo' }
  if (!host) return 'directo'
  if (/fiestago\.es$|netlify\.app$/.test(host)) return 'interno'
  if (/google\./.test(host)) return 'google'
  if (/instagram\.com$/.test(host)) return 'instagram'
  if (/tiktok\.com$/.test(host)) return 'tiktok'
  if (/facebook\.com$|fb\.me$/.test(host)) return 'facebook'
  if (/whatsapp|wa\.me$/.test(host)) return 'whatsapp'
  if (/bing\.|duckduckgo|yahoo\.|ecosia/.test(host)) return 'otros buscadores'
  if (/mail\.|outlook|gmail/.test(host)) return 'email'
  return host.slice(0, 40)
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') || ''
  if (!ua || BOT.test(ua)) return NextResponse.json({ ok: true })
  const b = await req.json().catch(() => ({}))
  const path = String(b.path || '').split('?')[0].slice(0, 200)
  if (!path.startsWith('/') || /^\/(proveedor\/|admin|api\/)/.test(path)) return NextResponse.json({ ok: true })

  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  const salt = process.env.VISIT_SALT || process.env.CRON_SECRET || 'fiestago'
  const visitor = createHash('sha256').update(`${day}|${salt}|${ip}|${ua}`).digest('hex').slice(0, 20)
  const clean = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, 60) : null)

  const supabase = createAdminClient()
  // Zona: la que elige en "Monta tu celebración" o la del proveedor de la ficha
  let zone = b.zone === 'asturias' || b.zone === 'valencia' ? b.zone : null
  const m = path.match(/^\/proveedores\/([^/]+)$/)
  if (!zone && m) {
    const key = decodeURIComponent(m[1])
    const { data } = await supabase.from('providers').select('city')
      .or(/^[0-9a-f-]{36}$/.test(key) ? `id.eq.${key}` : `slug.eq.${key}`).maybeSingle()
    if (data?.city) zone = zoneOf(data.city)
  }

  await supabase.from('page_views').insert({
    path, visitor, zone,
    source: sourceOf(String(b.referrer || ''), clean(b.utm_source), b.entry === true),
    utm_source: clean(b.utm_source), utm_medium: clean(b.utm_medium), utm_campaign: clean(b.utm_campaign),
    device: /mobile|android|iphone|ipad/i.test(ua) ? 'móvil' : 'ordenador',
  })
  return NextResponse.json({ ok: true })
}
