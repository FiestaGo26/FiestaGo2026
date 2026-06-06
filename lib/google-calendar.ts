import crypto from 'crypto'
import { google } from 'googleapis'

// ─── Google Calendar — cliente de bajo nivel ─────────────────────────────────
//
// Sincronización en dos sentidos (ocupado/libre) del calendario del proveedor.
//
// Variables de entorno:
//   GOOGLE_CLIENT_ID            — OAuth client id (Google Cloud Console)
//   GOOGLE_CLIENT_SECRET        — OAuth client secret
//   GOOGLE_OAUTH_REDIRECT_URI   — opcional; por defecto {APP_URL}/api/google/callback
//   GOOGLE_STATE_SECRET         — opcional; secreto para firmar el "state" (o CRON_SECRET)
//   NEXT_PUBLIC_APP_URL         — base de la app (https://fiestago.es)

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.freebusy', // leer ocupado/libre
  'https://www.googleapis.com/auth/calendar.events', // crear/borrar eventos
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
]

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://fiestago.es'
}

function redirectUri(): string {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${appUrl()}/api/google/callback`
}

export function oauthClient() {
  const id = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!id || !secret) throw new Error('Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
  return new google.auth.OAuth2(id, secret, redirectUri())
}

// ─── "state" firmado para el flujo OAuth (evita CSRF / manipulación) ─────────
function stateSecret(): string {
  return process.env.GOOGLE_STATE_SECRET || process.env.CRON_SECRET || 'fiestago-dev-secret'
}

export function signState(providerId: string): string {
  const payload = `${providerId}.${Date.now()}`
  const sig = crypto.createHmac('sha256', stateSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const [providerId, ts, sig] = decoded.split('.')
    if (!providerId || !ts || !sig) return null
    const expected = crypto
      .createHmac('sha256', stateSecret())
      .update(`${providerId}.${ts}`)
      .digest('hex')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    // Caduca en 1 hora
    if (Date.now() - Number(ts) > 60 * 60 * 1000) return null
    return providerId
  } catch {
    return null
  }
}

// URL a la que mandamos al proveedor para que autorice.
export function getAuthUrl(providerId: string): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline', // para obtener refresh_token
    prompt: 'consent', // fuerza refresh_token incluso si ya autorizó antes
    scope: SCOPES,
    state: signState(providerId),
    include_granted_scopes: true,
  })
}

// Intercambia el "code" del callback por tokens.
export async function exchangeCode(code: string) {
  const client = oauthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  // Email del usuario (para mostrarlo en el panel)
  let email: string | null = null
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const me = await oauth2.userinfo.get()
    email = me.data.email ?? null
  } catch {
    /* no crítico */
  }
  return { tokens, email }
}

// Tipo mínimo de la fila de conexión que necesitamos.
export type GCalConnection = {
  provider_id: string
  calendar_id: string | null
  access_token: string | null
  refresh_token: string | null
  token_expiry: string | null
}

// Devuelve un cliente OAuth con un access token válido (refrescando si hace falta).
// El segundo valor son los tokens nuevos si se refrescó (para persistirlos).
export async function authedClient(conn: GCalConnection) {
  const client = oauthClient()
  client.setCredentials({
    access_token: conn.access_token ?? undefined,
    refresh_token: conn.refresh_token ?? undefined,
    expiry_date: conn.token_expiry ? new Date(conn.token_expiry).getTime() : undefined,
  })

  let refreshed: { access_token: string; expiry: string } | null = null
  const expired =
    !conn.token_expiry || new Date(conn.token_expiry).getTime() < Date.now() + 60_000
  if (expired && conn.refresh_token) {
    const { credentials } = await client.refreshAccessToken()
    client.setCredentials(credentials)
    if (credentials.access_token) {
      refreshed = {
        access_token: credentials.access_token,
        expiry: new Date(credentials.expiry_date ?? Date.now() + 3500_000).toISOString(),
      }
    }
  }
  return { client, refreshed }
}

// ─── FreeBusy: intervalos ocupados en una ventana ────────────────────────────
export async function queryBusy(
  conn: GCalConnection,
  timeMin: Date,
  timeMax: Date
): Promise<{ busy: { start: string; end: string }[]; refreshed: any }> {
  const { client, refreshed } = await authedClient(conn)
  const calendar = google.calendar({ version: 'v3', auth: client })
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: conn.calendar_id || 'primary' }],
    },
  })
  const cals = res.data.calendars || {}
  const cal = cals[conn.calendar_id || 'primary']
  const busy = (cal?.busy || []).map((b) => ({ start: b.start!, end: b.end! }))
  return { busy, refreshed }
}

// ─── Crear / borrar evento (FiestaGo → Google) ───────────────────────────────
export async function createAllDayEvent(
  conn: GCalConnection,
  opts: { date: string; summary: string; description?: string }
): Promise<{ eventId: string | null; refreshed: any }> {
  const { client, refreshed } = await authedClient(conn)
  const calendar = google.calendar({ version: 'v3', auth: client })
  // Evento de día completo: end = día siguiente (exclusivo)
  const end = new Date(opts.date + 'T00:00:00Z')
  end.setUTCDate(end.getUTCDate() + 1)
  const res = await calendar.events.insert({
    calendarId: conn.calendar_id || 'primary',
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      start: { date: opts.date },
      end: { date: end.toISOString().slice(0, 10) },
      transparency: 'opaque', // cuenta como "ocupado"
    },
  })
  return { eventId: res.data.id ?? null, refreshed }
}

export async function deleteEvent(conn: GCalConnection, eventId: string) {
  const { client, refreshed } = await authedClient(conn)
  const calendar = google.calendar({ version: 'v3', auth: client })
  try {
    await calendar.events.delete({
      calendarId: conn.calendar_id || 'primary',
      eventId,
    })
  } catch (err: any) {
    // 404/410 = ya no existe; lo damos por borrado
    const code = err?.code || err?.response?.status
    if (code !== 404 && code !== 410) throw err
  }
  return { refreshed }
}

// ─── Notificaciones push (watch) ─────────────────────────────────────────────
export async function watchCalendar(conn: GCalConnection): Promise<{
  channelId: string
  resourceId: string | null
  expiration: string | null
  refreshed: any
}> {
  const { client, refreshed } = await authedClient(conn)
  const calendar = google.calendar({ version: 'v3', auth: client })
  const channelId = crypto.randomUUID()
  const res = await calendar.events.watch({
    calendarId: conn.calendar_id || 'primary',
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: `${appUrl()}/api/google/webhook`,
    },
  })
  const expMs = res.data.expiration ? Number(res.data.expiration) : null
  return {
    channelId,
    resourceId: res.data.resourceId ?? null,
    expiration: expMs ? new Date(expMs).toISOString() : null,
    refreshed,
  }
}

export async function stopWatch(conn: GCalConnection, channelId: string, resourceId: string) {
  const { client } = await authedClient(conn)
  const calendar = google.calendar({ version: 'v3', auth: client })
  try {
    await calendar.channels.stop({ requestBody: { id: channelId, resourceId } })
  } catch {
    /* best-effort */
  }
}
