import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES, CITIES } from '@/lib/constants'
import type { Audience } from '@/lib/uploadpost'

export const runtime = 'nodejs'
export const maxDuration = 60  // Netlify Pro permite hasta 26s sync; background functions hasta 15min. Para imagen suele bastar.
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  // Admin password (uso interactivo desde /admin) o cron secret (cron
  // semanal de GitHub Actions). Ambos generan posts pendientes en BD.
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  return false
}

// Plan del post generado por Claude (lo que esperamos como salida)
type PostPlan = {
  post_type:      'inspiration' | 'tip_educational' | 'pack_promo' | 'social_proof' | 'behind_scenes' | 'fomo_seasonal' | 'custom'
  city:           string | null
  category:       string | null   // category id de CATEGORIES
  format:         'image' | 'video'
  hook_overlay:   string          // máx 40 chars (texto en pantalla)
  caption_es:     string          // caption para Instagram
  caption_short_tiktok: string    // versión corta para TikTok
  hashtags:       string[]
  visual_prompt:  string          // prompt detallado para fal.ai
}

const AUDIENCE_BRIEF: Record<Audience, string> = {
  clientes: `Este post va a las cuentas de CLIENTES: parejas, familias y personas que organizan una boda, comunión, cumpleaños o evento. Háblales solo a ellos (nunca a profesionales). Lo que más les preocupa es que el proveedor falle y no saber quién está detrás; lo que más les tranquiliza es el pago retenido hasta el evento y la garantía. Termina con una llamada suave: "enlace en la bio" o "pregúntanos por WhatsApp".`,
  proveedores: `Este post va a las cuentas de PROVEEDORES: fotógrafos, catering, música, animación, decoración y demás profesionales de eventos. Háblales solo a ellos. Termina invitando a darse de alta gratis ("enlace en la bio").`,
}

const FACTS = `Datos verdaderos (no inventes otros, ni cifras, reseñas, testimonios o clientes): alta gratis para profesionales, sin cuotas ni permanencia; el proveedor cobra el 100 % de su precio y el cliente paga un 8 % de Garantía de Éxito, ya incluido en el precio que ve; si el proveedor cancela, se busca un sustituto equivalente en 48 h y, si no lo hay, se devuelve el 110 %; si no se presenta, el 100 % más una compensación de hasta 3.000 €; el pago queda retenido hasta el evento; proveedores verificados (DNI/CIF y seguro de responsabilidad civil); precio cerrado; detrás está Mariano González, el fundador, y se puede preguntar por WhatsApp de lunes a viernes de 10:00 a 20:00.`

