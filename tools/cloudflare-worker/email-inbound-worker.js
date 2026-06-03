/**
 * FiestaGo · Cloudflare Email Worker
 * ────────────────────────────────────────────────────────────────────
 * Recibe emails enviados a respuestas@fiestago.es (o cualquier alias
 * configurado en Cloudflare Email Routing) y los reenvía al endpoint
 * /api/webhooks/email-inbound de FiestaGo como JSON POST.
 *
 * Cloudflare parsea automáticamente el email entrante y se lo pasa al
 * Worker como un objeto `message` con headers, raw bytes, from, to.
 * Usamos postal-mime (incluido como dependencia npm) para extraer el
 * texto plano del body.
 *
 * Setup:
 *   1. Crear Worker en Cloudflare Dashboard → Workers & Pages → Create.
 *   2. Pegar este código.
 *   3. Añadir secret SITE_URL = "https://fiestago.es"
 *   4. Añadir secret INBOUND_EMAIL_SECRET = "<el mismo valor que en
 *      las env vars de Netlify>"
 *   5. Ir a fiestago.es → Email → Email Routing → habilitar.
 *   6. Crear regla: "Custom address respuestas@fiestago.es" → "Send to
 *      a Worker" → seleccionar este Worker.
 *      (Opcional) Catch-all: cualquier *@fiestago.es → este Worker.
 * ────────────────────────────────────────────────────────────────────
 */

import PostalMime from 'postal-mime'

export default {
  /**
   * Cloudflare invoca este handler cuando llega un email.
   * @param {EmailMessage} message
   * @param {object} env
   */
  async email(message, env) {
    try {
      // Parse el cuerpo MIME del email para extraer texto y subject.
      const parser = new PostalMime()
      const parsed = await parser.parse(message.raw)

      const payload = {
        from:    parsed.from?.address || message.from || '',
        to:      message.to || '',
        subject: parsed.subject || '',
        text:    parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '',
        messageId: parsed.messageId || '',
      }

      const res = await fetch(`${env.SITE_URL}/api/webhooks/email-inbound`, {
        method: 'POST',
        headers: {
          'Content-Type':     'application/json',
          'x-inbound-secret': env.INBOUND_EMAIL_SECRET || '',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        console.error('[email-worker] Endpoint respondió error:', res.status, await res.text())
        // Devolvemos el email al sender si nuestro servidor falla — así
        // no se pierde silenciosamente.
        message.setReject('Procesamiento del email falló temporalmente. Inténtalo de nuevo.')
      }
    } catch (err) {
      console.error('[email-worker] Excepción:', err)
      message.setReject('Error procesando el mensaje.')
    }
  },
}
