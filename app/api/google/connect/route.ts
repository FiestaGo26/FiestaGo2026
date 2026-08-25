import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-calendar'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/google/connect?provider_id=...
// Manda al proveedor a autorizar su Google Calendar.
//
// SEGURIDAD: validamos que la sesión Supabase del llamante corresponde
// al email del proveedor (o que es admin impersonando vía
// x-admin-password). Aunque el provider_id viene como query param, no
// es manipulable porque requireProviderAuth lo verifica contra la
// sesión autenticada.
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  // Chequeo previo: sin credenciales OAuth de Google, no hay nada que
  // hacer. Devolvemos una página HTML explicativa en vez de reventar
  // silenciosamente (que en Netlify se traduce en ERR_INVALID_RESPONSE).
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Google Calendar · pendiente de configurar</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:40px auto;padding:0 20px;color:#1F2937;line-height:1.6}
h1{font-size:22px}code{background:#F3F4F6;padding:2px 6px;border-radius:4px;font-size:13px}
.box{background:#FEF3C7;border:1px solid #FCD34D;padding:16px;border-radius:10px;margin:20px 0}
a.back{display:inline-block;margin-top:20px;padding:10px 20px;background:#1F2937;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}</style>
</head><body>
<h1>⚙️ Google Calendar · pendiente de configurar</h1>
<p>La integración con Google Calendar todavía no está lista en este sitio.
El administrador tiene que crear un proyecto OAuth en Google Cloud y añadir
en Netlify las variables <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code>.</p>
<div class="box">
  <b>Mientras tanto</b>, puedes seguir gestionando tu disponibilidad manualmente
  desde el panel — funciona perfectamente sin sincronización externa.
</div>
<a class="back" href="/proveedor/panel?tab=disponibilidad">← Volver al panel</a>
</body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  try {
    return NextResponse.redirect(getAuthUrl(auth.data.id))
  } catch (err: any) {
    return NextResponse.json({
      error: 'No se pudo iniciar el flujo de Google OAuth',
      detail: err?.message || 'error desconocido',
    }, { status: 500 })
  }
}
