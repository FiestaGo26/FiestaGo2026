// ───────────────────────────────────────────────────────────────────────
// Simulación de clientes (función de segundo plano: hasta 15 min).
// Ejecuta la simulación de la fila de sim_runs indicada en { run_id }.
// Ver lib/client-sim.ts.
//
// Auth: cabecera x-tick-secret = CEO_TICK_SECRET (la misma del latido).
// ───────────────────────────────────────────────────────────────────────

import { createAdminClient } from '../../lib/supabase'
import { runClientSim } from '../../lib/client-sim'

export default async (req: Request) => {
  if (!process.env.CEO_TICK_SECRET || req.headers.get('x-tick-secret') !== process.env.CEO_TICK_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }
  // Pausadas (27-10-2026): cada simulación cuesta 2-4 $ de API. Para volver a
  // usarlas, poner CLIENT_SIM_ENABLED=1 en Netlify.
  if (process.env.CLIENT_SIM_ENABLED !== '1') return new Response('Simulaciones pausadas', { status: 403 })
  const { run_id } = await req.json().catch(() => ({} as any))
  if (!run_id) return new Response('Falta run_id', { status: 400 })

  const supabase = createAdminClient()
  try {
    const out = await runClientSim(supabase, run_id)
    console.log('[client-sim]', run_id, JSON.stringify(out))
  } catch (err: any) {
    console.log('[client-sim] error', run_id, err.message)
    await supabase.from('sim_runs').update({ status: 'error', error: err.message, updated_at: new Date().toISOString() }).eq('id', run_id)
  }
  return new Response('ok')
}
