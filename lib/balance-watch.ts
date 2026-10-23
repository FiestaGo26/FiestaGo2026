// ───────────────────────────────────────────────────────────────────────
// Vigilante de saldos: avisa a Mariano (WhatsApp + email) antes de que
// se acabe el crédito de los servicios de prepago que usan los agentes.
//
//   · fal.ai   → GET https://api.fal.ai/v1/account/billing?expand=credits
//                (puede necesitar una clave de administrador: FAL_ADMIN_KEY;
//                 si no, prueba con FAL_KEY)
//   · HeyGen   → GET https://api.heygen.com/v2/user/remaining_quota
//
// Umbrales (Netlify, opcionales):
//   FAL_LOW_BALANCE      dólares, por defecto 5
//   HEYGEN_LOW_SECONDS   segundos de vídeo, por defecto 300 (≈ 10 vídeos)
//
// Un aviso por servicio cada 24 h como mucho (se guarda en agent_alerts).
// Lo llama el workflow de redes (/api/cron/social, op 'balances').
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, sendText } from '@/lib/whatsapp'
import { sendEmail } from '@/lib/resend'

type Check = { service: string; ok: boolean; low?: boolean; value?: number; unit?: string; threshold?: number; error?: string; topUpUrl: string }

/** Primer número dentro de `credits` (la forma exacta no está documentada al detalle). */
function firstNumber(obj: any, prefer: string[]): number | null {
  if (obj == null) return null
  if (typeof obj === 'number') return obj
  for (const k of prefer) if (Number.isFinite(Number(obj?.[k]))) return Number(obj[k])
  for (const v of Object.values(obj)) {
    const n = typeof v === 'object' ? firstNumber(v, prefer) : Number(v)
    if (n != null && Number.isFinite(n)) return n
  }
  return null
}

async function checkFal(): Promise<Check | null> {
  const key = process.env.FAL_ADMIN_KEY || process.env.FAL_KEY
  if (!key) return null
  const topUpUrl = 'https://fal.ai/dashboard/billing'
  try {
    const res = await fetch('https://api.fal.ai/v1/account/billing?expand=credits', {
      headers: { Authorization: `Key ${key}` },
    })
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      const hint = res.status === 401 || res.status === 403
        ? ' (la API de saldo puede necesitar una clave de administrador: créala en fal.ai y guárdala como FAL_ADMIN_KEY en Netlify)'
        : ''
      return { service: 'fal.ai', ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data.detail || data).slice(0, 200)}${hint}`, topUpUrl }
    }
    const balance = firstNumber(data.credits, ['current_balance', 'balance', 'amount', 'credits'])
    if (balance == null) return { service: 'fal.ai', ok: false, error: `Respuesta sin saldo: ${JSON.stringify(data).slice(0, 200)}`, topUpUrl }
    const threshold = Number(process.env.FAL_LOW_BALANCE || 5)
    return { service: 'fal.ai', ok: true, value: balance, unit: data.credits?.currency || 'USD', threshold, low: balance < threshold, topUpUrl }
  } catch (err: any) {
    return { service: 'fal.ai', ok: false, error: err.message, topUpUrl }
  }
}

async function checkHeygen(): Promise<Check | null> {
  const key = process.env.HEYGEN_API_KEY
  if (!key) return null
  const topUpUrl = 'https://app.heygen.com/settings?nav=API'
  try {
    const res = await fetch('https://api.heygen.com/v2/user/remaining_quota', { headers: { 'X-Api-Key': key } })
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) return { service: 'HeyGen', ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data.error || data).slice(0, 200)}`, topUpUrl }
    const seconds = firstNumber(data.data, ['remaining_quota'])
    if (seconds == null) return { service: 'HeyGen', ok: false, error: `Respuesta sin saldo: ${JSON.stringify(data).slice(0, 200)}`, topUpUrl }
    const threshold = Number(process.env.HEYGEN_LOW_SECONDS || 300)
    return { service: 'HeyGen', ok: true, value: seconds, unit: 'segundos de vídeo', threshold, low: seconds < threshold, topUpUrl }
  } catch (err: any) {
    return { service: 'HeyGen', ok: false, error: err.message, topUpUrl }
  }
}

export async function checkBalances(supabase: SupabaseClient) {
  const checks = (await Promise.all([checkFal(), checkHeygen()])).filter((c): c is Check => !!c)
  const sent: string[] = []

  for (const c of checks.filter(c => c.low)) {
    // Un aviso por servicio cada 24 h
    const { count } = await supabase.from('agent_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'balance-watch').eq('title', `Saldo bajo: ${c.service}`)
      .gte('created_at', new Date(Date.now() - 86400_000).toISOString())
    if (count) continue

    const amount = c.unit === 'USD' ? `${c.value!.toFixed(2)} $` : `${Math.round(c.value!)} ${c.unit}`
    const msg = `⚠️ *Saldo bajo en ${c.service}*: quedan ${amount} (aviso por debajo de ${c.threshold} ${c.unit === 'USD' ? '$' : c.unit}).\nSin saldo, los agentes dejan de ${c.service === 'HeyGen' ? 'crear el vídeo diario' : 'crear imágenes para los posts'}.\nRecarga aquí: ${c.topUpUrl}`

    await supabase.from('agent_alerts').insert({
      source: 'balance-watch', severity: 'warning', title: `Saldo bajo: ${c.service}`,
      detail: msg.replace(/\*/g, ''), context: { value: c.value, unit: c.unit, threshold: c.threshold }, resolved: false,
    })

    const to = normalizePhone(process.env.ADMIN_WHATSAPP_NUMBER)
    if (to) await sendText(to, msg).catch(() => { /* fuera de la ventana de 24 h: queda el email */ })
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'contacto@fiestago.es',
      subject: `⚠️ Saldo bajo en ${c.service} · FiestaGo`,
      text: msg.replace(/\*/g, ''),
    }).catch(() => {})
    sent.push(c.service)
  }

  return { checks, alerted: sent }
}
