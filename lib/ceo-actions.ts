// ───────────────────────────────────────────────────────────────────────
// Acciones que el Agente CEO puede ejecutar por su cuenta. Cada una es un
// endpoint que ya existe en FiestaGo (los mismos botones del admin), con
// sus propios límites por lote. Encima van los topes diarios de
// ceo_settings y un interruptor de pausa.
//
// Flujo (para no chocar con el timeout de Netlify):
//   1. La rutina deja propuestas con `action`. Con autonomía 'full' quedan
//      aprobadas al momento; con 'approval' esperan tu OK (panel/WhatsApp).
//   2. GitHub Actions llama a /api/cron/ceo-execute {op:'next'}: reclama la
//      siguiente acción aprobada y recibe {endpoint, body}.
//   3. El propio workflow llama a ese endpoint (cada uno tiene 60s) y
//      devuelve el resultado con {op:'complete'}.
//
// Fuera del catálogo NO hay ejecución: pagos, reembolsos, precios,
// borrados o mensajes a clientes se quedan como propuesta manual.
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

export const CEO_CATEGORIES = ['flores', 'pastel', 'espacios', 'catering', 'joyeria', 'belleza', 'papeleria', 'foto', 'musica', 'planner', 'animacion', 'transporte'] as const
export const CEO_CITIES = ['Valencia', 'Valencia centro', 'Gandía', 'Sagunto', 'Torrent', 'Paterna'] as const

export type CeoAction = {
  type:     ActionType
  limit:    number
  category: string
  city:     string
  prompt:   string
}

type ActionDef = {
  label:    string
  endpoint: string
  wa:       boolean          // cuenta para el tope diario de WhatsApps
  post:     boolean          // cuenta para el tope diario de posts
  maxLimit: number
  body:     (a: CeoAction, limit: number) => Record<string, unknown>
}

export const ACTIONS = {
  whatsapp_outreach: {
    label: 'Primer WhatsApp a proveedores sin contactar',
    endpoint: '/api/admin/whatsapp/outreach-bulk',
    wa: true, post: false, maxLimit: 50,
    body: (_a, limit) => ({ limit }),
  },
  whatsapp_followup: {
    label: 'Segundo WhatsApp a quien no respondió (≥7 días)',
    endpoint: '/api/admin/whatsapp/followup',
    wa: true, post: false, maxLimit: 50,
    body: (_a, limit) => ({ limit }),
  },
  whatsapp_remind_signups: {
    label: 'Recordatorio a quien dijo que se apuntaba y no terminó el alta',
    endpoint: '/api/admin/whatsapp/remind-apuntados',
    wa: true, post: false, maxLimit: 25,
    body: (_a, limit) => ({ limit }),
  },
  email_followup: {
    label: 'Follow-up por email a proveedores contactados sin respuesta',
    endpoint: '/api/admin/agent/followup',
    wa: false, post: false, maxLimit: 30,
    body: (_a, limit) => ({ limit }),
  },
  find_providers: {
    label: 'Buscar proveedores nuevos (categoría + ciudad)',
    endpoint: '/api/admin/agent/free-run',
    wa: false, post: false, maxLimit: 10,
    body: (a, limit) => ({ category: a.category, city: a.city, count: limit }),
  },
  create_post: {
    label: 'Crear un post de IG/TikTok para la cola de marketing',
    endpoint: '/api/admin/marketing/custom',
    wa: false, post: true, maxLimit: 1,
    body: a => ({ prompt: a.prompt }),
  },
} satisfies Record<string, ActionDef>

export type ActionType = keyof typeof ACTIONS
export const ACTION_TYPES = Object.keys(ACTIONS) as ActionType[]

export type CeoSettings = {
  autonomy:          'full' | 'approval'
  paused:            boolean
  max_wa_per_day:    number
  max_posts_per_day: number
}

const DEFAULT_SETTINGS: CeoSettings = { autonomy: 'approval', paused: false, max_wa_per_day: 100, max_posts_per_day: 3 }

export async function getCeoSettings(supabase: SupabaseClient): Promise<CeoSettings> {
  const { data } = await supabase.from('ceo_settings').select('*').eq('id', 1).maybeSingle()
  return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS
}

