import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase para uso en el navegador (Client Components).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const supabase = createClient()

/**
 * Cliente con permisos de admin (service role). Solo en servidor.
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

// ============================================================
// Types — ajusta los campos cuando quieras a tu schema real.
// El index signature `[key: string]: any` evita errores de TS
// si accedes a propiedades extra.
// ============================================================

export type Provider = {
  id: string
  email: string
  name?: string
  business_name?: string | null
  category?: string | null
  phone?: string | null
  description?: string | null
  city?: string | null
  region?: string | null
  price_from?: number | null
  price_to?: number | null
  status?: 'pending' | 'approved' | 'rejected' | string
  photo_url?: string | null
  website?: string | null
  rating?: number | null
  reviews_count?: number | null
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export type Notification = {
  id: string
  type?: string
  title?: string | null
  message?: string | null
  read?: boolean
  user_id?: string | null
  provider_id?: string | null
  created_at?: string
  [key: string]: any
}

export type Booking = {
  id: string
  provider_id: string
  customer_email: string
  customer_name?: string | null
  customer_phone?: string | null
  event_date?: string | null
  event_type?: string | null
  message?: string | null
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | string
  created_at?: string
  [key: string]: any
}
