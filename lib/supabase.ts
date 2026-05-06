import { createBrowserClient } from '@supabase/ssr'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Provider = {
  id: string
  created_at: string
  name: string
  slug: string
  category: string
  city: string
  email: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  tiktok: string | null
  description: string | null
  short_desc: string | null
  price_base: number | null
  price_unit: string
  tag: string | null
  rating: number
  total_reviews: number
  total_bookings: number
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  featured: boolean
  verified: boolean
  photo_url: string | null
  photo_idx: number
  source: string
  agent_score: string | null
  outreach_sent: boolean
  outreach_email: string | null
  outreach_dm: string | null
  social_handle: string | null
  social_platform: string | null
  social_url: string | null
  followers: number
  specialties: string[]
  agent_fit_score: number | null
  conversion_prob: number | null
  agent_notes: string | null
  contactable: boolean
}

export type Pack = {
  id: string
  name: string
  slug: string
  emoji: string
  description: string
  highlight: string
  price_base: number
  duration: string
  max_guests: number
  includes: string[]
  status: string
  photo_seed: string
  color: string
  sort_order: number
  total_bookings: number
}

export type Booking = {
  id: string
  created_at: string
  booking_type: 'provider' | 'pack'
  provider_id: string | null
  pack_id: string | null
  client_name: string
  client_email: string
  client_phone: string | null
  event_date: string
  event_type: string
  city: string | null
  guests: number | null
  message: string | null
  total_amount: number
  commission_rate: number
  commission_amt: number
  provider_earns: number | null
  is_free_txn: boolean
  status: string
  paid_at: string | null
  review_rating: number | null
  review_text: string | null
}

export type Notification = {
  id: string
  created_at: string
  read: boolean
  type: string
  title: string
  message: string | null
  data: Record<string, any>
  action_url: string | null
}

// ─── Browser client (Client Components) ──────────────────────────────────────

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Instancia compartida para `import { supabase } from '@/lib/supabase'`
export const supabase = createClient()

// ─── Admin client (solo en servidor) ─────────────────────────────────────────

export function createAdminClient() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Alias retrocompatible
export function createServerSupabaseClient() {
  return createAdminClient()
}
