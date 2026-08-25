import { sendEmail } from '@/lib/resend'

// Email semanal al proveedor: "llevas X días sin publicar, aquí tienes
// un post ya redactado, cópialo y pégalo en tu ficha en 30 segundos".
// El objetivo es 0 fricción — que el proveedor tenga que hacer 2 clics
// (copiar + pegar en Google) desde el móvil.
export async function emailProviderGmbWeeklyReminder(opts: {
  to:                string
  providerName:      string
  daysSincePublish:  number
  postBody:          string
  postCtaLabel:      string
  postCtaUrl:        string
  googleBusinessUrl: string | null   // deep link a su ficha si lo tiene
  panelUrl:          string          // enlace al panel FiestaGo (tab GMB)
  unsubscribeUrl:    string          // desactivar el recordatorio
}): Promise<{ ok: boolean; error?: string }> {
  const {
    to, providerName, daysSincePublish, postBody,
    postCtaLabel, postCtaUrl, googleBusinessUrl, panelUrl, unsubscribeUrl,
  } = opts

  const escape = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const openHref = googleBusinessUrl || 'https://business.google.com/create'
  const openLabel = googleBusinessUrl
    ? 'Abrir mi ficha de Google'
    : 'Abrir Google Business'

  const subject = daysSincePublish >= 30
    ? `Tu ficha de Google lleva ${daysSincePublish} días sin actividad`
    : `¿Publicamos algo esta semana en Google?`

  const text = `Hola ${providerName},

Llevas ${daysSincePublish} días sin publicar nada en tu ficha de Google Business Profile. Google premia las fichas activas: subir un post a la semana mejora tu posición para búsquedas del tipo "fotógrafo bodas cerca de mí".

Te dejo un post ya redactado — solo tienes que copiar y pegar:

────────────────────────────────
${postBody}

👉 ${postCtaUrl}
────────────────────────────────

CTA sugerido: ${postCtaLabel} → ${postCtaUrl}

Cómo publicarlo en 30 segundos:
1. Copia el texto de arriba
2. Abre ${openHref}
3. Pulsa "Añadir novedad" o "Crear publicación"
4. Pega y publica

O gestiónalo desde tu panel FiestaGo: ${panelUrl}

—
FiestaGo · Marketing en piloto automático

Para desactivar estos recordatorios semanales: ${unsubscribeUrl}
`

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1F2937;">
  <p style="font-size:15px;line-height:1.6;">Hola ${escape(providerName)},</p>
  <p style="font-size:15px;line-height:1.6;">
    Llevas <b>${daysSincePublish} días sin publicar</b> en tu ficha de Google Business Profile.
    Google premia las fichas activas: subir un post a la semana mejora tu posición
    para búsquedas del tipo "<i>fotógrafo bodas cerca de mí</i>".
  </p>

  <p style="font-size:14px;color:#6B7280;margin-top:24px;margin-bottom:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">
    Post ya redactado
  </p>
  <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;
              font-size:14px;line-height:1.6;white-space:pre-wrap;color:#1F2937;">${escape(postBody)}</div>
  <div style="margin-top:8px;padding-top:8px;">
    <span style="display:inline-block;padding:6px 12px;border-radius:6px;background:#4285F4;color:#fff;
                 font-size:12px;font-weight:600;">${escape(postCtaLabel)}</span>
    <span style="font-size:12px;color:#6B7280;margin-left:8px;">→ ${escape(postCtaUrl)}</span>
  </div>

  <div style="margin-top:24px;text-align:center;">
    <a href="${openHref}" target="_blank"
       style="display:inline-block;padding:12px 24px;border-radius:8px;background:#4285F4;
              color:#fff;text-decoration:none;font-weight:700;font-size:14px;">
      ${openLabel} →
    </a>
  </div>

  <p style="font-size:13px;color:#6B7280;margin-top:20px;line-height:1.6;">
    Pasos: <b>copia</b> el texto de arriba → <b>pulsa el botón</b> → en Google elige
    "Añadir novedad" → <b>pega</b> y publica.
  </p>

  <p style="font-size:13px;color:#6B7280;margin-top:16px;">
    O gestiónalo desde <a href="${panelUrl}" style="color:#C0392B;">tu panel FiestaGo</a>.
  </p>

  <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
  <p style="font-size:11px;color:#9CA3AF;text-align:center;">
    FiestaGo · Marketing en piloto automático<br>
    <a href="${unsubscribeUrl}" style="color:#9CA3AF;">Desactivar recordatorios semanales</a>
  </p>
</div>`

  return sendEmail({ to, subject, text, html })
}
