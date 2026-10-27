// ───────────────────────────────────────────────────────────────────────
// Cliente de Anthropic para toda la web. Igual que `new Anthropic()`, pero
// si la API contesta que no queda saldo ("credit balance is too low"),
// avisa a Mariano por email y WhatsApp (una vez cada 6 h como mucho):
// sin saldo dejan de funcionar el agente CEO, el contenido diario y el
// asistente de clientes. El aviso de "queda poco" está en lib/balance-watch.ts.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { normalizePhone, sendText } from '@/lib/whatsapp'

const TITLE = 'Sin saldo: Anthropic'

async function alertNoCredit() {
  const supabase = createAdminClient()
  const { count } = await supabase.from('agent_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'balance-watch').eq('title', TITLE)
    .gte('created_at', new Date(Date.now() - 6 * 3600_000).toISOString())
  if (count) return
  const msg = '⛔ *Anthropic se ha quedado sin saldo.* El agente CEO, el contenido diario, las respuestas a preguntas de las propuestas y el asistente de clientes no funcionan hasta que recargues.\nRecarga aquí: https://console.anthropic.com/settings/billing'
  await supabase.from('agent_alerts').insert({ source: 'balance-watch', severity: 'critical', title: TITLE, detail: msg.replace(/\*/g, ''), context: {}, resolved: false })
  const to = normalizePhone(process.env.ADMIN_WHATSAPP_NUMBER)
  if (to) await sendText(to, msg).catch(() => { /* fuera de la ventana de 24 h: queda el email */ })
  await sendEmail({ to: process.env.ADMIN_EMAIL || 'contacto@fiestago.es', subject: '⛔ Anthropic sin saldo · FiestaGo', text: msg.replace(/\*/g, '') }).catch(() => {})
}

const watchedFetch = async (input: any, init?: any): Promise<Response> => {
  const res = await fetch(input, init)
  if (res.status === 400 || res.status === 402) {
    const body = await res.clone().text().catch(() => '')
    if (/credit balance/i.test(body)) await alertNoCredit().catch(() => {})
  }
  return res
}

export function newAnthropic() {
  return new Anthropic({ fetch: watchedFetch as any })
}
