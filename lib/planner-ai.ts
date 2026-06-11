// ───────────────────────────────────────────────────────────────────────
// AI Event Planner — genera 3 propuestas curadas (económica, estándar,
// premium) para un evento dado el presupuesto, ciudad, estilo y fecha.
//
// Modelo: claude-haiku-4-5. Coste ~$0.002 por consulta.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.PLANNER_MODEL || 'claude-haiku-4-5'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  _client = new Anthropic()
  return _client
}

// El system prompt es estable → cache_control.
const SYSTEM_PROMPT = `Eres el AI Event Planner de FiestaGo. Tu trabajo es construir 3 propuestas de equipo de proveedores para un evento, dadas las preferencias del cliente y el catálogo disponible.

OBJETIVO:
Devolver 3 "paquetes" de proveedores, uno por nivel de presupuesto:
- "economica" — aprovecha el presupuesto al máximo. Opciones más baratas pero con rating ≥ 4.0.
- "estandar"  — equilibrio precio/calidad. Cerca del presupuesto medio del cliente.
- "premium"   — lo mejor disponible en su ciudad y categorías, dentro de un margen razonable del presupuesto (puede excederlo hasta un 15%).

REGLAS:
- Cada paquete debe tener UN proveedor por cada categoría solicitada (no repitas el mismo proveedor en varios paquetes salvo que sea el único disponible).
- Selecciona SOLO proveedores del catálogo que te paso. Identifícalos por su ID exacto.
- Para cada proveedor incluye una "justificación" muy breve (12-25 palabras) explicando por qué encaja con el estilo, el presupuesto o el tipo de evento.
- El total del paquete debe estar dentro del rango razonable del nivel (economica ≤ presupuesto, estandar ≈ presupuesto, premium ≤ presupuesto × 1.15).
- Si el estilo del cliente es "rustico", prioriza proveedores con esa estética (búscalo en descripciones); si "playa", prioriza espacios al aire libre; si "moderno", prioriza fincas modernas y catering creativo; si "clasico", prioriza salones y proveedores tradicionales.
- Si una categoría no tiene proveedores suficientes en el catálogo, omítela del paquete (no inventes).

ESTILO de las justificaciones (1-2 frases máximo):
- Cercano y profesional, en primera persona del plural ("nuestro equipo").
- Concreto: menciona algo del proveedor (ciudad, especialidad, rating) y por qué encaja.
- Sin formalismos ("Estimado cliente"...) y sin emojis salvo uno opcional al inicio.

FORMATO DE SALIDA — RESPONDE SOLO ESTE JSON, sin texto antes ni después:

{
  "packages": [
    {
      "tier": "economica",
      "title": "Equipo Económico",
      "subtitle": "Aprovecha tu presupuesto al máximo",
      "providers": [
        { "id": "<uuid>", "category": "<cat_id>", "justification": "..." }
      ],
      "estimated_total": 0
    },
    {
      "tier": "estandar",
      "title": "Equipo Estándar",
      "subtitle": "Equilibrio precio/calidad",
      "providers": [...],
      "estimated_total": 0
    },
    {
      "tier": "premium",
      "title": "Equipo Premium",
      "subtitle": "Lo mejor de tu ciudad",
      "providers": [...],
      "estimated_total": 0
    }
  ],
  "summary": "Frase corta motivadora (10-15 palabras) cerrando la propuesta."
}`

export type PlannerInput = {
  event_type:   string
  guests:       number
  city:         string
  budget_total: number
  style?:       string | null
  event_date?:  string | null
  categories:   string[]
  // Catálogo de candidatos por categoría (ya filtrado/ordenado por el endpoint).
  candidates: {
    category: string
    label:    string
    items: {
      id:        string
      name:      string
      city:      string
      price_base: number
      rating:    number
      total_reviews: number
      description?: string | null
      specialties?: string[]
    }[]
  }[]
}

export type PlannerOutput = {
  packages: {
    tier:     'economica' | 'estandar' | 'premium'
    title:    string
    subtitle: string
    providers: {
      id:            string
      category:      string
      justification: string
    }[]
    estimated_total: number
  }[]
  summary: string
}

export async function generateEventPlan(
  input: PlannerInput,
): Promise<{ ok: true; data: PlannerOutput } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY no configurada' }

  const styleNote = input.style
    ? `Estilo preferido del cliente: "${input.style}". Tenlo en cuenta al elegir.`
    : 'El cliente no ha especificado estilo — usa criterio.'

  const dateNote = input.event_date
    ? `Fecha del evento: ${input.event_date}. Los proveedores del catálogo ya están filtrados por disponibilidad esa fecha.`
    : 'Sin fecha concreta.'

  const userMsg = `Cliente:
- Tipo de evento: ${input.event_type}
- Invitados: ${input.guests}
- Ciudad: ${input.city || 'sin especificar'}
- Presupuesto total: ${input.budget_total} €
- ${styleNote}
- ${dateNote}

Categorías solicitadas: ${input.categories.join(', ')}

Catálogo disponible (un bloque por categoría):

${input.candidates.map(c => `
══ ${c.label} (${c.category}) — ${c.items.length} disponibles ══
${c.items.map(it => `  · ${it.id}  ${it.name}  ${it.city}  ${it.price_base}€  ★${it.rating || 0}  (${it.total_reviews || 0} reseñas)${it.specialties?.length ? `  [${it.specialties.slice(0,3).join(', ')}]` : ''}`).join('\n')}
`).join('\n')}

Devuelve las 3 propuestas en el JSON exacto descrito.`

  const controller = new AbortController()
  const tick = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    }, { signal: controller.signal })

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    // Extraer JSON (Claude a veces lo envuelve en ```json o texto extra)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return { ok: false, error: 'Claude devolvió respuesta sin JSON parseable' }

    try {
      const parsed = JSON.parse(match[0]) as PlannerOutput
      if (!parsed.packages || !Array.isArray(parsed.packages)) {
        return { ok: false, error: 'JSON sin campo packages' }
      }
      return { ok: true, data: parsed }
    } catch (err: any) {
      return { ok: false, error: 'JSON inválido: ' + err.message }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, error: 'Timeout (>30s) llamando a Claude' }
    return { ok: false, error: err?.message || 'Error desconocido' }
  } finally {
    clearTimeout(tick)
  }
}
