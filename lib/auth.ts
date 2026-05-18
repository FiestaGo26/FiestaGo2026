import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase'

/**
 * Devuelve el usuario auth de Supabase asociado a la request (vía cookies),
 * o null si no hay sesión.
 */
export async function getAuthUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * El llamante tiene la contraseña del admin (header x-admin-password).
 * Usado como bypass de autorización para impersonación desde /admin.
 */
export function isAdminRequest(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

type AuthResult<T> =
  | { ok: true;  data: T }
  | { ok: false; response: NextResponse }

/**
 * Verifica que el llamante puede actuar como proveedor con id `providerId`.
 * Acepta dos vías de autorización:
 *  1. El llamante tiene sesión Supabase activa y su email coincide con el
 *     email del proveedor en la tabla `providers`.
 *  2. El llamante envía el header `x-admin-password` correcto (admin
 *     impersonando al proveedor desde /admin).
 *
 * Devuelve la fila del proveedor (solo campos básicos) o un NextResponse
 * de error listo para devolverse.
 */
export async function requireProviderAuth(
  req: NextRequest,
  providerId: string | null | undefined
): Promise<AuthResult<{ id: string; email: string; name: string }>> {
  if (!providerId) {
    return { ok: false, response: NextResponse.json({ error: 'provider_id requerido' }, { status: 400 }) }
  }

  const admin = createAdminClient()
  const { data: provider } = await admin
    .from('providers').select('id, email, name')
    .eq('id', providerId).maybeSingle()

  if (!provider) {
    return { ok: false, response: NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 }) }
  }

  // Bypass admin
  if (isAdminRequest(req)) return { ok: true, data: provider }

  const user = await getAuthUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  if ((user.email || '').toLowerCase() !== (provider.email || '').toLowerCase()) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true, data: provider }
}

/**
 * Verifica que el llamante puede actuar como cliente con `clientEmail`.
 * El email auth del usuario debe coincidir con el email del cliente.
 * Admin también puede impersonar.
 */
export async function requireClientAuth(
  req: NextRequest,
  clientEmail: string | null | undefined
): Promise<AuthResult<{ email: string }>> {
  if (!clientEmail) {
    return { ok: false, response: NextResponse.json({ error: 'email requerido' }, { status: 400 }) }
  }

  if (isAdminRequest(req)) return { ok: true, data: { email: clientEmail } }

  const user = await getAuthUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  if ((user.email || '').toLowerCase() !== clientEmail.toLowerCase()) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true, data: { email: user.email! } }
}
