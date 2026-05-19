import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase'

const SITE = 'https://fiestago.es'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient()
  const staticPaths: MetadataRoute.Sitemap = [
    { url: SITE,                        changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE}/servicios`,         changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/proveedores`,       changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE}/garantia`,          changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/profesionales`,     changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/buscar`,            changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${SITE}/registro-proveedor`,changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/registro`,          changeFrequency: 'monthly', priority: 0.5 },
  ]

  try {
    const { data: providers } = await supabase
      .from('providers')
      .select('id, slug, updated_at')
      .eq('status', 'approved')
      .limit(5000)

    const providerUrls: MetadataRoute.Sitemap = (providers || []).map((p: any) => ({
      url: `${SITE}/proveedores/${p.slug || p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    return [...staticPaths, ...providerUrls]
  } catch {
    return staticPaths
  }
}
