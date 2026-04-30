import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'
 
function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}
 
async function claudeCall(system: string, user: string, useWebSearch = false) {
  const body: any = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: user }],
  }
  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
}
 
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
 
  const supabase = createAdminClient()
  const { category, city, count = 5, tone = 'profesional y cercano' } = await req.json()
 
  const catObj = CATEGORIES.find(c => c.id === category)
  if (!catObj) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
 
  const { data: session } = await supabase
    .from('agent_sessions')
    .insert({ category, city, sources: ['web'], target_count: count, tone, status: 'running' })
    .select()
    .single()
 
  const sessionId = session?.id
  const logs: string[] = []
  const addLog = (msg: string) => { logs.push(msg); console.log('[AGENT]', msg) }
 
  try {
    addLog(`🤖 Agente iniciado — ${catObj.label} en ${city}`)
    addLog(`🌐 Buscando proveedores reales en internet...`)
 
    const searchText = await claudeCall(
      'Agente de captación FiestaGo. Busca negocios REALES. Responde SOLO con JSON válido, sin markdown.',
      `Busca en internet ${count} proveedores reales de "${catObj.label}" en ${city}, España.
Devuelve SOLO un JSON array:
[{"name":"nombre","type":"tipo","city":"${city}","email":"","phone":"","website":"","instagram":"",
"source":"URL","yearsActive":5,"avgPrice":1200,"priceUnit":"por evento",
"strengths":["s1"],"weaknesses":["w1"],"estimatedRating":4.5,"estimatedReviews":50,
"specialties":["e1"],"description":"desc real"}]`,
      true
    )
 
    const jsonMatch = searchText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No se encontraron proveedores')
 
    const rawProviders = JSON.parse(jsonMatch[0])
    addLog(`✅ ${rawProviders.length} proveedores encontrados`)
 
    const qualifiedProviders = []
 
    for (let i = 0; i < rawProviders.length; i++) {
      const p = rawProviders[i]
      addLog(`📊 Cualificando: ${p.name}`)
 
      const qualText = await claudeCall(
        'Analista FiestaGo. Solo JSON válido.',
        `Evalúa: ${p.name} | ${catObj.label} | ${p.city} | ${p.avgPrice}€ | email:${p.email ? 'SÍ' : 'NO'}
Score A=añadir,B=contactar,C=revisar,D=descartar
{"score":"A","scoreReason":"1 frase","fitScore":8,"recommendation":"AÑADIR","priority":"ALTA",
"notes":"nota","estimatedConversionProb":65,"suggestedTag":"Nuevo","missingData":["email"]}`
      )
 
      const qualMatch = qualText.match(/\{[\s\S]*\}/)
      const qual = qualMatch ? JSON.parse(qualMatch[0]) : {
        score: 'C', recommendation: 'CONTACTAR', priority: 'MEDIA',
        fitScore: 5, scoreReason: 'Sin análisis', notes: '',
        estimatedConversionProb: 35, suggestedTag: 'Nuevo', missingData: [],
      }
 
      let emailDraft = ''
      if (qual.recommendation !== 'DESCARTAR') {
        addLog(`✉️ Generando email para: ${p.name}`)
        emailDraft = await claudeCall(
          `Equipo partnerships FiestaGo. Tono: ${tone}. Solo el email.`,
          `Email outreach para: ${p.name} (${p.type}, ${p.city})
FiestaGo: registro gratis, 1ª transacción 0%, 8% desde 2ª venta.
ASUNTO: [asunto]\n\n[cuerpo max 150 palabras]\nFiestaGo Partnerships`
        )
      }
 
      const { data: savedProvider } = await supabase
        .from('providers')
        .insert({
          name: p.name, category, city: p.city || city,
          email: p.email || null, phone: p.phone || null,
          website: p.website || null, instagram: p.instagram || null,
          description: p.description, price_base: p.avgPrice,
          price_unit: p.priceUnit || 'por evento',
          specialties: p.specialties || [],
          source: 'web' as any,
          status: qual.recommendation === 'AÑADIR' ? 'approved' : 'pending',
          tag: qual.suggestedTag || 'Nuevo',
          agent_score: qual.score, agent_notes: qual.notes,
          agent_fit_score: qual.fitScore,
          conversion_prob: qual.estimatedConversionProb,
          outreach_sent: false,
          outreach_email: emailDraft || null,
        })
        .select()
        .single()
 
      qualifiedProviders.push({
        ...p, ...qual, id: savedProvider?.id, emailDraft, savedToDb: !!savedProvider,
      })
 
      addLog(`   Score ${qual.score} | ${qual.recommendation} | ${qual.estimatedConversionProb}% conv.`)
    }
 
    const added   = qualifiedProviders.filter(p => p.recommendation === 'AÑADIR').length
    const emailed = qualifiedProviders.filter(p => p.emailDraft).length
 
    await supabase.from('agent_sessions').update({
      status: 'completed', completed_at: new Date().toISOString(),
      found_count: rawProviders.length, qualified_count: qualifiedProviders.length,
      added_count: added, emailed_count: emailed,
      score_a: qualifiedProviders.filter(p => p.score === 'A').length,
      score_b: qualifiedProviders.filter(p => p.score === 'B').length,
    }).eq('id', sessionId)
 
    addLog(`🎉 Agente completado — ${added} añadidos, ${emailed} emails generados`)
 
    return NextResponse.json({
      success: true, sessionId, providers: qualifiedProviders,
      stats: { found: rawProviders.length, added, emailed },
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
 
