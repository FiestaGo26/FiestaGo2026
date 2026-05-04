import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Callback del magic link de Supabase (flujo PKCE).
 *
 * Ubicación: app/auth/callback/route.ts
 *
 * IMPORTANTE: borra el archivo viejo `app/(public)/auth/callback/page.tsx`.
 * Este Route Handler debe vivir FUERA del grupo (public) para que no
 * herede el layout con UI.
 *
 * Flujo:
 *  1. Supabase redirige aquí con `?code=<auth_code>`.
 *  2. Leemos el `code_verifier` desde la cookie HttpOnly que el cliente
 *     del navegador setteó al llamar a signInWithOtp.
 *  3. Intercambiamos el code por una sesión y guardamos los tokens en
 *     cookies HttpOnly.
 *  4. Redirigimos al panel del proveedor.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/proveedor/panel'

  if (!code) {
    return NextResponse.redirect(
      `${origin}/proveedor/login?error=${encodeURIComponent('no_code')}`
    )
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(
      `${origin}/proveedor/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${origin}${next}`)
}
