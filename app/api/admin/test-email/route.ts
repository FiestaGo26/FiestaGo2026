import { NextRequest, NextResponse } from 'next/server'
import { emailAdminNewProvider } from '@/lib/resend'

// Endpoint de diagnóstico para verificar que el envío de email funciona en
// producción. Devuelve la respuesta cruda de Resend para que veas el error
// real (dominio no verificado, API key vencida, rate limit, etc.).
//
// USO:
//   curl -X POST https://fiestago.es/api/admin/test-email \
//     -H "x-admin-token: <ADMIN_TOKEN>" \
//     -H "content-type: application/json" \
//     -d '{"to":"mgt09@hotmail.es"}'
//
// Protegido por header `x-admin-token` que debe coincidir con la env var
// ADMIN_TOKEN. Si la env var no está configurada, el endpoint responde 503
// con instrucciones (NO se queda abierto al público).

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    return NextResponse.json({
      ok: false,
      error: 'ADMIN_TOKEN no configurada en Netlify. Añádela en Site settings → Environment variables y redeploy.',
    }, { status: 503 })
  }
  const provided = req.headers.get('x-admin-token')
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'token inválido' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as any))
  const to = body.to || process.env.ADMIN_EMAIL || 'contacto@fiestago.es'

  // Diagnóstico de env vars (sin exponer la API key)
  const envCheck = {
    RESEND_API_KEY:     process.env.RESEND_API_KEY     ? `OK (${process.env.RESEND_API_KEY.slice(0,6)}…)` : 'FALTA',
    ADMIN_EMAIL:        process.env.ADMIN_EMAIL        || '(no configurada, usará contacto@fiestago.es)',
    OUTREACH_FROM:      process.env.OUTREACH_FROM      || '(no configurada, usará contacto@fiestago.es)',
    OUTREACH_FROM_NAME: process.env.OUTREACH_FROM_NAME || '(no configurada, usará "FiestaGo")',
    OUTREACH_REPLY_TO:  process.env.OUTREACH_REPLY_TO  || '(opcional, no configurada)',
  }

  // Mandamos un email de prueba simulando un alta de proveedor.
  const fake = {
    name:        '🧪 TEST – Proveedor Diagnóstico',
    category:    'foto',
    city:        'Valencia',
    email:       to,
    phone:       '+34 600 000 000',
    website:     'https://ejemplo.com',
    instagram:   '@ejemplo',
    description: 'Esto es un email de prueba lanzado desde /api/admin/test-email para diagnosticar por qué no llegan los avisos de registro.',
  }

  // Forzamos que la notificación de admin se mande al destinatario indicado en
  // el body (para que el usuario pueda comprobar a SU email sin tocar env vars).
  const originalAdminEmail = process.env.ADMIN_EMAIL
  process.env.ADMIN_EMAIL = to
  let result
  try {
    result = await emailAdminNewProvider(fake)
  } finally {
    if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL
    else process.env.ADMIN_EMAIL = originalAdminEmail
  }

  return NextResponse.json({
    ok:       result.ok,
    sentTo:   to,
    resend:   result,
    envCheck,
    hint: result.ok
      ? 'Email enviado correctamente. Revisa la bandeja del destinatario (también spam).'
      : 'Email NO enviado. Mira el campo "resend.error" para la causa exacta.',
  }, { status: result.ok ? 200 : 500 })
}
