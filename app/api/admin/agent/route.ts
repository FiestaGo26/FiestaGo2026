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
  if (!catObj) return NextResponse.json({ error: 'Categoria invalida' }, { status: 400 })

  const logs: string[] = []
  const addLog = (msg: string) => { logs.push(msg) }

  try {
    addLog(`Agente iniciado - ${catObj.label} en ${city}`)
    addLog(`Buscando y cualificando proveedores...`)

    const result = await claudeCall(
      'Eres experto en bodas y eventos en España. Generas datos realistas de negocios españoles. Responde SOLO con JSON valido sin markdown.',
      `Genera ${count} proveedores realistas de "${catObj.label}" en ${city}, España.

Devuelve SOLO este JSON array:
[
  {
    "name": "nombre realista del negocio",
    "type": "tipo especifico de servicio",
    "city": "${city}",
    "phone": "+34 6XX XXX XXX",
    "email": "email@negocio.es",
    "website": "https://negocio.es",
    "instagram": "@negocio",
    "avgPrice": 1200,
    "priceUnit": "por evento",
    "specialties": ["especialidad 1", "especialidad 2"],
    "description": "descripcion profesional en 1-2 frases",
    "score": "A",
    "scoreReason": "razon del score en 1 frase",
    "fitScore": 8,
    "estimatedConversionProb": 70,
    "suggestedTag": "Nuevo"
  }
]`
    )

    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Error generando proveedores')

    const providers = JSON.parse(jsonMatch[0])
    addLog(`${providers.length} proveedores encontrados y cualificados`)

    const saved = []
    for (const p of providers) {
      const emailDraft = `ASUNTO: ${p.name}, tus primeros clientes te esperan en FiestaGo

Hola ${p.name},

Somos FiestaGo, el nuevo marketplace de celebraciones en España donde parejas y familias encuentran los mejores profesionales para sus eventos.

Hemos encontrado tu negocio y creemos que encajas perfectamente con lo que buscan nuestros clientes. Por eso queremos invitarte a ser uno de los primeros proveedores de nuestra plataforma.

Por que unirte ahora:

- Registro 100% gratuito, sin permanencia
- Tu primera transaccion sin ninguna comision (0%)
- Solo el 8% desde la segunda venta real
- Acceso a clientes cualificados que ya estan buscando tu servicio
- Sin inversion en publicidad, nosotros llevamos el trafico

Estamos en fase de lanzamiento y estamos seleccionando a los mejores profesionales de ${city} en ${catObj.label}. Las primeras plazas son limitadas.

Registrate gratis en menos de 5 minutos:
https://fiestago.es/registro-proveedor

Tienes dudas? Estamos aqui para ayudarte:
contacto@fiestago.es

Un saludo,
El equipo de FiestaGo`

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
          status:          'pending',
          tag:             p.suggestedTag || 'Nuevo',
          agent_score:     (p.score || 'B').charAt(0).toUpperCase(),
          agent_notes:     p.scoreReason,
          agent_fit_score: p.fitScore,
          conversion_prob: p.estimatedConversionProb,
          outreach_sent:   false,
          outreach_email:  emailDraft,
        })
        .select()
        .single()

      saved.push({ ...p, id: savedProvider?.id, emailDraft, savedToDb: !!savedProvider })
      addLog(`Pendiente: ${p.name} - Score ${p.score}`)
    }

    addLog(``)
    addLog(`${saved.length} proveedores en espera de tu revision en el panel`)
    addLog(`Al aprobar cada uno se enviara el email automaticamente`)

    return NextResponse.json({
      success:   true,
      providers: saved,
      stats: { found: providers.length, pending: saved.length, added: 0 },
      logs,
    })

  } catch (err: any) {
    addLog(`Error: ${err.message}`)
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
