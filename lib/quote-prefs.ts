// Devuelve las prefs del proveedor, creando la fila por defecto si no existe.
// Idempotente. Vive en lib/ porque Next.js no deja exportar helpers desde
// archivos route.ts del App Router.
export async function loadOrInitPrefs(supabase: any, providerId: string) {
  const { data } = await supabase
    .from('provider_quote_prefs')
    .select('*')
    .eq('provider_id', providerId)
    .maybeSingle()
  if (data) return data
  const { data: inserted } = await supabase
    .from('provider_quote_prefs')
    .insert({ provider_id: providerId })
    .select('*')
    .single()
  return inserted
}
