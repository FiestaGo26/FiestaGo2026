import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES, CITIES } from '@/lib/constants'

const SITE = 'https://fiestago.es'

function citySlug(city: string): string {
  return city.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient()
  const staticPaths: MetadataRoute.Sitemap = [
    { url: SITE,                              changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE}/servicios`,               changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/proveedores`,             changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/garantia`,                changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/profesionales`,           changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/calculadora`,             changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${SITE}/quiz`,                    changeFrequency: 'weekly',  priority: 0.8  },
    { url: `${SITE}/eventos-reales`,          changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${SITE}/cumpleanos`,              changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${SITE}/comuniones`,              changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${SITE}/corporativo`,             changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${SITE}/alternativas-bodas-net`,  changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/buscar`,                  changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${SITE}/registro-proveedor`,      changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/registro`,                changeFrequency: 'monthly', priority: 0.5 },
  ]

  try {
    // Fichas de proveedores aprobados
    const { data: providers } = await supabase
      .from('providers')
      .select('id, slug, updated_at, category, city')
      .eq('status', 'approved')
      .limit(5000)

    const providerUrls: MetadataRoute.Sitemap = (providers || []).map((p: any) => ({
      url: `${SITE}/proveedores/${p.slug || p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    // Páginas programáticas /marketplace/[categoria]-en-[ciudad]:
    // solo emitimos las combinaciones donde hay ≥1 proveedor aprobado,
    // para no inflar el sitemap con páginas vacías que perjudican SEO.
    const combos = new Set<string>()
    for (const p of (providers || [])) {
      const ciudadKey = (p.city || '').split(' ')[0]  // "Madrid centro" → "Madrid"
      const cityMatch = CITIES.find((c: string) => c.toLowerCase().startsWith(ciudadKey.toLowerCase()))
      if (!cityMatch) continue
      if (!CATEGORIES.find(c => c.id === p.category)) continue
      combos.add(`${p.category}-en-${citySlug(cityMatch)}`)
    }
    const marketplaceUrls: MetadataRoute.Sitemap = Array.from(combos).map(slug => ({
      url: `${SITE}/marketplace/${slug}`,
      changeFrequency: 'weekly',
      priority: 0.75,
    }))

    // Galerías de eventos publicadas
    const { data: galleries } = await supabase
      .from('event_galleries')
      .select('slug, updated_at')
      .eq('status', 'published')
      .limit(2000)

    const galleryUrls: MetadataRoute.Sitemap = (galleries || []).map((g: any) => ({
      url: `${SITE}/eventos-reales/${g.slug}`,
      lastModified: g.updated_at ? new Date(g.updated_at) : undefined,
      changeFrequency: 'monthly',
      priority: 0.7,
    }))

    return [...staticPaths, ...providerUrls, ...marketplaceUrls, ...galleryUrls]
  } catch {
    return staticPaths
  }
}
