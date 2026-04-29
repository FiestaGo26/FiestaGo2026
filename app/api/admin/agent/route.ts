import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'
import Anthropic from '@anthropic-ai/sdk'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/admin/agent — run provider acquisition agent
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { category, city, count = 5, tone = 'profesional y cercano', sources = ['web'] } = await req.json()

  const catObj = CATEGORIES.find(c => c.id === category)
  if (!catObj) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })

  // Create agent session record
  const { data: session } = await supabase
    .from('agent_sessions')
    .insert({ category, city, sources, target_count: count, tone, status: 'running' })
    .select()
    .single()

  const sessionId = session?.id

  // Return immediately — processing happens async via streaming
  // For simplicity we run synchronously and stream logs via Server-Sent Events
  // In production, use a job queue (e.g. Vercel Cron or Inngest)

  const logs: string[] = []
  const addLog = (msg: string) => { logs.push(msg); console.log('[AGENT]', msg) }

  try {
    addLog(`🤖 Agente iniciado — ${catObj.label} en ${city}`)

    // ── SEARCH via Claude web_search ──────────────────────────────────────
    addLog(`🌐 Buscando proveedores reales en internet...`)

    const searchMessages: any[] = [{
      role: 'user',
      content: `Busca en internet ${count} proveedores reales de "${catObj.label}" en ${city}, España.
Usa web_search para encontrar negocios reales. Devuelve SOLO un JSON array:
[{"name":"nombre","type":"tipo","city":"${city}","email":"","phone":"","website":"","instagram":"",
"source":"URL","yearsActive":5,"avgPrice":1200,"priceUnit":"por evento",
"strengths":["s1"],"weaknesses":["w1"],"estimatedRating":4.5,"estimatedReviews":50,
"specialties":["e1"],"description":"desc real"}]`,
    }]

    const searchResp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
      system: 'Agente de captación FiestaGo. Busca negocios REALES. Responde SOLO con JSON válido.',
      messages: searchMessages,
    })

    const searchText = searchResp.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    const jsonMatch = searchText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No se encontraron proveedores')

    const rawProviders = JSON.parse(jsonMatch[0])
    addLog(`✅ ${rawProviders.length} proveedores encontrados`)

    const qualifiedProviders = []
    for (let i = 0; i < rawProviders.length; i++) {
      const p = rawProviders[i]
      addLog(`📊 Cualificando: ${p.name}`)

      // Qualify with Claude
      const qualResp = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: 'Analista FiestaGo. Solo JSON válido.',
        messages: [{
          role: 'user',
          content: `Evalúa: ${p.name} | ${catObj.label} | ${p.city} | ${p.avgPrice}€ | email:${p.email?'SÍ':'NO'}
Score A=añadir,B=contactar,C=revisar,D=descartar
{"score":"A","scoreReason":"1 frase","fitScore":8,"recommendation":"AÑADIR","priority":"ALTA",
"notes":"nota","estimatedConversionProb":65,"suggestedTag":"Nuevo","missingData":["email"]}`,
        }],
      })

      const qualText = qualResp.content.map((b: any) => b.text || '').join('')
      const qualMatch = qualText.match(/\{[\s\S]*\}/)
      const qual = qualMatch ? JSON.parse(qualMatch[0]) : {
        score: 'C', recommendation: 'CONTACTAR', priority: 'MEDIA',
        fitScore: 5, scoreReason: 'Sin análisis', notes: '',
        estimatedConversionProb: 35, suggestedTag: 'Nuevo', missingData: [],
      }

      // Generate outreach email if not discarded
      let emailDraft = ''
      if (qual.recommendation !== 'DESCARTAR') {
        addLog(`✉️ Generando email para: ${p.name}`)
        const emailResp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          system: `Equipo partnerships FiestaGo. Tono: ${tone}. Solo el email.`,
          messages: [{
            role: 'user',
            content: `Email outreach para: ${p.name} (${p.type}, ${p.city})
FiestaGo: registro gratis, 1ª transacción 0%, 8% desde 2ª venta.
ASUNTO: [asunto]\n\n[cuerpo max 150 palabras, personalizado]\nFiestaGo Partnerships`,
          }],
        })
        emailDraft = emailResp.content.map((b: any) => b.text || '').join('')
      }

      // Save to Supabase
      const { data: savedProvider } = await supabase
        .from('providers')
        .insert({
          name:         p.name,
          category,
          city:         p.city || city,
          email:        p.email || null,
          phone:        p.phone || null,
          website:      p.website || null,
          instagram:    p.instagram || null,
          description:  p.description,
          price_base:   p.avgPrice,
          price_unit:   p.priceUnit || 'por evento',
          specialties:  p.specialties || [],
          source:       (p.source?.includes('instagram') ? 'instagram' : p.source?.includes('tiktok') ? 'tiktok' : 'web') as any,
          status:       qual.recommendation === 'AÑADIR' ? 'approved' : 'pending',
          tag:          qual.suggestedTag || 'Nuevo',
          agent_score:  qual.score,
          agent_notes:  qual.notes,
          agent_fit_score: qual.fitScore,
          conversion_prob: qual.estimatedConversionProb,
          outreach_sent:   false,
          outreach_email:  emailDraft || null,
        })
        .select()
        .single()

      qualifiedProviders.push({
        ...p, ...qual,
        id: savedProvider?.id,
        emailDraft,
        savedToDb: !!savedProvider,
      })

      addLog(`   Score ${qual.score} | ${qual.recommendation} | ${qual.estimatedConversionProb}% conv.`)
    }

    const added   = qualifiedProviders.filter(p => p.recommendation === 'AÑADIR').length
    const emailed = qualifiedProviders.filter(p => p.emailDraft).length

    // Update session
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
      success: true,
      sessionId,
      providers:  qualifiedProviders,
      stats: {
        found:    rawProviders.length,
        added,
        emailed,
        scoreA:   qualifiedProviders.filter(p => p.score === 'A').length,
        scoreB:   qualifiedProviders.filter(p => p.score === 'B').length,
      },
      logs,
    })

  } catch (err: any) {
    addLog(`❌ Error: ${err.message}`)
    await supabase.from('agent_sessions').update({
      status: 'error', error_msg: err.message,
    }).eq('id', sessionId)

    return NextResponse.json({ error: err.message, logs }, { status: 500 })
  }
}

// GET /api/admin/agent — list past sessions
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('agent_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ sessions: data || [] })
}
