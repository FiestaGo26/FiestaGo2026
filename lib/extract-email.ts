// Extracción de email desde una web pública del proveedor.
// Estrategia:
// 1. Fetch del homepage con timeout corto.
// 2. Regex sobre el HTML para encontrar emails comunes.
// 3. Si no hay, busca un link a "contacto", "contact", "about" y lo prueba.
// 4. Filtra emails genéricos de plataformas (no@example.com, postmaster@, etc.)
//
// Devuelve el email más prometedor o null.

const EMAIL_REGEX = /[a-zA-Z0-9][a-zA-Z0-9._+-]{0,40}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,30}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,10}){1,3}/g

// Emails que no nos sirven (junk corporativo, sentinels de webmasters, etc.)
const BLOCKLIST = [
  /noreply@/i, /no-reply@/i, /donotreply@/i, /postmaster@/i,
  /webmaster@/i, /support@wix/i, /admin@wp\./i, /sentry/i,
  /\.png$/i, /\.jpg$/i, /\.gif$/i, /\.webp$/i,
  /@sentry\.io/i, /@cloudflare/i, /@gstatic/i, /@google/i,
  /@example\./i, /@test\./i, /@localhost/i,
]

async function fetchPage(url: string, timeoutMs: number = 6000): Promise<string | null> {
  const controller = new AbortController()
  const tick = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FiestaGoBot/1.0; +https://fiestago.es)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('text/plain')) return null
    const text = await res.text()
    return text.slice(0, 500_000)  // cap a 500KB
  } catch {
    return null
  } finally {
    clearTimeout(tick)
  }
}

function findEmailsInHtml(html: string): string[] {
  // Decode HTML entities y mailto: links
  const decoded = html
    .replace(/&#64;/g, '@').replace(/&#46;/g, '.')
    .replace(/&commat;/g, '@').replace(/&period;/g, '.')
    .replace(/\s\[at\]\s/gi, '@').replace(/\s\(at\)\s/gi, '@')
    .replace(/\s\[dot\]\s/gi, '.').replace(/\s\(dot\)\s/gi, '.')

  const matches = decoded.match(EMAIL_REGEX) || []
  return matches.filter(e => !BLOCKLIST.some(b => b.test(e)))
}

function findContactLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi
  const candidates: string[] = []
  let m: RegExpExecArray | null
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1]
    const label = m[2].toLowerCase()
    if (/contact|contacto|sobre|about/i.test(label) || /contact|contacto|about/i.test(href)) {
      try {
        const abs = new URL(href, baseUrl).toString()
        if (abs.startsWith('http')) candidates.push(abs)
      } catch {}
    }
  }
  return Array.from(new Set(candidates)).slice(0, 3)
}

/**
 * Intenta extraer email de una web. Devuelve { email, source } o null.
 * source: 'home' | 'contact-page' | 'mailto'
 */
export async function extractEmailFromWeb(url: string): Promise<{ email: string; source: string } | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null

  // 1. Probar homepage
  const home = await fetchPage(url)
  if (!home) return null

  // 1a. Buscar mailto: explícito (prioridad alta)
  const mailtos = home.match(/mailto:([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || []
  if (mailtos[0]) {
    const candidate = mailtos[0].replace('mailto:', '').toLowerCase()
    if (!BLOCKLIST.some(b => b.test(candidate))) return { email: candidate, source: 'mailto' }
  }

  // 1b. Buscar emails en el HTML
  const inHome = findEmailsInHtml(home)
  if (inHome.length > 0) return { email: inHome[0].toLowerCase(), source: 'home' }

  // 2. Si no hay, seguir hasta 2 links de contacto
  const contactLinks = findContactLinks(home, url)
  for (const link of contactLinks.slice(0, 2)) {
    const sub = await fetchPage(link, 5000)
    if (!sub) continue
    const subMailtos = sub.match(/mailto:([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || []
    if (subMailtos[0]) {
      const candidate = subMailtos[0].replace('mailto:', '').toLowerCase()
      if (!BLOCKLIST.some(b => b.test(candidate))) return { email: candidate, source: 'contact-page' }
    }
    const found = findEmailsInHtml(sub)
    if (found.length > 0) return { email: found[0].toLowerCase(), source: 'contact-page' }
  }

  return null
}
