import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase para uso en el navegador (Client Components).
 * Usa cookies para que el flujo PKCE del magic link funcione con el servidor.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Instancia compartida para `import { supabase } from '@/lib/supabase'`
export const supabase = createClient()

/**
 * Cliente con permisos de admin (usa SUPABASE_SERVICE_ROLE_KEY).
 * SOLO se debe usar en código del servidor (Route Handlers, Server Actions,
 * Server Components). NUNCA importar desde un Client Component, porque
 * expondría la service role key al navegador.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
