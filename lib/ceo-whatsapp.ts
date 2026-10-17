// ───────────────────────────────────────────────────────────────────────
// Agente CEO por WhatsApp. Cuando la rutina deja propuestas, te llegan al
// móvil numeradas y decides respondiendo al mismo chat:
//
//   SI 1        → aprueba la propuesta 1
//   SI 1 3      → aprueba la 1 y la 3
//   SI TODO     → aprueba todas las pendientes
//   NO 2        → descarta la 2
//   CEO         → vuelve a mandar la lista de pendientes
//   PAUSA       → para toda ejecución automática · SEGUIR la reanuda
//
// Los números son la posición en la lista de pendientes (más antiguas
// primero), la misma que se envió en el último mensaje.
//
// Ventana de 24h de Meta: un texto libre solo llega si has escrito al
// número de FiestaGo en las últimas 24h. Si no, se manda la plantilla
// CEO_WHATSAPP_TEMPLATE (aprobada en Meta, con {{1}} = nº de decisiones,
// p. ej. "Tu CEO tiene {{1}} decisiones para ti. Responde CEO para verlas").
// Al responder CEO se abre la ventana y te llega la lista completa.
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, sendText, sendTemplate } from '@/lib/whatsapp'

type PendingProposal = {
  id:        string
  title:     string
  why:       string | null
  next_step: string | null
  impact:    string | null
}

function adminNumber(): string | null {
  return normalizePhone(process.env.ADMIN_WHATSAPP_NUMBER)
}

export function isAdminNumber(from: string | null | undefined): boolean {
  const admin = adminNumber()
  const n = normalizePhone(from)
  return !!admin && !!n && admin === n
}

async function pendingProposals(supabase: SupabaseClient): Promise<PendingProposal[]> {
  const { data } = await supabase
    .from('ceo_proposals')
    .select('id, title, why, next_step, impact')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .order('position', { ascending: true })
    .limit(9)
  return (data || []) as PendingProposal[]
}

function formatList(list: PendingProposal[], headline?: string): string {
  if (!list.length) return '🧠 CEO FiestaGo\nNo tienes decisiones pendientes. 👌'
  const lines = list.map((p, i) =>
    `*${i + 1}. ${p.title}*${p.impact ? ` (impacto ${p.impact})` : ''}\n` +
    `${p.why || ''}${p.next_step ? `\n→ ${p.next_step}` : ''}`,
  )
  return [
    `🧠 *CEO FiestaGo*${headline ? `\n${headline}` : ''}`,
    '',
    `Tienes ${list.length} decisión${list.length === 1 ? '' : 'es'}:`,
    '',
    lines.join('\n\n'),
    '',
    'Responde *SI 1*, *NO 2*, *SI TODO*, *CEO* para ver la lista o *PAUSA* para pararme.',
  ].join('\n').slice(0, 4000)
}

// Se llama al terminar la rutina, si hay propuestas pendientes.
export async function notifyCeoWhatsapp(
  supabase: SupabaseClient,
  headline: string,
  autoTitles: string[] = [],
): Promise<{ ok: boolean; via?: 'text' | 'template'; error?: string }> {
  const to = adminNumber()
  if (!to) return { ok: false, error: 'ADMIN_WHATSAPP_NUMBER no configurado' }

  const list = await pendingProposals(supabase)
  if (!list.length && !autoTitles.length) return { ok: false, error: 'nada que contar' }

  const auto = autoTitles.length
    ? `⚙️ *Hoy ejecuto yo:*\n${autoTitles.map(t => `• ${t}`).join('\n')}\n(escribe *PAUSA* para pararme)\n\n`
    : ''
  try {
    await sendText(to, `${auto}${list.length ? formatList(list, headline) : `🧠 *CEO FiestaGo*\n${headline}`}`.slice(0, 4000))
    return { ok: true, via: 'text' }
  } catch (err: any) {
    // Fuera de la ventana de 24h → plantilla para "despertar" el chat.
    const template = process.env.CEO_WHATSAPP_TEMPLATE
    if (!template) return { ok: false, error: `texto libre falló y no hay CEO_WHATSAPP_TEMPLATE: ${err.message}` }
    try {
      await sendTemplate(to, { template, bodyParams: [String(list.length + autoTitles.length)] })
      return { ok: true, via: 'template' }
    } catch (tplErr: any) {
      return { ok: false, error: tplErr.message }
    }
  }
}

// Respuesta del admin por WhatsApp. Devuelve true si el mensaje era para
// el CEO (y por tanto el webhook no debe tratarlo como de un proveedor).
export async function handleCeoWhatsappCommand(
  supabase: SupabaseClient,
  from: string,
  text: string,
  waMessageId: string,
): Promise<boolean> {
  if (!isAdminNumber(from)) return false

  const clean = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const m = clean.match(/^(si|ok|vale|no)\b\s*(.*)$/)
  const wantsList = /^(ceo|ver|lista|decisiones)\b/.test(clean)

  // Interruptor de emergencia desde el móvil.
  const pause  = /^(pausa|stop)\b/.test(clean)
  const resume = /^(seguir|reanudar)\b/.test(clean)
  if (pause || resume) {
    await supabase.from('ceo_settings').update({ paused: pause, updated_at: new Date().toISOString() }).eq('id', 1)
    await sendText(from, pause
      ? '⏸ CEO en pausa. No ejecutaré nada hasta que escribas *SEGUIR*.'
      : '▶️ CEO activo otra vez. Sigo ejecutando las acciones aprobadas.')
    return true
  }

  const list = await pendingProposals(supabase)

  if (wantsList) {
    await sendText(from, formatList(list))
    return true
  }
  // Cualquier otra cosa (o un "sí/no" sin nada pendiente) sigue el flujo
  // normal del webhook.
  if (!m || !list.length) return false

  // Meta reintenta webhooks: sin esto un "SI 1" repetido aprobaría la
  // siguiente de la lista (los números se recalculan tras cada decisión).
  const { error: dupErr } = await supabase.from('ceo_wa_commands').insert({ wa_message_id: waMessageId, body: text })
  if (dupErr) return true

  const approve = m[1] !== 'no'
  const rest = m[2]
  let picked: PendingProposal[]
  if (/^(todo|todas|todos)\b/.test(rest)) {
    picked = list
  } else {
    const nums = Array.from(new Set((rest.match(/\d+/g) || []).map(Number)))
    // "SI" a secas solo vale si hay una única pendiente
    if (!nums.length && list.length === 1) picked = list
    else picked = nums.map(n => list[n - 1]).filter(Boolean)
  }

  if (!picked.length) {
    await sendText(from, `No he entendido qué número${list.length ? ` (hay ${list.length} pendientes)` : ''}. Escribe por ejemplo *SI 1* o *NO 2*.`)
    return true
  }

  await supabase
    .from('ceo_proposals')
    .update({ status: approve ? 'approved' : 'rejected', decided_at: new Date().toISOString() })
    .in('id', picked.map(p => p.id))

  const remaining = list.length - picked.length
  await sendText(
    from,
    `${approve ? '✅ Aprobado' : '✕ Descartado'}:\n` +
    picked.map(p => `• ${p.title}`).join('\n') +
    (remaining > 0 ? `\n\nQuedan ${remaining}. Escribe *CEO* para verlas.` : '\n\nNo quedan decisiones pendientes.'),
  )
  return true
}
