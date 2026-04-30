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

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Claude error ${res.status}: ${errorText}`)
  }

  const data = await res.json()
  return (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
}

async function searchWithApify(query: string) {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error('Falta APIFY_API_TOKEN en Netlify')
  }

  const url =
    `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items` +
    `?token=${process.env.APIFY_API_TOKEN}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      queries: query,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      countryCode: 'es',
      languageCode: 'es',
    }),
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`Apify error ${res.status}: ${text}`)
  }

  const data = JSON.parse(text)

  console.log('[APIFY RAW]', JSON.stringify(data, null, 2))

  const results: any[] = []

  for (const item of data || []) {
    const organic =
      item.organicResults ||
      item.nonPromotedSearchResults ||
      item.results ||
      []

    for (const r of organic) {
      results.push({
        title: r.title || r.name || '',
        url: r.url || r.link || '',
        description: r.description || r.snippet || '',
      })
    }
  }

  return results.filter(r => r.title && r.url)
}

function safeJsonArray(text: string) {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Claude no devolvió un JSON array válido')
  return JSON.parse(match[0])
}

function safeJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Claude no devolvió un JSON object válido')
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { category, city, count = 5, tone = 'profesional y cercano' } = await req.json()

  const catObj = CATEGORIES.find(c => c.id === category)
  if (!catObj) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  }

  const { data: session } = await supabase
    .from('agent_sessions')
    .insert({
      category,
      city,
      sources: ['apify_google'],
      target_count: count,
      tone,
      status: 'running',
    })
    .select()
    .single()

  const sessionId = session?.id
  const logs: string[] = []
  const addLog = (msg: string) => {
    logs.push(msg)
    console.log('[AGENT]', msg)
  }

  try {
    addLog(`🤖 Agente iniciado — ${catObj.label} en ${city}`)
    addLog(`🌐 Buscando proveedores reales en internet con Apify...`)

    const query = `${catObj.label} ${city} proveedor eventos bodas cumpleaños catering banquetes site:.es`
    const apifyResults = await searchWithApify(query)

    addLog(`🔎 Apify devolvió ${apifyResults.length} resultados brutos`)

    if (!apifyResults.length) {
      throw new Error('No se encontraron proveedores en Apify')
    }

    const searchText = await claudeCall(
      `Eres un analista de datos para FiestaGo. 
Tu tarea es convertir resultados reales de Google en proveedores estructurados.
NO inventes proveedores.
NO inventes webs.
Si falta email, teléfono o Instagram, usa null.
Responde SOLO con JSON válido, sin markdown.`,
      `Categoría: ${catObj.label}
Ciudad: ${city}
Cantidad máxima: ${count}

Resultados reales encontrados:
${JSON.stringify(apifyResults, null, 2)}

Devuelve SOLO este JSON array:
[
  {
    "name": "nombre del negocio real según el resultado",
    "type": "tipo específico de servicio",
    "city": "${city}",
    "address": null,
    "phone": null,
    "email": null,
    "website": "URL real encontrada",
    "instagram": null,
    "avgPrice": null,
    "priceUnit": "por evento",
    "strengths": ["fortaleza inferida desde el resultado"],
    "weaknesses": ["dato incompleto"],
    "estimatedRating": null,
    "estimatedReviews": null,
    "yearsActive": null,
    "specialties": ["especialidad 1", "especialidad 2"],
    "description": "descripción breve basada solo en el resultado real"
  }
]`
    )

    const rawProviders = safeJsonArray(searchText).slice(0, count)

    if (!rawProviders.length) {
      throw new Error('No se encontraron proveedores después de procesar resultados')
    }

    addLog(`✅ ${rawProviders.length} proveedores reales estructurados`)

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
Web: ${p.website}
Descripción: ${p.description}
Especialidades: ${p.specialties?.join(', ')}

Score A = añadir directamente, B = contactar primero, C = revisar, D = descartar

Responde con este JSON exacto:
{
  "score": "B",
  "scoreReason": "razón en 1 frase",
  "fitScore": 7,
  "recommendation": "CONTACTAR",
  "priority": "MEDIA",
  "notes": "nota interna para el equipo",
  "estimatedConversionProb": 50,
  "suggestedTag": "Nuevo",
  "missingData": []
}`
      )

      const qual = safeJsonObject(qualText)

      let emailDraft = ''
      if (qual.recommendation !== 'DESCARTAR') {
        addLog(`✉️ Generando email para: ${p.name}`)

        emailDraft = await claudeCall(
          `Eres el equipo de partnerships de FiestaGo. Tono: ${tone}. Escribe solo el email, sin explicaciones adicionales.`,
          `Escribe un email de outreach para invitar a este proveedor a unirse a FiestaGo:

Proveedor: ${p.name}
Tipo: ${p.type}
Ciudad: ${p.city}
Web: ${p.website}
Especialidades: ${p.specialties?.join(', ')}

FiestaGo propuesta de valor:
- Registro 100% GRATIS
- Primera transacción SIN comisión
- Solo 8% de comisión desde la segunda venta
- Leads cualificados de parejas y familias
- Panel de gestión y pagos seguros integrados

Formato:
ASUNTO: [asunto personalizado]

[cuerpo del email, máximo 150 palabras]

Firma: El equipo de FiestaGo | partnerships@fiestago.es`
        )
      }

      const { data: savedProvider, error: saveError } = await supabase
        .from('providers')
        .insert({
          name: p.name,
          category,
          city: p.city || city,
          email: p.email || null,
          phone: p.phone || null,
          website: p.website || null,
          instagram: p.instagram || null,
          description: p.description || null,
          price_base: p.avgPrice || null,
          price_unit: p.priceUnit || 'por evento',
          specialties: p.specialties || [],
          source: 'web' as any,
          status: qual.recommendation === 'AÑADIR' ? 'approved' : 'pending',
          tag: qual.suggestedTag || 'Nuevo',
          agent_score: qual.score,
          agent_notes: qual.notes,
          agent_fit_score: qual.fitScore,
          conversion_prob: qual.estimatedConversionProb,
          outreach_sent: false,
          outreach_email: emailDraft || null,
        })
        .select()
        .single()

      if (saveError) {
        addLog(`⚠️ Error guardando ${p.name}: ${saveError.message}`)
      }

      qualifiedProviders.push({
        ...p,
        ...qual,
        id: savedProvider?.id,
        emailDraft,
        savedToDb: !!savedProvider,
      })

      addLog(`   → Score ${qual.score} | ${qual.recommendation} | ${qual.estimatedConversionProb}% conv.`)
    }

    const added = qualifiedProviders.filter(p => p.recommendation === 'AÑADIR').length
    const emailed = qualifiedProviders.filter(p => p.emailDraft).length

    await supabase
      .from('agent_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        found_count: rawProviders.length,
        qualified_count: qualifiedProviders.length,
        added_count: added,
        emailed_count: emailed,
        score_a: qualifiedProviders.filter(p => p.score === 'A').length,
        score_b: qualifiedProviders.filter(p => p.score === 'B').length,
      })
      .eq('id', sessionId)

    addLog(`🎉 Agente completado — ${added} añadidos, ${emailed} emails generados`)

    return NextResponse.json({
      success: true,
      sessionId,
      providers: qualifiedProviders,
      stats: {
        found: rawProviders.length,
        added,
        emailed,
        scoreA: qualifiedProviders.filter(p => p.score === 'A').length,
        scoreB: qualifiedProviders.filter(p => p.score === 'B').length,
      },
      logs,
    })
  } catch (err: any) {
    addLog(`❌ Error: ${err.message}`)

    await supabase
      .from('agent_sessions')
      .update({
        status: 'error',
        error_msg: err.message,
      })
      .eq('id', sessionId)

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
