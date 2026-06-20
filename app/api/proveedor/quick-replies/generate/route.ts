import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
let _client: Anthropic | null = null
function ai(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  _client = new Anthropic()
  return _client
}

// POST /api/proveedor/quick-replies/generate
// body: { providerId, prompt: "responder a alguien que quiere descuento" }
// Devuelve un draft sin guardar — el proveedor lo edita y luego pulsa
// guardar (usa el POST de /api/proveedor/quick-replies con label+body).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const prompt: string = (body.prompt || '').toString().trim()
  if (prompt.length < 5) {
    return NextResponse.json({ error: 'Describe la situación con más detalle' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: provider } = await supabase
    .from('providers')
    .select('name, category, city')
    .eq('id', providerId).single()

  const sys = `Eres un experto en atención al cliente por WhatsApp para proveedores de bodas y eventos en España.

Generas plantillas de respuesta CORTAS (máx 4 líneas), profesionales pero cercanas, en español de España. Usas máximo 2 emojis por mensaje y NUNCA suenas comercial o agresivo.

Puedes usar placeholders entre llaves dobles: {{nombre}} {{fecha}} {{ciudad}} {{invitados}} {{precio}} {{enlace}}. NO uses otros placeholders.

Devuelves SOLO JSON, sin markdown ni texto extra:
{ "label": "Etiqueta corta de 3-5 palabras", "body": "Texto del mensaje", "category": "consulta|presupuesto|confirmacion|seguimiento|rechazo|agradecimiento" }`

  const user = `[Proveedor]\n${provider?.name || ''} · ${provider?.category || ''} · ${provider?.city || ''}\n\n[Situación a la que tiene que responder]\n${prompt}\n\nGenera la plantilla.`

  try {
    const resp = await ai().messages.create({
      model: MODEL,
      max_tokens: 600,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    })
    const raw = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(raw)
    return NextResponse.json({
      label:    String(parsed.label || '').slice(0, 80),
      body:     String(parsed.body  || '').slice(0, 2000),
      category: parsed.category || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error generando' }, { status: 500 })
  }
}
