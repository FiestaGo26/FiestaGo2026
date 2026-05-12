import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// Plantilla del email outreach (alineada con agent/route.ts)
function buildEmailDraft(p: any): string {
  const sourceLabel = p.source === 'instagram' ? ' en Instagram'
                    : p.source === 'tiktok'    ? ' en TikTok'
                    : ''
  return `ASUNTO: Tu negocio en FiestaGo · ${p.city}

Hola ${p.name},

Somos FiestaGo, un nuevo marketplace de celebraciones en España (bodas, cumpleaños, eventos privados y familiares). Lanzamos oficialmente el 10 de junio de 2026 y estamos seleccionando los primeros profesionales en ${p.city} para tener un catálogo de calidad desde el día uno.

Vimos tu trabajo${sourceLabel} y encajas con lo que buscan nuestros clientes.

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

Si tienes dudas, simplemente responde a este email.

Un saludo,
El equipo de FiestaGo`
}

// Plantilla del DM Instagram (alineada con agent/route.ts)
function buildDmDraft(p: any): string {
  const firstName = (p.name || '').split(/[\s|·\-_]/)[0] || ''
  return `¡Hola ${firstName}! 👋✨

Te escribo del equipo de FiestaGo, el nuevo marketplace de celebraciones en España (bodas, cumpleaños, eventos privados).

🚀 LANZAMOS EL 10 DE JUNIO DE 2026
Estamos seleccionando los primeros profesionales en ${p.city} para arrancar con catálogo de calidad desde el día uno. Tu trabajo nos ha encajado mucho 🙌

Lo que ganas si entras AHORA, antes del lanzamiento:

✅ Mejor posición en los resultados
🎁 Primera reserva sin comisión (0%)
💸 Solo 8% desde la segunda venta
📅 Sin permanencia ni cuotas mensuales
📣 Te promocionamos en nuestras redes (@fiestagospain)

🏆 BONUS · SELLO FIESTAGO DE CALIDAD (GRATIS)
Te lo regalamos al entrar y lo mantienes mientras tengas 4,5/5 en reseñas. Es un distintivo visible junto a tu perfil que aumenta confianza y reservas.

🤝 BONUS · TRAE A UN COMPAÑERO
Si invitas a otro profesional y se registra, los dos apareceréis en los primeros puestos de vuestra categoría sin coste.

¿Te interesa? Regístrate en menos de 5 minutos:
👉 https://fiestago.es/registro-proveedor

Cualquier duda, respóndeme por aquí o escribe a contacto@fiestago.es 💌`
}

// POST /api/admin/providers/regenerate-drafts
// Regenera outreach_email y outreach_dm para todos los pending + outreach_sent=false
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const supabase = createAdminClient()

  // Cargar candidates
  const { data: candidates, error } = await supabase
    .from('providers')
    .select('id, name, city, email, instagram, source')
    .eq('status', 'pending')
    .eq('outreach_sent', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!candidates || !candidates.length) {
    return NextResponse.json({ updated: 0, emailDraftsRegenerated: 0, dmDraftsRegenerated: 0, total: 0 })
  }

  let updatedRows = 0
  let emailCount = 0
  let dmCount = 0

  // Actualizar en lotes de 50 para no saturar
  for (const p of candidates as any[]) {
    const updates: any = {}
    if (p.email) {
      updates.outreach_email = buildEmailDraft(p)
      emailCount++
    }
    if (p.instagram) {
      updates.outreach_dm = buildDmDraft(p)
      dmCount++
    }
    if (Object.keys(updates).length === 0) continue
    const { error: upErr } = await supabase.from('providers').update(updates).eq('id', p.id)
    if (!upErr) updatedRows++
  }

  return NextResponse.json({
    total: candidates.length,
    updated: updatedRows,
    emailDraftsRegenerated: emailCount,
    dmDraftsRegenerated: dmCount,
  })
}
