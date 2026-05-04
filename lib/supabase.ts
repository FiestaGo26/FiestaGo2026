import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente de Supabase para uso en el navegador (Client Components).
 * Usa cookies del navegador para que el flujo PKCE funcione con el servidor.
 *
 * Ubicación: lib/supabase.ts
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Export por defecto compatible con el código existente que hace
// `import { supabase } from '@/lib/supabase'`
export const supabase = createClient()
