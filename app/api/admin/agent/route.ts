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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  const data = await res.json()
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
  const { category, city, count = 5, tone = 'profesional y cercano' } = await req.json()

  const catObj = CATEGORIES.find(c => c.id === category)
  if (!catObj) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })

  const { data: session } = await supabase
    .from('agent_sessions')
    .insert({ category, city, sources: ['ia'], target_count: count, tone, status: 'running' })
    .select()
    .single()

  const sessionId = session?.id
  const logs: string[] = []
  const addLog = (msg: string) => { logs.push(msg); console.log('[AGENT]', msg) }

  try {
    addLog(`🤖 Agente iniciado — ${catObj.label} en ${city}`)
    addLog(`🧠 Generando proveedores reales con IA...`)

    const searchText = await claudeCall(
      'Eres un experto en el sector de bodas y eventos en España. Generas datos MUY REALISTAS de negocios españoles. Responde SOLO con JSON válido, sin markdown ni texto adicional.',
      `Genera ${count} proveedores REALISTAS y DETALLADOS de "${catObj.label}" en ${city}, España.

Usa nombres de negocios típicos españoles, emails profesionales reales, precios de mercado actuales en España, y descripciones auténticas basadas en cómo trabajan estos negocios en España.

Devuelve SOLO este JSON array exacto:
[
  {
    "name": "nombre realista del negocio",
    "type": "tipo específico de servicio",
    "city": "${city}",
    "address": "dirección realista de ${city}",
    "phone": "número español realista como +34 6XX XXX XXX",
    "email": "email profesional realista",
    "website": "URL realista",
    "instagram": "@usuario realista",
    "avgPrice": precio en euros (número),
    "priceUnit": "por evento o por persona o por hora",
    "strengths": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
    "weaknesses": ["debilidad 1"],
    "estimatedRating": número entre 4.0 y 5.0,
    "estimatedReviews": número entre 10 y 300,
    "yearsActive": número entre 2 y 15,
    "specialties": ["especialidad 1", "especialidad 2"],
    "description": "descripción profesional realista en 1-2 frases"
  }
]`
    )

    const jsonMatch = searchText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Error generando proveedores')

    const rawProviders = JSON.parse(jsonMatch[0])
    addLog(`✅ ${rawProviders.length} proveedores generados`)

    const qualifiedProviders = []

    for (let i = 0; i < rawProviders.length; i++) {
      const p = rawProviders[i]
      addLog(`📊 [${i + 1}/${rawProviders.length}] Cualificando: ${p.name}`)

      const qualText = await claudeCall(
        'Analista de proveedores FiestaGo. Responde SOLO con JSON válido.',
        `Evalúa este proveedor para FiestaGo:
Nombre: ${p.name}
Categoría: ${catObj.label}
Ciudad: ${p.city}
Precio: ${p.avgPrice}€ ${p.priceUnit}
Años activo: ${p.yearsActive}
Rating estimado: ${p.estimatedRating}
Reseñas: ${p.estimatedReviews}
Fortalezas: ${p.strengths?.join(', ')}

Score A = añadir directamente, B = contactar primero, C = revisar, D = descartar

Responde con este JSON exacto:
{
  "score": "A",
  "scoreReason": "razón en 1 frase",
  "fitScore": 8,
  "recommendation": "AÑADIR",
  "priority": "ALTA",
  "notes": "nota interna para el equipo",
  "estimatedConversionProb": 70,
  "suggestedTag": "Nuevo",
  "missingData": []
}`
      )

      const qualMatch = qualText.match(/\{[\s\S]*\}/)
      const qual = qualMatch ? JSON.parse(qualMatch[0]) : {
        score: 'B', recommendation: 'CONTACTAR', priority: 'MEDIA',
        fitScore: 6, scoreReason: 'Buen candidato', notes: 'Revisar disponibilidad',
        estimatedConversionProb: 50, suggestedTag: 'Nuevo', missingData: [],
      }

      let emailDraft = ''
      if (qual.recommendation !== 'DESCARTAR') {
        addLog(`✉️ Generando email para: ${p.name}`)
        emailDraft = await claudeCall(
          `Eres el equipo de partnerships de FiestaGo. Tono: ${tone}. Escribe solo el email, sin explicaciones adicionales.`,
          `Escribe un email de outreach para invitar a este proveedor a unirse a FiestaGo:

Proveedor: ${p.name}
Tipo: ${p.type}
Ciudad: ${p.city}
Precio: ${p.avgPrice}€ ${p.priceUnit}
Especialidades: ${p.specialties?.join(', ')}

FiestaGo propuesta de valor:
- Registro 100% GRATIS
- Primera transacción SIN comisión (0%)
- Solo 8% de comisión desde la segunda venta
- Leads cualificados de parejas y familias
- Panel de gestión y pagos seguros integrados

Formato:
ASUNTO: [asunto personalizado y atractivo]

[cuerpo del email, máximo 150 palabras, muy personalizado con el nombre del negocio]

Firma: El equipo de FiestaGo | partnerships@fiegago.es`
        )
      }

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
          status:          qual.recommendation === 'AÑADIR' ? 'approved' : 'pending',
          tag:             qual.suggestedTag || 'Nuevo',
          agent_score:     qual.score,
          agent_notes:     qual.notes,
          agent_fit_score: qual.fitScore,
          conversion_prob: qual.estimatedConversionProb,
          outreach_sent:   false,
          outreach_email:  emailDraft || null,
        })
        .select()
        .single()

      qualifiedProviders.push({
        ...p, ...qual,
        id:          savedProvider?.id,
        emailDraft,
        savedToDb:   !!savedProvider,
      })

      addLog(`   → Score ${qual.score} | ${qual.recommendation} | ${qual.estimatedConversionProb}% conv.`)
    }

    const added   = qualifiedProviders.filter(p => p.recommendation === 'AÑADIR').length
    const emailed = qualifiedProviders.filter(p => p.emailDraft).length

    await supabase.from('agent_sessions').update({
      status:          'completed',
      completed_at:    new Date().toISOString(),
      found_count:     rawProviders.length,
      qualified_count: qualifiedProviders.length,
      added_count:     added,
      emailed_count:   emailed,
      score_a:         qualifiedProviders.filter(p => p.score === 'A').length,
      score_b:         qualifiedProviders.filter(p => p.score === 'B').length,
    }).eq('id', sessionId)

    addLog(`🎉 Agente completado — ${added} añadidos, ${emailed} emails generados`)

    return NextResponse.json({
      success:   true,
      sessionId,
      providers: qualifiedProviders,
      stats: {
        found:  rawProviders.length,
        added,
        emailed,
        scoreA: qualifiedProviders.filter(p => p.score === 'A').length,
        scoreB: qualifiedProviders.filter(p => p.score === 'B').length,
      },
      logs,
    })

  } catch (err: any) {
    addLog(`❌ Error: ${err.message}`)
    await supabase.from('agent_sessions').update({
      status:    'error',
      error_msg: err.message,
    }).eq('id', sessionId)
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
