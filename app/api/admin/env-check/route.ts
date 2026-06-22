import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/env-check — chequeo de presencia de env vars críticas.
// NUNCA devuelve el valor, solo si está SET y la longitud (para detectar
// strings vacíos vs presentes). Útil cuando hay que diagnosticar "está
// la variable bien puesta en Netlify?" sin necesidad de entrar al panel.
//
// Grupos:
//   - core   → básicas que tiene que tener cualquier deploy
//   - heygen → cron diario de vídeo con avatar
//   - whatsapp → outreach + cerebro
//   - email  → notificaciones via Resend
//   - google → sincronización de calendarios
//   - ai     → herramientas IA del panel (presupuestos, plantillas, gmb)

function check(name: string) {
  const v = process.env[name]
  const set = v != null && v !== ''
  return { set, length: set ? v!.length : 0 }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const groups = {
    core: {
      ADMIN_PASSWORD:                    check('ADMIN_PASSWORD'),
      ADMIN_EMAIL:                       check('ADMIN_EMAIL'),
      NEXT_PUBLIC_SUPABASE_URL:          check('NEXT_PUBLIC_SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY:         check('SUPABASE_SERVICE_ROLE_KEY'),
      CRON_SECRET:                       check('CRON_SECRET'),
    },
    heygen: {
      HEYGEN_API_KEY:                    check('HEYGEN_API_KEY'),
      HEYGEN_AVATAR_ID:                  check('HEYGEN_AVATAR_ID'),
      HEYGEN_VOICE_ID:                   check('HEYGEN_VOICE_ID'),
      HEYGEN_BACKGROUND:                 check('HEYGEN_BACKGROUND'),
      HEYGEN_VOICE_SPEED:                check('HEYGEN_VOICE_SPEED'),
      HEYGEN_VOICE_EMOTION:              check('HEYGEN_VOICE_EMOTION'),
      ADMIN_WHATSAPP_NUMBER:             check('ADMIN_WHATSAPP_NUMBER'),
    },
    whatsapp: {
      WHATSAPP_TOKEN:                    check('WHATSAPP_TOKEN'),
      WHATSAPP_PHONE_NUMBER_ID:          check('WHATSAPP_PHONE_NUMBER_ID'),
      WHATSAPP_APP_SECRET:               check('WHATSAPP_APP_SECRET'),
      WHATSAPP_VERIFY_TOKEN:             check('WHATSAPP_VERIFY_TOKEN'),
      WHATSAPP_OUTREACH_TEMPLATE:        check('WHATSAPP_OUTREACH_TEMPLATE'),
      WHATSAPP_TEMPLATE_LANG:            check('WHATSAPP_TEMPLATE_LANG'),
      WHATSAPP_TEMPLATE_HAS_PARAMS:      check('WHATSAPP_TEMPLATE_HAS_PARAMS'),
    },
    ai: {
      ANTHROPIC_API_KEY:                 check('ANTHROPIC_API_KEY'),
      ANTHROPIC_MODEL:                   check('ANTHROPIC_MODEL'),
    },
    email: {
      RESEND_API_KEY:                    check('RESEND_API_KEY'),
    },
    google: {
      GOOGLE_CLIENT_ID:                  check('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET:              check('GOOGLE_CLIENT_SECRET'),
    },
  }

  return NextResponse.json({
    ok: true,
    runtime_env: process.env.NODE_ENV || 'unknown',
    netlify_context: process.env.CONTEXT || 'unknown',
    deploy_id: process.env.DEPLOY_ID || null,
    groups,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
