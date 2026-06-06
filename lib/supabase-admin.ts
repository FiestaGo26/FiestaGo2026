// Reexport del cliente admin de Supabase usando el nombre que esperan los
// archivos portados desde FiestaGo26/FiestaGo (que usaban supabaseAdmin()).
// Internamente delega en createAdminClient() de lib/supabase.ts para no
// duplicar instancias.

import { createAdminClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin
  _admin = createAdminClient() as SupabaseClient
  return _admin
}
