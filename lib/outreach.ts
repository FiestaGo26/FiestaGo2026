// ───────────────────────────────────────────────────────────────────────
// Plantillas de outreach (email + DM Instagram). Fuente única para que
// el agente de captación y el endpoint de regeneración usen el mismo
// texto. Si toca cambiar el copy, se cambia AQUÍ.
// ───────────────────────────────────────────────────────────────────────

type ProviderLike = {
  name: string
  city: string
  source?: string | null
}

// Cuerpo principal del email — más largo, formal-cercano, con detalles
// que en el DM no caben (sello calidad, referidos).
export function buildEmailBody(p: ProviderLike): string {
  const sourceLabel = p.source === 'instagram' ? ' en Instagram'
                    : p.source === 'tiktok'    ? ' en TikTok'
                    : ''
  return `Hola ${p.name},

Soy Mariano, fundador de FiestaGo. Te escribo porque vimos tu trabajo${sourceLabel} y me ha encantado.

FiestaGo es un marketplace nuevo de celebraciones en España — bodas, cumpleaños, comuniones, eventos privados y familiares. Estamos lanzando ahora y seleccionando los primeros profesionales en ${p.city} con los que arrancar.

Lo que te puedo ofrecer es visibilidad real: una fuente nueva de clientes sin que tengas que cambiar nada de cómo trabajas hoy. Recibes la solicitud, decides si te encaja y haces tu evento como siempre.

A diferencia de Bodas.net o Zankyou, en FiestaGo no hay cuota anual ni permanencia. Tú cobras el 100% del precio que pongas en tu ficha. La comisión del 8% la paga el cliente como parte de la "Garantía de Éxito" — si algo sale mal con la reserva, le respondemos económicamente al cliente. Eso te diferencia y te da credibilidad.

En esta página tienes la comparativa completa con Bodas.net + una calculadora para que veas con tus números cuánto ganarías de más al año:
https://fiestago.es/profesionales

Además, al entrar ahora te llevas:

- Mejor posición en los resultados (catálogo en construcción).
- Sello FiestaGo de Calidad gratis, visible junto a tu perfil mientras mantengas 4,5/5 en reseñas.
- Promoción en nuestras redes (@fiestagospain).
- Si invitas a otro profesional y se registra, los dos subís a los primeros puestos de vuestra categoría sin coste extra.

Inscríbete en menos de 60 segundos:
https://fiestago.es/profesionales

Cualquier duda, simplemente responde a este email o escribe a contacto@fiestago.es.

Un abrazo,
Mariano · FiestaGo`
}

export function buildEmailDraft(p: ProviderLike): string {
  return `ASUNTO: Tu negocio en FiestaGo · ${p.city}\n\n${buildEmailBody(p)}`
}

// WhatsApp compacto (~700 chars). Tono cercano, sin asunto, sin formato
// formal. El admin lo envía con 1 clic vía wa.me — el mensaje viene
// pre-rellenado en el chat y solo tiene que pulsar enviar.
export function buildWhatsAppDraft(p: ProviderLike): string {
  return `Hola ${p.name} 👋 Soy Mariano, fundador de FiestaGo.

Vi vuestro trabajo en ${p.city} y me ha encantado. Os escribo porque estamos lanzando en España un marketplace nuevo de celebraciones (bodas, cumpleaños, comuniones, eventos privados) y seleccionando los primeros profesionales con los que arrancar.

A diferencia de Bodas.net o Zankyou, en FiestaGo no hay cuota ni permanencia: cobras el 100% del precio que pongas en tu ficha. La comisión del 8% la paga el cliente como Garantía de Éxito.

Tienes la calculadora de cuánto ganarías de más al año aquí:
👉 https://fiestago.es/profesionales

Si te encaja, te puedes inscribir en menos de 1 minuto. Cualquier duda, respóndeme por aquí. ¡Un abrazo!`
}

// Mensaje corto para dejar en formularios de contacto web. El admin
// rellena el formulario y pega este mensaje en el campo de "Mensaje".
export function buildWebFormDraft(p: ProviderLike): string {
  return `Hola ${p.name},

Soy Mariano, fundador de FiestaGo. Os escribo desde vuestra web porque me ha encantado vuestro trabajo en ${p.city}.

FiestaGo es un marketplace nuevo de celebraciones que estamos lanzando en España. Sin cuotas ni permanencia: cobráis el 100% del precio que pongáis en vuestra ficha; la comisión del 8% la paga el cliente como Garantía de Éxito.

Os dejo la calculadora de cuánto ganaríais de más al año + el registro en 60 segundos:
https://fiestago.es/profesionales

Si os encaja, podéis inscribiros directamente. Cualquier duda, respondedme a contacto@fiestago.es.

Un abrazo,
Mariano · FiestaGo`
}

