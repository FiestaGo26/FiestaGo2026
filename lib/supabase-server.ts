import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente de Supabase para uso en el servidor (Server Components,
 * Route Handlers, Server Actions). Lee y escribe cookies via next/headers.
 *
 * Ubicación: lib/supabase-server.ts
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Los Server Components no pueden escribir cookies.
            // El middleware se encarga de refrescar las sesiones.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Igual que arriba.
          }
        },
      },
    }
  )
}
