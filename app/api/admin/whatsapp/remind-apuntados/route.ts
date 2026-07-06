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

// Cuerpo LITERAL de la plantilla aprobada (recordatorio_apuntados_v1), solo
// para renderizar el preview del dry-run. La plantilla real vive en Meta.
const TEMPLATE_BODY_PREVIEW =
  'Hola {{1}} 👋 Hace unos días dijiste que te apuntabas a FiestaGo pero aún no he visto tu alta — imagino que se traspapeló entre tantos mensajes. Es literalmente 60 segundos y ya empiezas a recibir consultas: https://fiestago.es/registro-proveedor'

function renderPreview(name: string): string {
  return TEMPLATE_BODY_PREVIEW.replace('{{1}}', name)
}

// POST /api/admin/whatsapp/remind-apuntados
// body opcional: { limit?: number = 25, dry_run?: boolean = false }
//
// Recordatorio final para proveedores que mostraron INTERÉS EXPLÍCITO y NO
// cerraron el alta. Dos poblaciones:
//
//   A) 'Me apunto' pendientes: pulsaron el botón, el cerebro les mandó el
//      script pero no se registraron. Ideal para insistir sin quemar.
//
//   B) Víctimas del cooldown-bug (fixed en 14046fa): pulsaron 'Cuéntame más'
//      y el cerebro no llegó a responder por el bug del cooldown 60s. Estos
//      no recibieron el bloque IA que les habría explicado el pack. Merecen
//      una segunda oportunidad porque su interés no fue atendido por un fallo
//      nuestro, no por desinterés real.
//
// Filtros comunes:
//   · status <> 'approved' (no se registraron aún)
//   · self_registered != true
//   · whatsapp_invalid != true
//   · whatsapp_reminder_apuntados_count = 0 (cap 1: máx 1 recordatorio)
//   · fuera de ventana de 24h desde el último mensaje (dentro se puede
//     mandar texto libre, no usamos plantilla)
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const limit  = Math.min(Math.max(parseInt(String(body.limit)) || 25, 1), 100)
  const dryRun = body.dry_run === true

  const supabase = createAdminClient()

  // 1) Recogemos los provider_id que cumplen los criterios de "candidato humano
  //    interesado sin atender". Casos A y B combinados. Lo hacemos en varios
  //    pasos porque supabase-js no soporta OR/AND anidados con subqueries.

  // Paso 1A: providers que pulsaron 'Me apunto'
  const { data: meApuntoRows, error: e1 } = await supabase
    .from('whatsapp_messages')
    .select('provider_id')
    .eq('direction', 'inbound')
    .eq('body', 'Me apunto')
  if (e1) return NextResponse.json({ error: `Query Me apunto falló: ${e1.message}` }, { status: 500 })

  // Paso 1B: providers que pulsaron 'Cuéntame más' y NO recibieron respuesta
  // del cerebro en 5 min (víctimas del cooldown-bug).
  const { data: cuentaMasRows, error: e2 } = await supabase
    .from('whatsapp_messages')
    .select('provider_id, created_at')
    .eq('direction', 'inbound')
    .eq('body', 'Cuéntame más')
  if (e2) return NextResponse.json({ error: `Query Cuéntame más falló: ${e2.message}` }, { status: 500 })

  // Para cada 'Cuéntame más', comprobar si hubo outbound text del cerebro
  // en los 5 min posteriores. Si no lo hubo → víctima.
  const cuentaMasVictimas = new Set<string>()
  if (cuentaMasRows?.length) {
    const ids = Array.from(new Set((cuentaMasRows as any[]).map(r => r.provider_id).filter(Boolean)))
    const { data: bots } = await supabase
      .from('whatsapp_messages')
      .select('provider_id, created_at')
      .eq('direction', 'outbound')
      .eq('type', 'text')
      .in('provider_id', ids)
    const outboundsByProvider = new Map<string, number[]>()
    for (const b of (bots || []) as any[]) {
      const arr = outboundsByProvider.get(b.provider_id) || []
      arr.push(new Date(b.created_at).getTime())
      outboundsByProvider.set(b.provider_id, arr)
    }
    for (const r of cuentaMasRows as any[]) {
      const clickMs = new Date(r.created_at).getTime()
      const outs = outboundsByProvider.get(r.provider_id) || []
      const respondido = outs.some(ts => ts >= clickMs && ts <= clickMs + 5 * 60_000)
      if (!respondido) cuentaMasVictimas.add(r.provider_id)
    }
  }

  const interesadosIds = new Set<string>()
  for (const r of (meApuntoRows || []) as any[]) {
    if (r.provider_id) interesadosIds.add(r.provider_id)
  }
  cuentaMasVictimas.forEach(id => interesadosIds.add(id))

  if (interesadosIds.size === 0) {
    return NextResponse.json({ eligibles: 0, dryRun, preview: [], candidatos_brutos: 0 })
  }

  // 2) Cargamos los providers y filtramos por status/cap/invalid/ventana
  const { data: provRows, error: e3 } = await supabase
    .from('providers')
    .select('id, name, category, city, phone, outreach_whatsapp, status, self_registered, whatsapp_invalid, whatsapp_reminder_apuntados_count')
    .in('id', Array.from(interesadosIds.values()))
  if (e3) return NextResponse.json({ error: `Query providers falló: ${e3.message}` }, { status: 500 })

  const candidatosBrutos = (provRows || []).filter((p: any) =>
    p.status !== 'approved' &&
    !p.self_registered &&
    !p.whatsapp_invalid &&
    (!p.whatsapp_reminder_apuntados_count || p.whatsapp_reminder_apuntados_count === 0) &&
    (p.phone || p.outreach_whatsapp)
  )

  // 3) Ventana de 24h: solo mandamos plantilla si el último mensaje del
  //    proveedor tiene >= 24h. Los que están dentro los atiende el admin
  //    manualmente por texto libre (más personal, mejor conversión).
  const { data: lastMsgs } = await supabase
    .from('whatsapp_messages')
    .select('provider_id, created_at')
    .eq('direction', 'inbound')
    .in('provider_id', candidatosBrutos.map((p: any) => p.id))
  const ultimoInboundMs = new Map<string, number>()
  for (const r of (lastMsgs || []) as any[]) {
    const ts = new Date(r.created_at).getTime()
    const prev = ultimoInboundMs.get(r.provider_id) || 0
    if (ts > prev) ultimoInboundMs.set(r.provider_id, ts)
  }
  const nowMs = Date.now()
  const eligibles = candidatosBrutos
    .filter((p: any) => {
      const last = ultimoInboundMs.get(p.id) || 0
      return last === 0 || nowMs - last >= 24 * 60 * 60_000
    })
    .slice(0, limit)

  // 4) Dry-run
  if (dryRun) {
    const preview = eligibles.slice(0, 10).map((p: any) => ({
      id: p.id, name: p.name, category: p.category, city: p.city,
      phone: p.phone || p.outreach_whatsapp,
      mensaje_renderizado: renderPreview(p.name || 'hola'),
    }))
    return NextResponse.json({
      candidatos_brutos: candidatosBrutos.length,
      eligibles: eligibles.length,
      dryRun: true,
      preview,
    })
  }

  // 5) Envío real
  const template = process.env.WHATSAPP_REMINDER_APUNTADOS_TEMPLATE
  if (!template) {
    return NextResponse.json({
      error: 'Falta WHATSAPP_REMINDER_APUNTADOS_TEMPLATE en env vars',
    }, { status: 500 })
  }

  const logs: string[] = []
  let sent = 0, failed = 0, skipped = 0

  for (const p of eligibles as any[]) {
    const rawPhone = p.phone || p.outreach_whatsapp || ''
    const to = normalizePhone(rawPhone) || ''
    if (!isValidPhoneE164ES(to)) {
      skipped++
      logs.push(`⊘ ${p.name} — teléfono no válido (${rawPhone})`)
      await supabase.from('providers').update({
        whatsapp_invalid: true,
        whatsapp_invalid_reason: `Número no E.164 en reminder_apuntados: "${rawPhone}"`,
      }).eq('id', p.id)
      continue
    }

    try {
      const waId = await sendTemplate(to, {
        template,
        bodyParams: [p.name || 'hola'],
      })
      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction: 'outbound',
        from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number: to,
        type: 'template',
        body: `[plantilla reminder_apuntados (${template}) a ${p.name}]`,
        status: 'sent',
        provider_id: p.id,
      })
      await supabase.from('providers').update({
        whatsapp_reminder_apuntados_sent_at: new Date().toISOString(),
        whatsapp_reminder_apuntados_count: 1,
      }).eq('id', p.id)
      sent++
      logs.push(`✅ ${p.name} (${p.city})`)
    } catch (err: any) {
      failed++
      if (err instanceof InvalidPhoneError) {
        await supabase.from('providers').update({
          whatsapp_invalid: true,
          whatsapp_invalid_reason: err.message.slice(0, 500),
        }).eq('id', p.id)
        logs.push(`✗ ${p.name} — teléfono inválido`)
      } else {
        logs.push(`✗ ${p.name} — ${err?.message || 'error'}`)
      }
    }
  }

  return NextResponse.json({
    candidatos_brutos: candidatosBrutos.length,
    eligibles: eligibles.length,
    sent, failed, skipped,
    template,
    logs,
  })
}