// DM compacto (~800 chars) — Instagram limita a ~1000 por mensaje.
// Tono personal, en primera persona, sin folleto de ventajas. Si
// responden, ya les explicamos sello, referidos y el resto en
// conversación.
export function buildDmDraft(p: ProviderLike): string {
  return `Hola ${p.name} 👋

Soy Mariano, fundador de FiestaGo. He estado viendo lo que haces en ${p.city} y me ha encantado.

FiestaGo es un marketplace nuevo de celebraciones — bodas, cumples, comuniones, eventos privados. Lanzamos en España.

A diferencia de los marketplaces tradicionales del sector (con cuota anual y permanencia), no hay cuota ni permanencia. Tú cobras el 100% del precio que pongas en tu ficha. El cliente paga un 8% extra como Garantía de Éxito (si algo sale mal con la reserva, le respondemos económicamente). Tú no pagas nada.

En esta página tienes la calculadora de cuánto ganarías de más al año:
👉 https://fiestago.es/profesionales

Inscríbete en 60 segundos y entras en el catálogo inicial.

Cualquier duda, respóndeme por aquí mismo. Un abrazo,
Mariano`
}

// ── Follow-ups ────────────────────────────────────────────────────────
// Segundo (y tercer) toque cuando el primer mensaje no obtuvo respuesta.
// Tono más corto, asume que se traspapeló, da salida fácil ("dímelo y
// dejo de insistir") para no quemar la marca.

export function buildDmFollowup(p: ProviderLike, attempt: number = 1): string {
  if (attempt >= 2) {
    return `Hola ${p.name}, último mensaje 🙏

No quiero saturarte, así que este es el último. Si no te encaja FiestaGo, sin problema — borro la nota y dejamos aquí.

Pero si te interesa probarlo con los primeros profesionales de ${p.city}, inscríbete en 60 segundos:
👉 https://fiestago.es/profesionales

Un abrazo,
Mariano`
  }
  return `Hola ${p.name}, soy Mariano otra vez 👋

Te escribí hace unos días sobre FiestaGo y no he tenido respuesta — imagino que se te traspapeló entre tantos mensajes (a mí me pasa todo el rato).

Te dejo el resumen rapidito: estamos lanzando en España, sin cuotas ni permanencia. Tú cobras el 100% del precio que pongas — la comisión la paga el cliente como Garantía de Éxito. La calculadora con tus números está en la landing.

Si te encaja, regístrate aquí en menos de 60 segundos:
👉 https://fiestago.es/profesionales

Y si no te interesa, también dímelo — sin problema, dejo de insistir 🙏

Un abrazo,
Mariano`
}

export function buildEmailFollowup(p: ProviderLike, attempt: number = 1): string {
  const body = attempt >= 2
    ? `Hola ${p.name},

Soy Mariano de FiestaGo. Te he escrito un par de veces y este es el último mensaje — no quiero ser pesado.

Si no te encaja FiestaGo, sin problema. Si sí, estamos lanzando ahora en España y todavía a tiempo de meterte en el catálogo inicial:

https://fiestago.es/profesionales

Un abrazo,
Mariano`
    : `Hola ${p.name},

Soy Mariano, fundador de FiestaGo. Te escribí hace unos días y no recibí respuesta — imagino que se traspapeló entre tantos correos (a mí me pasa todo el rato).

Te dejo el resumen rapidito: estamos lanzando en España, sin cuotas ni permanencia. Tú cobras el 100% del precio que pongas en tu ficha; la comisión del 8% la paga el cliente como Garantía de Éxito. La calculadora de cuánto ganarías de más al año está en la landing.

Si te interesa, te puedes inscribir en menos de 60 segundos:
https://fiestago.es/profesionales

Y si no, dímelo y te quito de la lista — sin problema.

Un abrazo,
Mariano`

  return `ASUNTO: ¿Te interesa FiestaGo? (mensaje breve) · ${p.city}\n\n${body}`
}
