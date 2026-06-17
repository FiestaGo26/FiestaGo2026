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
  // Marketplaces de servicios fotográficos / agregadores
  'fotio.es', 'sortlist.com', 'bidsmart.com',
  // Periódicos / revistas locales — atraen "Los X mejores" en SEO
  'lasprovincias.es', 'levante-emv.com', 'valenciaplaza.com',
  'elpais.com', 'elmundo.es', 'abc.es', '20minutos.es',
  'lavanguardia.com', 'elperiodico.com',
]

// Patrones en el TÍTULO que indican que el resultado es una lista o
// directorio, no la web de un proveedor individual. Solo bloqueamos
// listicles INEQUÍVOCOS — un fotógrafo legítimo puede tener "mejores
// fotógrafos de Valencia" en su meta SEO sin ser un directorio.
const DIRECTORY_TITLE_PATTERNS = [
  /^\s*top\s*\d/i,                          // "Top 10..."
  /\blos?\s+\d+\s+mejores?\b/i,             // "Los 10 mejores..."
  /\blas?\s+\d+\s+mejores?\b/i,             // "Las 10 mejores..."
  /^\s*los?\s+mejores?\s+\w+/i,             // "Los mejores..."
  /\bprecios?\s+y\s+rese[nñ]as?\b/i,        // "Precios y reseñas"
  /\bcomparativa\s+de\b/i,
  /\b(ranking|listado|directorio)\s+de\b/i,
  /\bencuentra\s+(el\s+mejor|tu|los?)\b/i,
  // Contenido turístico/editorial — artículos de revista, no proveedores.
  // Estos eran los falsos positivos del ultimo lote ("Los 6 lugares más
  // fotogénicos…", "Las mejores localizaciones para sesiones de fotos…").
  /\blugares?\s+(m[aá]s\s+)?fotog[eé]nicos?\b/i,
  /\bsitios?\s+instagrameables\b/i,
  /\blocalizaciones?\s+para\s+(sesiones?|fotos?|hacer)\b/i,
  /\bpara\s+tu\s+instagram\b/i,
  /\bvist[ao]s?\s+por\s+\d+\s+fot[oó]graf/i,
  /\bzonas?\s+perfectas?\s+para\b/i,
  /\bsitios?\s+para\s+tener\s+un\s+recuerdo\b/i,
  /\bpor\s+qu[eé]\s+(elegir|contratar)\b/i,  // "¿Por qué elegir un fotógrafo?"
  /\bgu[ií]a\s+(de|para|completa)\b/i,        // "Guía de fotografía..."
  /\bsesiones?\s+de\s+fotos?\s+urbanas\b/i,
]

function looksLikeDirectoryTitle(title: string): boolean {
  if (!title) return false
  return DIRECTORY_TITLE_PATTERNS.some(p => p.test(title))
}

// URLs típicas de artículo/blog/noticia, no de página de proveedor.
// Tras descartar dominios agregadores, los resultados que sobreviven y
// son magazines/blogs tienen rutas como /blog/, /noticia/, /guia/,
// /2024/03/articulo-x. La página de un fotógrafo individual rara vez
// vive en esas rutas.
function isLikelyArticleUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    if (/\/(blog|noticias?|art[íi]culo|reportaje|magazine|revista|news|post|gu[íi]a)(\/|$)/.test(path)) return true
    if (/\/20\d{2}\/\d{1,2}\//.test(path)) return true       // /2024/03/...
    if (/-\d{4}-\d{2}-\d{2}(\/|$)/.test(path)) return true   // slugs con fecha
    return false
  } catch {
    return false
  }
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
 *
 * Devuelve también un objeto con stats de diagnóstico para que el
 * llamante pueda loguear qué se descartó y por qué (útil cuando DDG
 * "devuelve 0" — saber si es por captcha, dominios bloqueados o títulos).
 */
export async function ddgSearch(query: string, limit: number = 15): Promise<DdgResult[]> {
  const r = await ddgSearchVerbose(query, limit)
  return r.results
}

export type DdgStats = {
  results:        DdgResult[]
  rawCount:       number
  domainFiltered: number
  titleFiltered:  number
  fetchedHtml:    boolean
}

export async function ddgSearchVerbose(query: string, limit: number = 15): Promise<DdgStats> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=es-es`
  const html = await fetchHtml(url, 10_000)
  if (!html) return { results: [], rawCount: 0, domainFiltered: 0, titleFiltered: 0, fetchedHtml: false }

  const results: DdgResult[] = []
  let rawCount = 0
  let domainFiltered = 0
  let titleFiltered = 0
  const blockRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

  let m: RegExpExecArray | null
  while ((m = blockRegex.exec(html)) !== null && results.length < limit * 3) {
    const rawHref = m[1]
    const realUrl = decodeDdgUrl(rawHref)
    const title   = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const snippet = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

    if (!realUrl.startsWith('http')) continue
    rawCount++
    if (isDirectoryDomain(realUrl)) { domainFiltered++; continue }
    if (looksLikeDirectoryTitle(title)) { titleFiltered++; continue }
    // Bloquear artículos/blogs/noticias por URL — son contenido
    // editorial sobre el sector, no webs de proveedores.
    if (isLikelyArticleUrl(realUrl)) { titleFiltered++; continue }

    results.push({ title, url: realUrl, snippet })
    if (results.length >= limit) break
  }

  return { results, rawCount, domainFiltered, titleFiltered, fetchedHtml: true }
}

export type { DdgResult }