// Normaliza lo que propone el modelo: tipo conocido, límite dentro del
// máximo del endpoint, categoría/ciudad válidas. null = no ejecutable.
export function sanitizeAction(raw: any): CeoAction | null {
  if (!raw || !ACTION_TYPES.includes(raw.type)) return null
  const def: ActionDef = ACTIONS[raw.type as ActionType]
  const limit = Math.min(Math.max(parseInt(String(raw.limit)) || def.maxLimit, 1), def.maxLimit)
  const action: CeoAction = {
    type:     raw.type,
    limit,
    category: CEO_CATEGORIES.includes(raw.category) ? raw.category : '',
    city:     CEO_CITIES.includes(raw.city) ? raw.city : '',
    prompt:   String(raw.prompt || '').slice(0, 1500),
  }
  if (action.type === 'find_providers' && (!action.category || !action.city)) return null
  if (action.type === 'create_post' && action.prompt.length < 20) return null
  return action
}

function madridDayStartIso() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  // Medianoche de Madrid aproximada a UTC (±1h según horario): suficiente
  // para un tope diario.
  return new Date(`${today}T00:00:00+02:00`).toISOString()
}

// Lo ya gastado hoy, para respetar los topes diarios.
async function usageToday(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('ceo_proposals')
    .select('action, status')
    .in('status', ['executing', 'done'])
    .gte('executed_at', madridDayStartIso())
  let wa = 0, posts = 0
  for (const r of data || []) {
    const a = r.action as CeoAction | null
    if (!a || !(a.type in ACTIONS)) continue
    const def: ActionDef = ACTIONS[a.type]
    if (def.wa) wa += a.limit
    if (def.post) posts += 1
  }
  return { wa, posts }
}

export async function claimNextAction(supabase: SupabaseClient) {
  const settings = await getCeoSettings(supabase)
  if (settings.paused) return { none: true, reason: 'Agente en pausa' }

  // Si un workflow murió a mitad, la acción se quedaría 'executing' para
  // siempre: pasada 1h la damos por fallida.
  await supabase
    .from('ceo_proposals')
    .update({ status: 'failed', result: { error: 'Sin respuesta del workflow en 1h' } })
    .eq('status', 'executing')
    .lt('executed_at', new Date(Date.now() - 3600_000).toISOString())

  const { data: queue } = await supabase
    .from('ceo_proposals')
    .select('id, title, action')
    .eq('status', 'approved')
    .not('action', 'is', null)
    .is('executed_at', null)
    .order('created_at', { ascending: true })
    .limit(20)

  const used = await usageToday(supabase)

  for (const p of queue || []) {
    const action = sanitizeAction(p.action)
    if (!action) {
      await supabase.from('ceo_proposals').update({ action: null }).eq('id', p.id)
      continue
    }
    const def: ActionDef = ACTIONS[action.type]

    // Ajustar al cupo que queda hoy; si no queda, se queda para mañana.
    if (def.wa) {
      const left = settings.max_wa_per_day - used.wa
      if (left <= 0) continue
      action.limit = Math.min(action.limit, left)
    }
    if (def.post && used.posts >= settings.max_posts_per_day) continue

    // Reclamo atómico: solo si sigue 'approved' (evita doble ejecución
    // si dos workflows coinciden).
    const { data: claimed } = await supabase
      .from('ceo_proposals')
      .update({ status: 'executing', executed_at: new Date().toISOString(), action })
      .eq('id', p.id)
      .eq('status', 'approved')
      .select('id')
    if (!claimed?.length) continue

    return {
      id:       p.id as string,
      title:    p.title as string,
      type:     action.type,
      endpoint: def.endpoint,
      body:     def.body(action, action.limit),
    }
  }
  return { none: true, reason: 'Nada pendiente o topes diarios alcanzados' }
}

export async function completeAction(supabase: SupabaseClient, id: string, ok: boolean, result: unknown) {
  // El resultado de los endpoints puede traer logs largos: recortamos.
  let stored: unknown = result
  const text = JSON.stringify(result ?? null)
  if (text.length > 6000) stored = { truncated: true, head: text.slice(0, 6000) }
  await supabase
    .from('ceo_proposals')
    .update({ status: ok ? 'done' : 'failed', result: stored })
    .eq('id', id)
    .eq('status', 'executing')
}

export function actionCatalogForPrompt(): string {
  return ACTION_TYPES.map(t => {
    const d: ActionDef = ACTIONS[t]
    return `- ${t}: ${d.label} (límite por lote: ${d.maxLimit})`
  }).join('\n')
}
