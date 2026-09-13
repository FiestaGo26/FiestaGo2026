/**
 * Extracción de la IP real del cliente detrás de Netlify.
 *
 * `request.ip` no sirve: en Netlify llega la IP del edge, no la del
 * cliente, y en local llega `::1`. Una evidencia de consentimiento con
 * la IP del CDN no prueba nada ante el emisor de la tarjeta.
 *
 * Orden de lectura (primera cabecera válida gana):
 *   1. x-nf-client-connection-ip  — la pone Netlify, es la fiable
 *   2. x-forwarded-for            — PRIMER valor de la lista, no el último
 *   3. x-real-ip
 *
 * En x-forwarded-for el primer valor es el cliente original y los
 * siguientes son los proxies que atravesó. Coger el último es el error
 * clásico que acaba guardando la IP del propio Netlify.
 */

export type HeaderSource = Headers | { get(name: string): string | null }

const IP_HEADERS = ['x-nf-client-connection-ip', 'x-forwarded-for', 'x-real-ip'] as const

export function getClientIp(headers: HeaderSource): string | null {
  for (const name of IP_HEADERS) {
    const raw = headers.get(name)
    if (!raw) continue
    // x-forwarded-for puede venir como "cliente, proxy1, proxy2"
    const first = String(raw).split(',')[0]?.trim()
    const ip = normalizeIp(first)
    if (ip) return ip
  }
  return null
}

/** User agent completo, SIN truncar: el fingerprint del navegador es parte de la prueba. */
export function getUserAgent(headers: HeaderSource): string | null {
  const ua = headers.get('user-agent')
  return ua && ua.trim() ? ua.trim() : null
}

/**
 * Normaliza y descarta lo que no sea una IP utilizable. Devuelve null en
 * lugar de inventarse un valor: preferimos una evidencia que dice "no se
 * capturó IP" a una que miente. Además la columna es de tipo `inet`, así
 * que un valor inválido reventaría el INSERT del consentimiento y con él
 * el cobro.
 */
export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null
  let ip = value.trim()
  if (!ip) return null

  // IPv4 mapeada en IPv6 (::ffff:1.2.3.4) → nos quedamos con la IPv4
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (mapped) ip = mapped[1]

  // Puerto pegado a una IPv4 (1.2.3.4:56789)
  const withPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)
  if (withPort) ip = withPort[1]

  // IPv6 entre corchetes, con o sin puerto ([::1]:443)
  const bracketed = ip.match(/^\[([0-9a-f:.]+)\](?::\d+)?$/i)
  if (bracketed) ip = bracketed[1]

  if (isIpv4(ip) || isIpv6(ip)) return ip
  return null
}

function isIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

function isIpv6(ip: string): boolean {
  if (!/^[0-9a-f:]+$/i.test(ip)) return false
  if (/^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i.test(ip)) return true   // forma completa
  return ip.includes('::') && (ip.match(/::/g) || []).length === 1   // forma comprimida
}

/**
 * true si la IP es local o privada. Sirve para avisar en el panel de que
 * la captura no está funcionando: el criterio de aceptación dice que una
 * reserva de prueba no puede quedar registrada con ::1 ni con la IP del
 * edge.
 */
export function isLocalIp(ip: string | null): boolean {
  if (!ip) return true
  return ip === '::1' || ip === '127.0.0.1' ||
    ip.startsWith('10.') || ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
}
