import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generateConversationReply, type ConversationMessage } from '@/lib/conversation-ai'
import { sendEmail } from '@/lib/resend'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// POST /api/webhooks/email-inbound
//
// Recibe emails entrantes desde Cloudflare Email Routing Worker
// (o cualquier servicio que pueda hacer POST con JSON parseado).
//
// Body esperado:
//   {
//     from:    "provider@email.com",
//     to:      "contacto@fiestago.es",      // o cualquier alias nuestro
//     subject: "Re: Tu negocio en FiestaGo",
//     text:    "cuerpo del email en texto plano",
//     headers: { ... }                       // opcional
//   }
//
// Auth: cabecera 'x-inbound-secret' contra INBOUND_EMAIL_SECRET (env).
//       Configura el Worker para incluirla.
//
// Flujo:
//   1. Identifica proveedor por email = from.
//   2. Detecta si es "no me interesa" (palabras stop) → status=lost,
//      manda email de baja y salimos.
//   3. Carga (o crea) conversación email activa con ese proveedor.
//   4. Añade el mensaje entrante al historial (role='them').
//   5. Llama a Claude para generar respuesta.
//   6. Envía respuesta vía Resend al proveedor.
//   7. Añade la respuesta al historial (role='us', generated_by_ai=true).
//   8. Devuelve 200 OK.
export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET
  if (secret && req.headers.get('x-inbound-secret') !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const from    = String(body.from    || '').toLowerCase().trim()
  const subject = String(body.subject || '').trim()
  const text    = String(body.text    || '').trim()

  if (!from || !text) {
    return NextResponse.json({ error: 'from + text requeridos' }, { status: 400 })
  }

  // Extraer email del header From: "Nombre <email@x.com>" → email@x.com
  const fromEmail = (from.match(/[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [from])[0].toLowerCase()

  const supabase = createAdminClient()

  // 1. Buscar proveedor
  const { data: prov } = await supabase
    .from('providers')
    .select('id, name, city, category, email, website')
    .ilike('email', fromEmail)
    .maybeSingle()

  if (!prov) {
    // No es un proveedor conocido. Lo registramos para inspección manual
    // pero no contestamos automáticamente (podría ser spam).
    console.log(`[email-inbound] sender desconocido: ${fromEmail}`)
    return NextResponse.json({ ok: true, ignored: 'sender desconocido' })
  }

  // 2. Detección de baja: stop words.
  const lower = text.toLowerCase()
  const isOptOut = /\b(no me interesa|baja|stop|unsubscribe|borrar|no insistas|deja de escribirme|no quiero recibir|no me escrib)/i.test(lower)

  // 3. Cargar (o crear) conversación email
  let { data: conv } = await supabase
    .from('provider_conversations')
    .select('id, messages, status')
    .eq('provider_id', prov.id)
    .eq('channel', 'email')
    .in('status', ['active', 'paused'])
    .maybeSingle()

  const incomingMsg = {
    role:    'them' as const,
    content: text.slice(0, 8000),
    at:      new Date().toISOString(),
  }

  if (!conv) {
    const { data: created } = await supabase
      .from('provider_conversations')
      .insert({
        provider_id: prov.id,
        channel:     'email',
        messages:    [incomingMsg],
        status:      isOptOut ? 'lost' : 'active',
        last_message_at: incomingMsg.at,
      })
      .select('id, messages')
      .single()
    conv = created ? { ...created, status: isOptOut ? 'lost' : 'active' } : null
  } else {
    const newMessages = [...((conv.messages || []) as any[]), incomingMsg]
    await supabase
      .from('provider_conversations')
      .update({
        messages: newMessages,
        last_message_at: incomingMsg.at,
        updated_at: incomingMsg.at,
        status: isOptOut ? 'lost' : 'active',
      })
      .eq('id', conv.id)
    conv = { ...conv, messages: newMessages, status: isOptOut ? 'lost' : 'active' }
  }
  if (!conv) return NextResponse.json({ error: 'No se pudo crear conversación' }, { status: 500 })

  // 4. Si es opt-out: enviamos email cortés de baja y salimos sin Claude.
  if (isOptOut) {
    const optOutBody = `Hola ${prov.name},

Recibido. Te quitamos de la lista, no te escribiremos más.

Si en el futuro cambias de idea, en https://fiestago.es/profesionales puedes registrarte cuando quieras.

Un abrazo,
Mariano · FiestaGo`
    await sendEmail({
      to:      fromEmail,
      subject: 'Recibido — te quitamos de la lista',
      text:    optOutBody,
    })
    // Guardar la respuesta de opt-out en historial
    const optOutMsg = { role: 'us', content: optOutBody, at: new Date().toISOString(), generated_by_ai: false }
    await supabase
      .from('provider_conversations')
      .update({
        messages: [...((conv.messages || []) as any[]), optOutMsg],
        last_message_at: optOutMsg.at,
        updated_at: optOutMsg.at,
        status: 'lost',
      })
      .eq('id', conv.id)
    return NextResponse.json({ ok: true, action: 'opt-out' })
  }

  // 5. Generar respuesta con Claude basándose en historial completo.
  const history = (conv.messages as ConversationMessage[]).slice(0, -1)  // excluyo el incoming que acabo de añadir
  const result = await generateConversationReply(
    {
      name:     prov.name,
      city:     prov.city,
      category: prov.category,
      email:    prov.email,
      website:  prov.website,
    },
    'email',
    history,
    text,
  )

  if (!result.ok) {
    console.error(`[email-inbound] Claude error: ${result.error}`)
    // Conversación queda registrada con el mensaje entrante. El admin
    // puede entrar a /admin-tools/conversaciones y responder manualmente.
    return NextResponse.json({ ok: true, action: 'claude_failed', error: result.error })
  }

  // 6. Enviar la respuesta vía Resend
  const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject || 'Tu negocio en FiestaGo'}`
  const sent = await sendEmail({
    to:      fromEmail,
    subject: replySubject,
    text:    result.text,
  })

  if (!sent.ok) {
    console.error(`[email-inbound] Resend error: ${sent.error}`)
    return NextResponse.json({ ok: true, action: 'reply_failed', error: sent.error })
  }

  // 7. Guardar respuesta IA en historial
  const replyMsg = {
    role:            'us',
    content:         result.text,
    at:              new Date().toISOString(),
    generated_by_ai: true,
  }
  await supabase
    .from('provider_conversations')
    .update({
      messages:        [...((conv.messages || []) as any[]), replyMsg],
      last_message_at: replyMsg.at,
      updated_at:      replyMsg.at,
    })
    .eq('id', conv.id)

  return NextResponse.json({
    ok: true,
    action: 'replied',
    provider: prov.name,
    resend_id: sent.id,
  })
}
