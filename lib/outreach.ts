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

FiestaGo es un marketplace nuevo de celebraciones en España — bodas, cumpleaños, comuniones, eventos privados y familiares. Lanzamos el 10 de junio de 2026 y estoy seleccionando los primeros profesionales en ${p.city} con los que arrancar.

Lo que te puedo ofrecer es visibilidad real: una fuente nueva de clientes sin que tengas que cambiar nada de cómo trabajas hoy. Recibes la solicitud, decides si te encaja y haces tu evento como siempre.

Solo nos quedamos un 8% cuando hay reserva — y la primera te la regalamos al 0% para que pruebes sin riesgo. Sin cuotas, sin permanencia, te vas cuando quieras.

Además, al entrar antes del lanzamiento te llevas:

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

// DM compacto (~800 chars) — Instagram limita a ~1000 por mensaje.
// Tono personal, en primera persona, sin folleto de ventajas. Si
// responden, ya les explicamos sello, referidos y el resto en
// conversación.
export function buildDmDraft(p: ProviderLike): string {
  return `Hola ${p.name} 👋

Soy Mariano, fundador de FiestaGo. Te escribo porque he estado viendo lo que haces en ${p.city} y me ha encantado.

FiestaGo es un sitio nuevo donde la gente reserva proveedores para sus celebraciones — bodas, cumples, comuniones, eventos privados. Lanzamos el 10 de junio y estoy buscando a los primeros profesionales con los que arrancar.

Lo que te puedo ofrecer es visibilidad real: una fuente nueva de clientes sin que tengas que cambiar nada de cómo trabajas hoy. Tú recibes la solicitud, decides si te encaja y haces tu evento como siempre.

Solo nos quedamos un 8% cuando hay reserva — y la primera te la regalamos al 0% para que pruebes sin riesgo. Sin cuotas, sin permanencia, te vas cuando quieras.

Inscríbete en menos de 60 segundos:
👉 https://fiestago.es/profesionales

Si tienes cualquier duda, respóndeme por aquí mismo. Hablamos cuando quieras.

Un abrazo,
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

Pero si te interesa probar el lanzamiento del 10 de junio con los primeros profesionales de ${p.city}, inscríbete en 60 segundos:
👉 https://fiestago.es/profesionales

Un abrazo,
Mariano`
  }
  return `Hola ${p.name}, soy Mariano otra vez 👋

Te escribí hace unos días sobre FiestaGo y no he tenido respuesta — imagino que se te traspapeló entre tantos mensajes (a mí me pasa todo el rato).

Te dejo el resumen rapidito: estamos eligiendo los primeros profesionales en ${p.city} antes del lanzamiento del 10 de junio. Sin cuotas, sin permanencia, primera reserva al 0% y luego solo 8%. Lo único que tienes que hacer es decir sí cuando te llegue una solicitud.

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

Si no te encaja FiestaGo, sin problema. Si sí, el lanzamiento es el 10 de junio y todavía estamos a tiempo de meterte en el catálogo inicial:

https://fiestago.es/profesionales

Un abrazo,
Mariano`
    : `Hola ${p.name},

Soy Mariano, fundador de FiestaGo. Te escribí hace unos días y no recibí respuesta — imagino que se traspapeló entre tantos correos (a mí me pasa todo el rato).

Te dejo el resumen rapidito: estamos seleccionando los primeros profesionales en ${p.city} antes del lanzamiento del 10 de junio. Sin cuotas, sin permanencia, tu primera reserva al 0% y solo 8% después. Recibes solicitudes, las aceptas si te encajan y trabajas como siempre.

Si te interesa, te puedes inscribir en menos de 60 segundos:
https://fiestago.es/profesionales

Y si no, dímelo y te quito de la lista — sin problema.

Un abrazo,
Mariano`

  return `ASUNTO: ¿Te interesa FiestaGo? (mensaje breve) · ${p.city}\n\n${body}`
}
