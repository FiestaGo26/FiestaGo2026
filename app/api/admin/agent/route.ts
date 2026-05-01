import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

async function claudeCall(system: string, user: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { category, city, count = 3, tone = 'profesional y cercano' } = await req.json()

  const catObj = CATEGORIES.find(c => c.id === category)
  if (!catObj) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })

  const logs: string[] = []
  const addLog = (msg: string) => { logs.push(msg) }

  try {
    addLog(`🤖 Agente iniciado — ${catObj.label} en ${city}`)
    addLog(`🧠 Generando y cualificando proveedores con IA...`)

    // Una sola llamada que hace todo
    const result = await claudeCall(
      'Eres experto en bodas y eventos en España. Generas datos realistas de negocios españoles y los evalúas para FiestaGo. Responde SOLO con JSON válido.',
      `Genera ${count} proveedores realistas de "${catObj.label}" en ${city}, España, y evalúa cada uno para FiestaGo.

Para cada proveedor incluye tanto los datos del negocio como la evaluación.

Devuelve SOLO este JSON array:
[
  {
    "name": "nombre realista",
    "type": "tipo específico",
    "city": "${city}",
    "phone": "+34 6XX XXX XXX",
    "email": "email@negocio.es",
    "website": "https://negocio.es",
    "instagram": "@negocio",
    "avgPrice": 1200,
    "priceUnit": "por evento",
    "specialties": ["especialidad 1", "especialidad 2"],
    "description": "descripción profesional en 1-2 frases",
    "score": "A",
    "recommendation": "AÑADIR",
    "scoreReason": "razón del score",
    "fitScore": 8,
    "estimatedConversionProb": 70,
    "suggestedTag": "Nuevo",
    "emailSubject": "asunto del email de outreach personalizado",
    "emailBody": "cuerpo del email de outreach en máximo 100 palabras, tono ${tone}"
  }
]`
    )

    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Error generando proveedores')

    const providers = JSON.parse(jsonMatch[0])
    addLog(`✅ ${providers.length} proveedores generados y cualificados`)

    const saved = []
    for (const p of providers) {
      const emailDraft = p.emailSubject && p.emailBody
        ? `ASUNTO: ${p.emailSubject}\n\n${p.emailBody}\n\nFiestaGo Partnerships | partnerships@fiegago.es`
        : ''

      const { data: savedProvider } = await supabase
        .from('providers')
        .insert({
          name:            p.name,
          category,
          city:            p.city || city,
          email:           p.email || null,
          phone:           p.phone || null,
          website:         p.website || null,
          instagram:       p.instagram || null,
          description:     p.description,
          price_base:      p.avgPrice,
          price_unit:      p.priceUnit || 'por evento',
          specialties:     p.specialties || [],
          source:          'web' as any,
          status:          p.recommendation === 'AÑADIR' ? 'approved' : 'pending',
          tag:             p.suggestedTag || 'Nuevo',
          agent_score:     (p.score || 'B').charAt(0).toUpperCase(),
          agent_notes:     p.scoreReason,
          agent_fit_score: p.fitScore,
          conversion_prob: p.estimatedConversionProb,
          outreach_sent:   false,
          outreach_email:  emailDraft || null,
        })
        .select()
        .single()

      saved.push({ ...p, id: savedProvider?.id, emailDraft, savedToDb: !!savedProvider })
      addLog(`   ✓ ${p.name} — Score ${p.score} | ${p.recommendation}`)
    }

    const added   = saved.filter(p => p.recommendation === 'AÑADIR').length
    const emailed = saved.filter(p => p.emailDraft).length

    addLog(`🎉 Completado — ${added} añadidos, ${emailed} emails generados`)

    return NextResponse.json({
      success: true,
      providers: saved,
      stats: { found: providers.length, added, emailed },
      logs,
    })

  } catch (err: any) {
    addLog(`❌ Error: ${err.message}`)
    return NextResponse.json({ error: err.message, logs }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('agent_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  return NextResponse.json({ sessions: data || [] })
}
