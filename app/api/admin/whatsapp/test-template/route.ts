import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTemplate, normalizePhone, isValidPhoneE164ES } from '@/lib/whatsapp'
import { buildOutreachDescriptor } from '@/lib/fiestago-agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/whatsapp/test-template
// Envía la plantilla de captación al número que indiques, con datos
// ficticios pero realistas (categoría=foto, ciudad=Valencia). Sirve
// para verificar que la plantilla pinta bien y que los botones
// quick-reply disparan el cerebro IA correctamente.
//
// body: { phone: "+34619123456", name?: "Carla", category?: "foto", city?: "Valencia" }
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const phoneRaw: string = body.phone || ''
  const name:     string = body.name     || 'Estudio Lumen'
  const category: string = body.category || 'foto'
  const city:     string = body.city     || 'Valencia'

  const phone = normalizePhone(phoneRaw)
  if (!phone || !isValidPhoneE164ES(phone)) {
    return NextResponse.json({
      error: `Teléfono inválido: "${phoneRaw}". Formato esperado: +34 6XX XXX XXX (móvil España).`,
    }, { status: 400 })
  }

  const descriptor = buildOutreachDescriptor({ category, city })
  const template   = process.env.WHATSAPP_OUTREACH_TEMPLATE || '(no configurado)'

  try {
    const waId = await sendTemplate(phone, { bodyParams: [name, descriptor] })

    // Guardar el envío para que el webhook pueda matchear la respuesta
    // a este número entrante (aunque sea un test, queremos ver el ciclo
    // completo: pulsa botón → cerebro responde → conversación viva).
    const supabase = createAdminClient()
    await supabase.from('whatsapp_messages').insert({
      wa_message_id: waId || null,
      direction:     'outbound',
      from_number:   process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      to_number:     phone,
      type:          'template',
      body: `[TEST plantilla ${template}] ${name} · ${descriptor}`,
      status:        'sent',
      provider_id:   null,
    })

    return NextResponse.json({
      ok: true,
      template,
      sent_to: phone,
      params: { '{{1}}': name, '{{2}}': descriptor },
      wa_message_id: waId,
      hint: `Si todo está bien, recibirás un WhatsApp en ~10 segundos con los 3 botones. Pulsa cualquiera y verifica que el cerebro IA responde.`,
    })
  } catch (err: any) {
    return NextResponse.json({
      error:    err.message || 'Error enviando plantilla',
      template,
      sent_to:  phone,
      params:   { '{{1}}': name, '{{2}}': descriptor },
      hint: 'Si el error menciona "template_name_does_not_exist" o similar, revisa la env var WHATSAPP_OUTREACH_TEMPLATE en Netlify. Si menciona "param count mismatch", la plantilla tiene un número distinto de {{n}} de los que mandamos.',
    }, { status: 500 })
  }
}
