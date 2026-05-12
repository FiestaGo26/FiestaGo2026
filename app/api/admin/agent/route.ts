import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// Versión RÁPIDA del agente que cabe en el timeout de Netlify (10-26s).
// Hace una sola llamada a Claude Sonnet con la herramienta web_search,
// le pide que devuelva JSON con los proveedores encontrados, y los guarda.
//
// Para captación masiva (10×12 combinaciones) sigue usando el script local
// `fiegago-agent.mjs` que NO tiene limite de tiempo.

async function claudeWebSearch(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Claude error')
  return (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const logs: string[] = []
  const log = (m: string) => { logs.push(m) }

  try {
    const body = await req.json().catch(() => ({}))
    const { category = 'foto', city = 'Madrid', count = 3 } = body
    const cat = CATEGORIES.find(c => c.id === category)
    if (!cat) {
      return NextResponse.json({ error: 'Categoría inválida', logs }, { status: 400 })
    }

    log(`🤖 Agente rápido — ${cat.label} en ${city}`)
    log(`🌐 Buscando ${count} proveedores reales en Google...`)

    const prompt = `Busca en Google ${count} negocios reales de "${cat.label}" en ${city}, España. Para cada uno, encuentra: nombre exacto del negocio, email de contacto, teléfono, web, handle de Instagram (@usuario), descripción de 1 frase, precio medio aproximado en euros.

Devuelve SOLO un array JSON con esta forma exacta (sin texto antes ni después):
[
  {
    "name": "nombre del negocio",
    "email": "info@example.com" o "",
    "phone": "+34 ..." o "",
    "website": "https://..." o "",
    "instagram": "@usuario" o "",
    "description": "frase corta",
    "avgPrice": 1200,
    "city": "${city}",
    "specialties": ["e1","e2"]
  }
]

Solo negocios profesionales reales, no particulares. Si no encuentras ${count}, devuelve los que encuentres.`

    const text = await claudeWebSearch(prompt)
    log(`✅ Búsqueda completada`)

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      log(`⚠️ No se pudo extraer JSON de la respuesta`)
      return NextResponse.json({ error: 'No se encontraron proveedores en formato válido', logs }, { status: 200 })
    }

    let providers: any[] = []
    try {
      providers = JSON.parse(match[0])
    } catch (e) {
      log(`⚠️ JSON inválido en respuesta`)
      return NextResponse.json({ error: 'Formato JSON inválido', logs }, { status: 200 })
    }

    if (!providers.length) {
      log(`❌ Sin resultados`)
      return NextResponse.json({ providers: [], logs, stats: { found: 0, saved: 0 } })
    }

    log(`📊 ${providers.length} proveedores extraídos. Guardando en Supabase...`)

    const supabase = createAdminClient()
    const saved: any[] = []
    for (const p of providers) {
      const email = p.email || null
      const phone = p.phone || null
      const websiteRaw = p.website || ''
      const isSocial = /instagram\.com|tiktok\.com/i.test(websiteRaw)
      const website = (websiteRaw && !isSocial) ? websiteRaw : null
      const instagram = p.instagram || null
      const contactable = !!(email || phone || website || instagram)

      // Mismo cuerpo de mensaje para email y DM
      const baseMessage = `Hola ${p.name},

Somos FiestaGo, un nuevo marketplace de celebraciones en España (bodas, cumpleaños, eventos privados y familiares). Lanzamos oficialmente el 10 de junio de 2026 y estamos seleccionando los primeros profesionales en ${city} para tener un catálogo de calidad desde el día uno.

Hemos visto tu trabajo y encajas con lo que buscan nuestros clientes.

Ventajas de entrar antes del lanzamiento:
- Mejor posición en los resultados (catálogo en construcción)
- Tu primera reserva sin comisión
- Solo 8% desde la segunda venta
- Sin permanencia ni cuotas mensuales
- Promoción gratuita en nuestras redes (@fiestagospain)

🏆 SELLO FIESTAGO DE CALIDAD
Te lo regalamos al entrar. Lo mantienes mientras conserves una nota mínima de 4,5/5 en tus reseñas. Es un sello visible junto a tu perfil que da confianza a los clientes y aumenta las reservas.

🤝 TRAE A UN COMPAÑERO Y SUBE
Si invitas a otro profesional de eventos y se registra en FiestaGo, los dos apareceréis automáticamente en los primeros puestos de vuestra categoría sin coste extra. Cuantos más traigas, más arriba.

Si quieres formar parte:
https://fiestago.es/registro-proveedor

Si tienes dudas, simplemente responde a este mensaje o escribe a contacto@fiestago.es.

Un saludo,
El equipo de FiestaGo`

      const emailDraft = email ? `ASUNTO: Tu negocio en FiestaGo · ${city}\n\n${baseMessage}` : ''
      const dmDraft    = instagram ? baseMessage : ''

      const { data: row } = await supabase
        .from('providers')
        .insert({
          name:            p.name,
          category:        category,
          city:            p.city || city,
          email,
          phone,
          website,
          instagram,
          description:     p.description || '',
          price_base:      p.avgPrice || null,
          price_unit:      'por evento',
          specialties:     p.specialties || [],
          source:          'web',
          status:          'pending',
          tag:             'Nuevo',
          contactable,
          outreach_sent:   false,
          outreach_email:  emailDraft,
          outreach_dm:     dmDraft,
        })
        .select()
        .single()

      saved.push({ ...p, id: row?.id, savedToDb: !!row, score: 'A', emailDraft })
      log(`   ✓ ${p.name} | ${email || instagram || 'sin contacto directo'}`)
    }

    log(``)
    log(`🎉 ${saved.length} proveedores guardados como pendientes`)
    log(`📋 Apruébalos desde el panel para enviar el outreach`)

    return NextResponse.json({
      success: true,
      providers: saved,
      stats: {
        found: providers.length,
        saved: saved.length,
        withEmail: saved.filter((p: any) => p.email).length,
        web: saved.length,
      },
      logs,
    })
  } catch (err: any) {
    log(`❌ Error: ${err.message}`)
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
