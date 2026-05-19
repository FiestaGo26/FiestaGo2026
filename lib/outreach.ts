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
https://fiestago.es/registro-proveedor

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
👉 https://fiestago.es/registro-proveedor

Si tienes cualquier duda, respóndeme por aquí mismo. Hablamos cuando quieras.

Un abrazo,
Mariano`
}
