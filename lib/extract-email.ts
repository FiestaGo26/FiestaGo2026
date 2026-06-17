// Extracción de email desde una web pública del proveedor.
// Estrategia:
// 1. Fetch del homepage con timeout corto.
// 2. Regex sobre el HTML para encontrar emails comunes.
// 3. Si no hay, busca un link a "contacto", "contact", "about" y lo prueba.
// 4. Filtra emails genéricos de plataformas (no@example.com, postmaster@, etc.)
//
// Devuelve el email más prometedor o null.

// Negative lookbehind para no glue el local-part a caracteres alfanuméricos
// previos. Sin esto, HTML del tipo `font-size:20"info@dominio.com` produce
// "20info@dominio.com". Con esto, solo capturamos cuando antes del local-part
// hay inicio de string, espacio, ':', '>', '<', '"', '/', etc.
const EMAIL_REGEX = /(?<![a-zA-Z0-9._+-])[a-zA-Z][a-zA-Z0-9._+-]{0,40}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,30}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,10}){1,3}/g

// Emails que no nos sirven (junk corporativo, sentinels, placeholders).
const BLOCKLIST = [
  // Sentinels de webmasters/proveedores
  /noreply@/i, /no-reply@/i, /donotreply@/i, /postmaster@/i,
  /webmaster@/i, /support@wix/i, /admin@wp\./i, /sentry/i,
  /\.png$/i, /\.jpg$/i, /\.gif$/i, /\.webp$/i,
  /@sentry\.io/i, /@cloudflare/i, /@gstatic/i, /@google/i,
  /@wordpress\.com/i, /@wix\./i, /@squarespace\./i,
  // Dominios de ejemplo / sandbox
  /@example\./i, /@test\./i, /@localhost/i, /@dominio\./i,
  /@midominio\./i, /@tudominio\./i, /@yourdomain\./i,
  /@email\.com$/i, /@correo\.com$/i, /@mail\.com$/i,
  // Locales que son claramente placeholders en español/inglés
  /^(tu|su|mi|info|nombre|usuario|user|name|tuemail|tucorreo|nuestrocorreo)@/i,
  /^email@/i, /^correo@/i, /^contacto@(?:ejemplo|example|placeholder|test|dominio)/i,
  /@(ejemplo|placeholder)\./i,
  // Lorem ipsum y similares
  /lorem@/i, /ipsum@/i, /^foo@/i, /^bar@/i, /^baz@/i,
]

