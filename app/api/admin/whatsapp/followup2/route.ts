import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTemplate, normalizePhone, isValidPhoneE164ES, InvalidPhoneError } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

// Cuando NO tenemos ningún proveedor aprobado de la categoría del receptor
// (ni misma ciudad ni cualquier otra), evitamos meter un nombre real de otra
// categoría — es "prueba social" que no lo es, chirría y baja conversión
// ("¿qué me importa que una pastelera se haya dado de alta si yo vendo
// espacios?"). Usamos una frase genérica adaptada:
//   - Si conocemos la ciudad → "otros profesionales de eventos en {ciudad}"
//   - Si no                  → "otros profesionales del sector"
function genericProof(city: string | null | undefined): string {
  const clean = (city || '').trim()
  if (clean) return `otros profesionales de eventos en ${clean}`
  return 'otros profesionales del sector'
}

// Cuerpo LITERAL de la plantilla aprobada (prueba_social_proveedores_v1),
// solo para renderizar preview del dry-run. La plantilla real vive en
// Meta y es lo que se envía — este string se mantiene sincronizado a mano.
const TEMPLATE_BODY_PREVIEW =
  'Hola {{1}} 👋 Esta semana se han dado de alta en FiestaGo nuevos proveedores en tu zona como {{2}}. Mientras tanto siguen entrando consultas a los que aparecen. Si quieres una de esas plazas: https://fiestago.es/registro-proveedor — 60 segundos, gratis, sin compromiso.'

function renderPreview(name: string, proof: string): string {
  return TEMPLATE_BODY_PREVIEW.replace('{{1}}', name).replace('{{2}}', proof)
}

// POST /api/admin/whatsapp/followup2
// body opcional: {
//   days_since_last?: number = 2,
//   limit?: number = 25,
//   dry_run?: boolean = false,
// }
//
// Tercer toque a los SILENTES: proveedores que recibieron el primer toque
// (outreach + follow-up) pero NUNCA respondieron. Envía la plantilla nueva
// WHATSAPP_FOLLOWUP2_TEMPLATE (prueba_social_proveedores_v1) con ángulo de
// prueba social.
//
// Filtros:
//   · outreach_sent = true (recibieron 1er toque)
//   · contacted_via = 'whatsapp'
//   · status = 'pending' (no aprobados)
//   · whatsapp_invalid != true
//   · NO están marcados como bot o cap (tag)
//   · NUNCA respondieron (0 inbounds en whatsapp_messages) — protegemos las
//     conversaciones vivas para no bombardear a los que sí escribieron
//   · whatsapp_followup2_count = 0 (nunca les mandamos ESTA plantilla)
//   · Último toque hace >= days_since_last días
//
// {{2}} dinámico: para cada candidato buscamos un provider real approved de
// su misma ciudad+categoría (más creíble), y si no hay, cae a fallback.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const daysSinceLast = Math.max(1, parseInt(String(body.days_since_last)) || 2)
  const limit         = Math.min(Math.max(parseInt(String(body.limit)) || 25, 1), 100)
  const dryRun        = body.dry_run === true

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - daysSinceLast * 86_400_000).toISOString()

  // 1) Candidatos por columnas de providers.
  const cols = 'id, name, category, city, phone, outreach_whatsapp, outreach_at, whatsapp_followup_sent_at'
  const { data: rows, error } = await supabase
    .from('providers')
    .select(cols)
    .eq('outreach_sent', true)
    .eq('status', 'pending')
    .eq('contacted_via', 'whatsapp')
    .or('whatsapp_invalid.is.null,whatsapp_invalid.eq.false')
    .or('whatsapp_followup2_count.is.null,whatsapp_followup2_count.eq.0')
    // Último toque suficientemente atrás. Como los proveedores con
    // followup ya tienen whatsapp_followup_sent_at, tomamos ese si existe;
    // si no, el outreach_at original. Filtramos en memoria más abajo
    // porque Supabase no permite OR con lt en dos columnas fácilmente.
    .limit(limit * 4)   // colchón por si filtramos muchos por inbound / tag / fecha

  if (error) {
    return NextResponse.json({ error: `Query candidatos falló: ${error.message}` }, { status: 500 })
  }

  const candidatosCrudos = (rows || []) as any[]

  // 2) Excluimos los que YA respondieron alguna vez (protegemos vivas).
  const ids = candidatosCrudos.map(p => p.id)
  const respondedIds = new Set<string>()
  if (ids.length) {
    const { data: inb } = await supabase
      .from('whatsapp_messages')
      .select('provider_id')
      .eq('direction', 'inbound')
      .in('provider_id', ids)
    for (const r of (inb || []) as any[]) if (r.provider_id) respondedIds.add(r.provider_id)
  }

  // 3) Excluimos también proveedores con tag de bot/cap (los marcó el webhook
  //    cuando entramos en bucle o superamos el cap horario). Y aplicamos el
  //    cutoff temporal en memoria.
  const cutoffMs = new Date(cutoff).getTime()
  const nowMs = Date.now()
  const ultimoToqueMs = (p: any) => {
    const fu = p.whatsapp_followup_sent_at ? new Date(p.whatsapp_followup_sent_at).getTime() : 0
    const oa = p.outreach_at              ? new Date(p.outreach_at).getTime()              : 0
    return Math.max(fu, oa)
  }

  // 3b) Necesitamos el tag para filtrar bots/cap, no viene en `cols`.
  //     Segunda pasada rápida solo con los IDs supervivientes.
  const noRespondieron = candidatosCrudos.filter(p => !respondedIds.has(p.id))
  const survivientesIds = noRespondieron.map(p => p.id)
  const tagPorId = new Map<string, string | null>()
  if (survivientesIds.length) {
    const { data: tagRows } = await supabase
      .from('providers')
      .select('id, tag')
      .in('id', survivientesIds)
    for (const r of (tagRows || []) as any[]) tagPorId.set(r.id, r.tag)
  }

  const eligibles = noRespondieron
    .filter(p => {
      const t = (tagPorId.get(p.id) || '').toLowerCase()
      if (t.includes('autoresponder')) return false
      if (t.includes('cap respuestas')) return false
      return true
    })
    .filter(p => ultimoToqueMs(p) > 0 && nowMs - ultimoToqueMs(p) >= (nowMs - cutoffMs))
    .filter(p => p.phone || p.outreach_whatsapp)
    .slice(0, limit)

  // 4) Dry-run: sólo devolvemos la lista con el {{2}} que se usaría y el
  //    body renderizado (para que el admin vea el mensaje EXACTO antes
  //    de comprometer envíos).
  if (dryRun) {
    const preview = await Promise.all(
      eligibles.slice(0, 10).map(async p => {
        const proof = await pickProofName(supabase, p)
        return {
          id: p.id, name: p.name, category: p.category, city: p.city,
          phone: p.phone || p.outreach_whatsapp,
          prueba_social: proof,
          mensaje_renderizado: renderPreview(p.name || 'hola', proof),
        }
      }),
    )
    return NextResponse.json({
      candidatos_crudos: candidatosCrudos.length,
      respondieron_alguna_vez: respondedIds.size,
      eligibles: eligibles.length,
      dryRun: true,
      preview,
    })
  }

  // 5) Envío real. Requiere env var.
  const template = process.env.WHATSAPP_FOLLOWUP2_TEMPLATE
  if (!template) {
    return NextResponse.json({
      error: 'Falta WHATSAPP_FOLLOWUP2_TEMPLATE en env vars',
    }, { status: 500 })
  }

  const logs: string[] = []
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const p of eligibles) {
    const rawPhone = p.phone || p.outreach_whatsapp || ''
    const to = normalizePhone(rawPhone) || ''
    if (!isValidPhoneE164ES(to)) {
      skipped++
      logs.push(`⊘ ${p.name} — teléfono no válido (${rawPhone})`)
      await supabase.from('providers').update({
        whatsapp_invalid: true,
        whatsapp_invalid_reason: `Número no E.164 en followup2: "${rawPhone}"`,
      }).eq('id', p.id)
      continue
    }

    const proof = await pickProofName(supabase, p)

    try {
      const waId = await sendTemplate(to, {
        template,
        bodyParams: [p.name || 'hola', proof],
      })

      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction:     'outbound',
        from_number:   process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number:     to,
        type:          'template',
        body:          `[plantilla followup2 (${template}) a ${p.name} · proof=${proof}]`,
        status:        'sent',
        provider_id:   p.id,
      })

      await supabase.from('providers').update({
        whatsapp_followup2_sent_at: new Date().toISOString(),
        whatsapp_followup2_count:   1,
      }).eq('id', p.id)

      sent++
      logs.push(`✅ ${p.name} (${p.city}) — followup2 enviado · proof=${proof}`)
    } catch (err: any) {
      failed++
      if (err instanceof InvalidPhoneError) {
        await supabase.from('providers').update({
          whatsapp_invalid: true,
          whatsapp_invalid_reason: err.message.slice(0, 500),
        }).eq('id', p.id)
        logs.push(`✗ ${p.name} — teléfono marcado inválido: ${err.message}`)
      } else {
        logs.push(`✗ ${p.name} — fallo envío: ${err?.message || 'desconocido'}`)
      }
    }
  }

  return NextResponse.json({
    candidatos_crudos: candidatosCrudos.length,
    respondieron_alguna_vez: respondedIds.size,
    eligibles: eligibles.length,
    sent,
    failed,
    skipped,
    template,
    logs,
  })
}

