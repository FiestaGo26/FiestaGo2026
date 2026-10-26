// ───────────────────────────────────────────────────────────────────────
// Chat con el CEO (segundo plano: hasta 15 min). Contesta el último
// mensaje de Mariano en ceo_messages. Ver chatWithCeo en lib/ceo-agent.ts.
//
// Auth: cabecera x-tick-secret = CEO_TICK_SECRET (la misma del latido).
// ───────────────────────────────────────────────────────────────────────

import { createAdminClient } from '../../lib/supabase'
import { chatWithCeo } from '../../lib/ceo-agent'

export default async (req: Request) => {
  if (!process.env.CEO_TICK_SECRET || req.headers.get('x-tick-secret') !== process.env.CEO_TICK_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }
  const supabase = createAdminClient()
  try {
    const out = await chatWithCeo(supabase)
    console.log('[ceo-chat]', JSON.stringify(out?.queued || []))
  } catch (err: any) {
    console.log('[ceo-chat] error', err.message)
    await supabase.from('ceo_messages').insert({ role: 'ceo', content: `No he podido contestar (${String(err.message).slice(0, 300)}). Vuelve a escribirme en un momento.`, meta: { error: true } })
  }
  return new Response('ok')
}
