// ───────────────────────────────────────────────────────────────────────
// DuckDuckGo HTML Search · Buscador 100% gratis sin API key.
// Usamos la versión HTML clásica que DDG expone sin captcha ni JS.
// Coste: 0€. Tope práctico: ~hundreds/día sin problema.
//
// Estrategia:
//   1. Query "DJ bodas Valencia" → DDG devuelve 10-20 resultados.
//   2. Parseamos título + URL de cada resultado.
//   3. Filtramos directorios genéricos (bodas.net, Yelp, etc.) que no
//      son negocios individuales.
//   4. Visitamos cada URL y reutilizamos extractEmailFromWeb para sacar
//      email + URL de formulario + teléfono.
//
// Esta fuente sustituye a la web_search de Claude para las categorías
// donde OSM no llega: música, animación, planners.
// ───────────────────────────────────────────────────────────────────────

type DdgResult = {
  title:   string
  url:     string
  snippet: string
}

// Dominios que descartamos porque son directorios/agregadores, no
// negocios individuales. Lo que queremos es la WEB del proveedor.
const DIRECTORY_BLOCKLIST = [
  // Directorios bodas/eventos
  'bodas.net', 'bodaclick.com', 'zankyou.es', 'matrimonio.com',
  'casamientos.es', 'fiesta.es', 'top10boda.com', 'top10valencia.com',
  'tubodaperfecta.com', 'misbodas.com', 'guiabodas.es',
  // Directorios genéricos
  'yelp.com', 'yelp.es', 'tripadvisor.com', 'tripadvisor.es',
  'paginasamarillas.es', 'foursquare.com', 'maps.google',
  'g.page', 'bing.com',
  // Redes sociales y mensajería
  'facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com',
  'linkedin.com', 'twitter.com', 'x.com', 'pinterest.com',
  'wa.me', 'whatsapp.com',
  // Enciclopedias / contenido
  'wikipedia.org', 'wikidata.org', 'reddit.com', 'quora.com',
  'forocoches.com', 'enfemenino.com',
  // Marketplaces / clasificados
  'amazon.es', 'aliexpress.com', 'milanuncios.com',
  'wallapop.com', 'idealista.com', 'fotocasa.es', 'pisos.com',
  // Plataformas de freelancers (no son negocios establecidos)
  'fiverr.com', 'malt.es', 'upwork.com',
]

// Patrones en el TÍTULO que indican que el resultado es una lista o
// directorio, no la web de un proveedor individual. Si el título contiene
// alguno de estos, descartamos el resultado aunque el dominio no esté
// en la blocklist.
const DIRECTORY_TITLE_PATTERNS = [
  /\btop\s*\d/i,                          // "Top 10 fotógrafos..."
  /\blos?\s+(\d+|mejores?)\b/i,           // "Los 10 mejores..." / "Los mejores..."
  /\bmejores?\s+(\w+\s+){0,3}\b/i,        // "Mejores fotógrafos en..." (al inicio)
  /\bprecios?\s+y\s+reseñas?/i,           // "Precios y reseñas"
  /\bcomparativa\b/i,                     // "Comparativa de..."
  /\b(ranking|listado|directorio)\b/i,    // Ranking/Listado
  /\b(contratar|presupuesto)\b.+\bvalencia|madrid|barcelona|sevilla/i,
                                          // "Contratar X en Valencia" → suele ser agregador
  /\bencuentra\s+\w+\b/i,                 // "Encuentra fotógrafo..."
]

function looksLikeDirectoryTitle(title: string): boolean {
  if (!title) return false
  return DIRECTORY_TITLE_PATTERNS.some(p => p.test(title))
}

async function fetchHtml(url: string, timeoutMs: number = 8000): Promise<string | null> {
  const controller = new AbortController()
  const tick = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(tick)
  }
}

// Decode el wrapper de redirect de DDG: /l/?uddg=https%3A%2F%2F... → URL real
function decodeDdgUrl(href: string): string {
  if (!href.startsWith('/l/') && !href.includes('uddg=')) return href
  const m = href.match(/uddg=([^&]+)/)
  if (!m) return href
  try { return decodeURIComponent(m[1]) } catch { return href }
}

// True si el dominio del URL está en la blocklist (directorio).
function isDirectoryDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return DIRECTORY_BLOCKLIST.some(d => host === d || host.endsWith('.' + d))
  } catch {
    return true
  }
}

/**
 * Búsqueda en DuckDuckGo HTML. Devuelve hasta `limit` resultados que
 * NO son directorios (esos los filtramos para que solo queden webs de
 * negocios individuales).
 */
export async function ddgSearch(query: string, limit: number = 15): Promise<DdgResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=es-es`
  const html = await fetchHtml(url, 10_000)
  if (!html) return []

  // Parsear bloques de resultado. La versión HTML de DDG usa
  // <a class="result__a" href="..."> para el título y <a class="result__snippet">
  // para el snippet. La URL en el href está envuelta en /l/?uddg=...
  const results: DdgResult[] = []
  const blockRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

  let m: RegExpExecArray | null
  while ((m = blockRegex.exec(html)) !== null && results.length < limit * 3) {
    const rawHref = m[1]
    const realUrl = decodeDdgUrl(rawHref)
    const title   = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const snippet = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

    if (!realUrl.startsWith('http')) continue
    if (isDirectoryDomain(realUrl)) continue
    // Filtro por TÍTULO: "Top 10 fotógrafos…", "Los mejores…",
    // "Precios y reseñas" — son listas, no proveedores reales.
    if (looksLikeDirectoryTitle(title)) continue

    results.push({ title, url: realUrl, snippet })
    if (results.length >= limit) break
  }

  return results
}

export type { DdgResult }
