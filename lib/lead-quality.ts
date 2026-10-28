// ───────────────────────────────────────────────────────────────────────
// Filtro de calidad para leads de captación. La búsqueda gratuita (OSM +
// DuckDuckGo) a veces guarda como "proveedor" el título de una página
// cualquiera: webs de torrents, cursos, artículos, directorios o negocios
// de otra provincia. Escribir por WhatsApp a esos números baja la calidad
// del número ante Meta (errores 131049) y no trae ningún alta.
//
// Es una heurística conservadora: solo descarta lo que claramente no es
// un proveedor de eventos de la zona de Valencia.
// ───────────────────────────────────────────────────────────────────────

const GENERIC_TITLES = new Set([
  'inicio', 'home', 'contacto', 'contact', 'nosotros', 'bodas', 'eventos',
  'animación', 'animacion', 'servicios', 'blog', 'tienda', 'galería', 'galeria',
])

const JUNK_PATTERNS: RegExp[] = [
  // "Torrent" a secas es una ciudad de la zona; las webs de descargas no.
  /\btorrents\b|torrentclaw|pediatorrent/i,
  /\btorrent\b.*\b(descarga|descargar|pel[ií]culas|series|buscador)\b/i,
  /\b(arquitectura|interiorismo)\b/i,
  /\b(descargar|descarga gratis)\b/i,
  /\b(curso|cursos|academia|formaci[oó]n|master|m[aá]ster)\b/i,
  /\b(an[aá]lisis|metodol[oó]gic|observatorio|estudio sectorial)\b/i,
  /\b(empleo|trabajo|jobs|ofertas? de trabajo|freelancer|jooble)\b/i,
  /\b(mejores|ranking|top \d+|\d+ empresas)\b/i,
  /\b(c[oó]mo|qu[eé] es|gu[ií]a para)\b/i,
  /[¿?]/,
  /\.\.\.|…/,                       // títulos cortados de un buscador
  // Búsqueda de locales (28-10-2026): "fincas" trae administradores de fincas,
  // inmobiliarias, arquitectos, coworkings y directorios, que no son locales
  /administra(dor|dora|dores|ci[oó]n)( de)? (fincas|comunidades)|\bcomunidades\b|gesti[oó]n de (fincas|inmuebles)/i,
  /inmobiliari|\bventa\b|comprar|fincas? (r[uú]sticas?|edificables?)|solares/i,
  /\barquitect|geot[eé]cnic|desbroce|urbanismo|ayuntamiento|\bayto\b|registro de empresas/i,
  /coworking|working\b|salas? de reuniones|meetbooker|airbnb|vrbo|habitaclia|cylex|bodasenlinea|taskia|artistealo|fiestafincas|perfectvenue|tubodahola|presupuestos? gratis|\d+ casas rurales/i,
]

// Sitios claramente fuera de la zona de trabajo. Si además menciona
// Valencia, se da por bueno (p. ej. "Valencia, Alicante y Castellón").
// (Asturias es zona de trabajo desde el 28-10-2026.)
const OUT_OF_AREA = /\b(madrid|barcelona|badajoz|sevilla|m[aá]laga|bilbao|galicia|zaragoza|costa del sol|castell[oó]n|cantabria|washington|london|miami|mexico|m[eé]xico)\b/i

export function junkLeadReason(name: string | null | undefined): string | null {
  const n = (name || '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim()
  if (n.length < 3) return 'sin nombre'
  if (GENERIC_TITLES.has(n.toLowerCase())) return 'título genérico de web'
  for (const rx of JUNK_PATTERNS) if (rx.test(n)) return 'no parece un proveedor'
  if (OUT_OF_AREA.test(n) && !/valencia|asturias|oviedo|gij[oó]n/i.test(n)) return 'fuera de la zona'
  return null
}
