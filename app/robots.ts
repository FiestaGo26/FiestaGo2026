import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/proveedor/panel', '/mi-cuenta', '/api/'] },
    ],
    sitemap: 'https://fiestago.es/sitemap.xml',
    host: 'https://fiestago.es',
  }
}