async function fetchPage(url: string, timeoutMs: number = 4000): Promise<string | null> {
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

// Detecta enlaces de WhatsApp en el HTML de la web del proveedor.
// Acepta: wa.me/34<digits>, api.whatsapp.com/send?phone=…,
// whatsapp://send?phone=… y construye la URL canónica wa.me con
// prefijo 34 (España) si el número es nacional. Devuelve null si no
// detecta ninguno válido.
export function findWhatsAppUrl(html: string): string | null {
  const patterns = [
    /(?:https?:)?\/\/(?:api\.)?wa\.me\/(?:send\?phone=)?\+?(\d{8,15})/i,
    /(?:https?:)?\/\/api\.whatsapp\.com\/send\?phone=\+?(\d{8,15})/i,
    /whatsapp:\/\/send\?phone=\+?(\d{8,15})/i,
  ]
  for (const pat of patterns) {
    const m = html.match(pat)
    if (m && m[1]) {
      let digits = m[1].replace(/^0+/, '')
      // Si tiene 9 dígitos exactos, asumimos España y añadimos 34.
      if (digits.length === 9) digits = '34' + digits
      // Si empieza por 6/7/8/9 y tiene >9 dígitos pero parece móvil ES sin prefijo
      if (digits.length >= 10 && digits.length <= 15) {
        return `https://wa.me/${digits}`
      }
    }
  }
  return null
}

// Detecta si una página HTML tiene un formulario de contacto real
// (<form> con campos de texto y un botón de envío, o un iframe de form
// builder como Typeform, Tally, Jotform…). Usado para verificar que la
// URL detectada como "contacto" realmente sirve para escribir.
function hasContactForm(html: string): boolean {
  // 1. <form> con al menos un textarea o input de texto/email
  const hasForm = /<form[\s\S]{0,2000}?<(textarea|input[^>]*type=["'](text|email|tel)["'])/i.test(html)
  if (hasForm) return true
  // 2. Iframes de plataformas conocidas de formularios
  if (/typeform\.com|tally\.so|jotform\.com|google\.com\/forms|wufoo\.com|formspree\.io/i.test(html)) return true
  // 3. WhatsApp embed (los proveedores españoles a menudo ponen wa.me
  //    como su "formulario de contacto" en la web)
  if (/wa\.me\/\d|api\.whatsapp\.com\/send/i.test(html)) return true
  return false
}

// Detecta URL de página de contacto en HTML con preferencia por
// /contacto sobre /sobre-mi. Si la home en sí ya tiene un <form>,
// devuelve la URL del home. Si encuentra link "Contacto" devuelve la
// URL absoluta. Devuelve null si no detecta nada usable.
function findContactFormUrl(homeHtml: string, baseUrl: string): string | null {
  // Si la home YA tiene formulario, esa misma URL sirve.
  if (hasContactForm(homeHtml)) return baseUrl
  // Si no, busca link a contacto y prefiere los que apunten a /contact*,
  // /presupuesto, /escribenos sobre /sobre-nosotros.
  const links = findContactLinks(homeHtml, baseUrl)
  const scored = links.map(l => {
    const lower = l.toLowerCase()
    let score = 0
    if (/contact(o|ar|enos)?/.test(lower)) score += 10
    if (/presupuesto|escribenos|escríbenos|reservar/.test(lower)) score += 8
    if (/sobre|about|nosotros/.test(lower)) score += 1
    return { url: l, score }
  }).sort((a, b) => b.score - a.score)
  return scored[0]?.url || null
}

/**
 * Intenta extraer email + URL del formulario de contacto + WhatsApp de una web.
 * Devuelve { email, source, contactFormUrl, whatsappUrl } o null si no hay
 * nada útil. Cualquiera de los campos puede ser null individualmente.
 *   - email/source: 'home' | 'contact-page' | 'mailto'
 *   - contactFormUrl: URL absoluta del form (o de la subpágina /contacto)
 *   - whatsappUrl: URL wa.me canónica si la web embebe un enlace WhatsApp
 */
export async function extractEmailFromWeb(
  url: string,
): Promise<{
  email:          string | null
  source:         string | null
  contactFormUrl: string | null
  whatsappUrl:    string | null
} | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null

  // 1. Probar homepage
  const home = await fetchPage(url)
  if (!home) return null

  let foundEmail: string | null = null
  let emailSource: string | null = null

  // 1a. Buscar mailto: explícito (prioridad alta)
  const mailtos = home.match(/mailto:([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || []
  if (mailtos[0]) {
    const candidate = mailtos[0].replace('mailto:', '').toLowerCase()
    if (!BLOCKLIST.some(b => b.test(candidate))) {
      foundEmail = candidate
      emailSource = 'mailto'
    }
  }

  // 1b. Buscar emails en el HTML
  if (!foundEmail) {
    const inHome = findEmailsInHtml(home)
    if (inHome.length > 0) {
      foundEmail = inHome[0].toLowerCase()
      emailSource = 'home'
    }
  }

  // 2. URL del formulario de contacto + WhatsApp directo embebido.
  let contactFormUrl = findContactFormUrl(home, url)
  let whatsappUrl    = findWhatsAppUrl(home)

  // 3. Si falta algo, seguir hasta 2 links de contacto buscando email +
  //    verificando si la subpágina tiene formulario + WhatsApp.
  if (!foundEmail || !contactFormUrl || !whatsappUrl) {
    const contactLinks = findContactLinks(home, url)
    for (const link of contactLinks.slice(0, 2)) {
      const sub = await fetchPage(link, 3500)
      if (!sub) continue
      if (!foundEmail) {
        const subMailtos = sub.match(/mailto:([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || []
        if (subMailtos[0]) {
          const candidate = subMailtos[0].replace('mailto:', '').toLowerCase()
          if (!BLOCKLIST.some(b => b.test(candidate))) {
            foundEmail = candidate
            emailSource = 'contact-page'
          }
        }
        if (!foundEmail) {
          const found = findEmailsInHtml(sub)
          if (found.length > 0) {
            foundEmail = found[0].toLowerCase()
            emailSource = 'contact-page'
          }
        }
      }
      // Si esta subpágina tiene form, la promovemos como contactFormUrl
      if (!contactFormUrl && hasContactForm(sub)) {
        contactFormUrl = link
      }
      // Buscar WhatsApp también en subpágina si no se encontró en home
      if (!whatsappUrl) {
        const wa = findWhatsAppUrl(sub)
        if (wa) whatsappUrl = wa
      }
    }
  }

  if (!foundEmail && !contactFormUrl && !whatsappUrl) return null
  return { email: foundEmail, source: emailSource, contactFormUrl, whatsappUrl }
}