async function planPostWithClaude(userPrompt: string, audience: Audience): Promise<PostPlan> {
  const sysPrompt = `Eres el agente de marketing de FiestaGo, un marketplace español de celebraciones (bodas, cumpleaños, eventos privados).

${AUDIENCE_BRIEF[audience]}

${FACTS}

Categorías disponibles (id : etiqueta):
${CATEGORIES.map((c: any) => `- ${c.id}: ${c.label}`).join('\n')}

Ciudades habituales: ${CITIES.join(', ')}.

El admin de FiestaGo te pide que crees UN post para publicar en Instagram y TikTok. Devuelve SOLO un JSON con esta estructura exacta (sin explicaciones, sin markdown):

{
  "post_type":      "inspiration | tip_educational | pack_promo | social_proof | behind_scenes | fomo_seasonal | custom",
  "city":           "Madrid|Barcelona|...|null si no aplica",
  "category":       "foto|catering|...|null si no aplica",
  "format":         "image | video",
  "hook_overlay":   "Texto MUY corto (máx 40 chars) que aparecerá en pantalla. Atractivo, gancho.",
  "caption_es":     "Caption para Instagram, 80-150 palabras, tono vibrante y joven, emojis sí, hashtags NO van aquí. Termina con la llamada a la acción indicada arriba.",
  "caption_short_tiktok": "Versión corta para TikTok, máx 100 caracteres",
  "hashtags":       ["max", "12", "hashtags", "sin", "almohadilla", "todos", "en", "minusculas"],
  "visual_prompt":  "Prompt DETALLADO en INGLÉS para un modelo de imagen profesional (Flux). Descripción visual cinematográfica, 50-80 palabras. Estilo editorial, elegante, foto-realista, marca FiestaGo (NO menciones la marca en el visual). Para bodas/eventos en España, look mediterráneo, luz natural cálida."
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: sysPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Claude error')

  const text = (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')

  // Extraer JSON
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Claude no devolvió JSON válido')
  return JSON.parse(match[0])
}

async function generateImageWithFal(prompt: string): Promise<string> {
  // fal.ai Flux 1.1 Pro
  const res = await fetch('https://fal.run/fal-ai/flux-pro/v1.1', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'square_hd',  // 1024x1024, perfecto para IG/TikTok
      num_inference_steps: 28,
      enable_safety_checker: true,
    }),
  })
  if (!process.env.FAL_KEY) throw new Error('fal.ai: falta FAL_KEY en Netlify')
  const text = await res.text()
  let data: any = {}
  try { data = JSON.parse(text) } catch { /* respuesta no JSON */ }
  // fal.ai devuelve el motivo en `detail` (saldo agotado, clave inválida…)
  const detail = typeof data.detail === 'string' ? data.detail : data.detail ? JSON.stringify(data.detail) : data.error
  if (!res.ok || detail) throw new Error(`fal.ai ${res.status}: ${String(detail || text).slice(0, 300)}`)
  const url = data.images?.[0]?.url
  if (!url) throw new Error(`fal.ai no devolvió imagen: ${text.slice(0, 200)}`)
  return url
}

async function uploadToSupabaseStorage(imageUrl: string, filename: string): Promise<string> {
  // Descargar la imagen y subirla a Supabase Storage (bucket social-posts)
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error('No se pudo descargar la imagen de fal.ai')
  const buffer = Buffer.from(await imgRes.arrayBuffer())

  const supabase = createAdminClient()
  const path = `custom/${filename}`
  const { error } = await supabase.storage
    .from('social-posts')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Supabase Storage: ${error.message}`)

  const { data: pub } = supabase.storage.from('social-posts').getPublicUrl(path)
  return pub.publicUrl
}

// POST /api/admin/marketing/custom
// body: { prompt: string }
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const userPrompt: string = (body.prompt || '').trim()
    if (!userPrompt) {
      return NextResponse.json({ error: 'Falta el prompt' }, { status: 400 })
    }

    // Cuentas de destino: clientes (las de siempre) o proveedores (las nuevas)
    const audience: Audience = body.audience === 'clientes' ? 'clientes' : 'proveedores'

    // 1) Plan del post con Claude
    const plan = await planPostWithClaude(userPrompt, audience)

    // 2) Forzar formato 'image' por ahora (vídeo lo manejará el agente diario por timeout)
    const format: 'image' | 'video' = 'image'

    // 3) Generar imagen
    const falUrl  = await generateImageWithFal(plan.visual_prompt)
    const ts      = Date.now()
    const filename= `${ts}-${(plan.post_type || 'custom').replace(/[^a-z0-9]/gi, '_')}.jpg`
    const mediaUrl= await uploadToSupabaseStorage(falUrl, filename)

    // 4) Guardar en social_posts como pending
    const supabase = createAdminClient()
    const { data: row, error } = await supabase
      .from('social_posts')
      .insert({
        template_id:       `custom_${plan.post_type || 'request'}`,
        template_label:    'Generado a medida',
        city:              plan.city,
        category:          plan.category,
        media_type:        format,
        media_url:         mediaUrl,
        platform:          'both',
        hook_overlay:      plan.hook_overlay,
        caption_instagram: plan.caption_es,
        caption_tiktok:    plan.caption_short_tiktok,
        hashtags:          plan.hashtags || [],
        visual_prompt:     plan.visual_prompt,
        user_prompt:       userPrompt,
        prompt_used:       plan.visual_prompt,
        topic:             userPrompt.slice(0, 200),
        status:            'pending',
        audience,
        // Experimento del Agente CEO al que pertenece el post (si lo hay)
        context:           typeof body.experiment === 'string' && body.experiment ? { experiment: body.experiment.slice(0, 80) } : null,
      })
      .select()
      .single()

    if (error) throw new Error(`Supabase insert: ${error.message}`)

    return NextResponse.json({ success: true, post: row, plan })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error inesperado' }, { status: 500 })
  }
}
