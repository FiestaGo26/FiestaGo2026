import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase'

// SEO dinámico: extraemos el proveedor por id o slug y construimos
// title / description / OpenGraph para que Google y compartir en redes
// muestre la ficha real (no el genérico de FiestaGo).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const supabase = createAdminClient()
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)
    const col = isUUID ? 'id' : 'slug'
    const { data: p } = await supabase
      .from('providers')
      .select('id, slug, name, category, city, description, short_desc, photo_url, rating, total_reviews')
      .eq(col, params.id)
      .eq('status', 'approved')
      .maybeSingle()

    if (!p) return { title: 'Proveedor no encontrado · FiestaGo' }

    const title = `${p.name} · ${p.category} en ${p.city} · FiestaGo`
    const desc  = (p.short_desc || p.description || `${p.name} — proveedor de ${p.category} en ${p.city}.`)
      .slice(0, 160)
    const url   = `https://fiestago.es/proveedores/${p.slug || p.id}`
    const stars = p.rating > 0 ? `★ ${Number(p.rating).toFixed(1)} (${p.total_reviews || 0} reseñas) · ` : ''

    return {
      title,
      description: `${stars}${desc}`,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        url,
        title,
        description: desc,
        siteName: 'FiestaGo',
        locale: 'es_ES',
        images: p.photo_url ? [{ url: p.photo_url, width: 1200, height: 630, alt: p.name }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: desc,
        images: p.photo_url ? [p.photo_url] : [],
      },
    }
  } catch {
    return { title: 'FiestaGo · Marketplace de celebraciones' }
  }
}

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return children
}