// Elige el nombre a poner en {{2}} para un candidato. Prioridad:
//   1. Otro provider approved de su MISMA ciudad + categoría (mismo gremio local).
//   2. Otro approved de su misma CATEGORÍA (mismo gremio nacional).
//   3. Frase genérica del sector (evitamos meter un nombre de otra categoría
//      que chirría — un fotógrafo no se motiva porque una pastelera esté dentro).
//
// Cuando hay VARIOS matches en la BD, elegimos uno al azar de los últimos 10
// para diversificar los mensajes de un lote y no saturar un solo nombre.
// Excluimos siempre al propio candidato para no autorreferenciarlo.
async function pickProofName(supabase: any, p: { id: string; city: string | null; category: string | null }): Promise<string> {
  const pickRandom = async (filters: (q: any) => any): Promise<string | null> => {
    let q = supabase
      .from('providers')
      .select('name')
      .eq('status', 'approved')
      .neq('id', p.id)
      .order('created_at', { ascending: false })
      .limit(10)
    q = filters(q)
    const { data } = await q
    const rows = (data as any[] | null) || []
    if (!rows.length) return null
    const pick = rows[Math.floor(Math.random() * rows.length)]
    return pick?.name?.trim() || null
  }

  // 1) Mismo gremio en su ciudad — máxima credibilidad.
  if (p.city && p.category) {
    const hit = await pickRandom(q => q.eq('city', p.city).eq('category', p.category))
    if (hit) return hit
  }
  // 2) Mismo gremio en cualquier ciudad — sigue siendo prueba social válida.
  if (p.category) {
    const hit = await pickRandom(q => q.eq('category', p.category))
    if (hit) return hit
  }
  // 3) Sin match de categoría → frase genérica adaptada.
  return genericProof(p.city)
}
