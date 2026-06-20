// ───────────────────────────────────────────────────────────────────────
// Google Business Profile post generator. Toma un tema en lenguaje
// natural ("nuevo paquete de bodas para 50 invitados", "promoción de
// septiembre", "abrimos los domingos") + contexto del proveedor y
// devuelve un post listo para Google Business: ≤1500 chars, hook
// fuerte, CTA local, optimizado para "near me" search.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  _client = new Anthropic()
  return _client
}

export type GmbProvider = {
  name:     string
  category: string | null
  city:     string | null
  slug:     string | null
  email?:   string | null
}

export type GeneratedGmbPost = {
  body:        string    // texto del post (≤1500 chars)
  ctaLabel:    string    // "Reservar" | "Llamar" | "Más información"
  ctaUrl:      string    // URL del CTA — el slug del proveedor en FiestaGo
  hashtagsHint: string[] // tags sugeridos (Google los soporta pero no son críticos)
}

const SYSTEM = `Eres un experto en marketing local y Google Business Profile para proveedores de bodas y eventos en España.

Generas posts para el feed del Perfil de Empresa en Google Maps. Reglas DURAS:
- Máximo 1500 caracteres (Google corta).
- Primera línea = hook potente que aparece en el preview de búsqueda.
- Estructura: hook (1 línea) → desarrollo (2-4 líneas) → llamada a la acción clara.
- Español de España, cercano y profesional, sin jerga corporativa.
- Menciona la CIUDAD del proveedor al menos 1 vez (clave para "[servicio] cerca de mí").
- Menciona la CATEGORÍA del proveedor explícitamente.
- 0-2 emojis máximo, siempre relevantes.
- No uses "haz click", "pincha", "visita el enlace" — Google lo penaliza. Usa el verbo del CTA directamente ("Reserva ahora", "Pide presupuesto").

Devuelves SOLO JSON, sin markdown:
{
  "body": "texto del post",
  "ctaLabel": "Reservar" | "Llamar" | "Más información" | "Pedir presupuesto" | "Reservar online",
  "hashtagsHint": ["#bodavalencia", "#fotografobodas"]
}`

export async function generateGmbPost(opts: {
  provider: GmbProvider
  topic:    string         // tema del post en lenguaje natural
}): Promise<GeneratedGmbPost> {
  const { provider, topic } = opts

  const user =
    `[Proveedor]\n` +
    `Nombre: ${provider.name}\n` +
    `Categoría: ${provider.category || '(sin especificar)'}\n` +
    `Ciudad: ${provider.city || '(sin especificar)'}\n\n` +
    `[Tema del post]\n${topic}\n\n` +
    `Genera el post.`

  const resp = await client().messages.create({
    model:      MODEL,
    max_tokens: 1200,
    thinking:   { type: 'disabled' },
    system: [{
      type: 'text',
      text: SYSTEM,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: user }],
  })

  const raw = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text).join('').trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  const parsed = JSON.parse(raw)
  const ctaUrl = provider.slug
    ? `https://fiestago.es/p/${provider.slug}`
    : 'https://fiestago.es'

  return {
    body:         String(parsed.body || '').slice(0, 1500),
    ctaLabel:     String(parsed.ctaLabel || 'Más información'),
    ctaUrl,
    hashtagsHint: Array.isArray(parsed.hashtagsHint) ? parsed.hashtagsHint.map(String) : [],
  }
}
