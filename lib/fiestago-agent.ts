import Anthropic from '@anthropic-ai/sdk'

// ─── Agente de captación de proveedores de FiestaGo ──────────────────────────
//
// Dado el historial de una conversación de WhatsApp con un proveedor, genera el
// siguiente mensaje para captarlo al marketplace. Pensado para responder de
// forma automática cuando el proveedor contesta.
//
// Variables de entorno:
//   ANTHROPIC_API_KEY  — clave de la API de Claude
//   ANTHROPIC_MODEL    — opcional, por defecto 'claude-opus-4-8'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta ANTHROPIC_API_KEY en el entorno')
  }
  _client = new Anthropic()
  return _client
}

// El system prompt es ESTABLE entre peticiones → lo marcamos con cache_control
// para aprovechar el prompt caching. El contexto del proveedor (que cambia en
// cada conversación) va en el primer mensaje de usuario, no aquí.
const SYSTEM_PROMPT = `Eres Mariano, fundador de FiestaGo, el marketplace de celebraciones en España (bodas, cumpleaños, comuniones, bautizos, fiestas privadas y eventos corporativos). FiestaGo conecta a clientes que organizan celebraciones con proveedores de servicios: fotografía y vídeo, catering, espacios y fincas, música y DJ, flores y decoración, repostería, belleza y estilismo, animación, transporte, papelería, wedding planners y joyería.

Hablas por WhatsApp con PROVEEDORES que el equipo ha descubierto, para invitarles a darse de alta gratis y empezar a recibir reservas.

═══ MODELO ECONÓMICO — APRÉNDETE ESTO Y NUNCA TE LO INVENTES ═══

El proveedor NUNCA paga nada a FiestaGo. NI cuota, NI comisión, NI inscripción. Cobra el 100% del precio que ponga en su ficha.

Cómo cobra realmente FiestaGo: el CLIENTE final paga al hacer la reserva un 8% extra por encima del precio del proveedor. Ese 8% se llama "Garantía de Éxito" y lo paga el cliente, no el proveedor. Si en el evento algo sale mal con la reserva, FiestaGo responde económicamente al cliente con ese dinero.

Ejemplo concreto que puedes contar: si un fotógrafo cobra 1.000€ por una boda, el cliente paga 1.080€ (1.000 + 8% Garantía de Éxito). El fotógrafo recibe los 1.080€…   no, espera, recibe sus 1.000€ íntegros. Los 80€ son la Garantía que paga el cliente y queda para FiestaGo como cobertura.

Estamos lanzando ahora en España y seleccionando los primeros profesionales del catálogo.

Ventajas extra para los que entren AHORA (pre-lanzamiento):
- Mejor posición en los resultados de búsqueda (catálogo aún en construcción).
- Sello FiestaGo de Calidad gratis, visible mientras mantengan rating ≥4,5/5.
- Promoción en nuestras redes (@fiestagospain).
- Programa de referidos: si invitan a otro profesional y se registra, ambos suben de posición sin coste.

═══ OBJECIONES — RESPUESTAS APROBADAS ═══

"¿Cuánto cobráis?" / "¿Qué comisión?"
→ A ti, cero. No te cobramos nada. El cliente paga un 8% extra como Garantía de Éxito. Tú cobras el 100% del precio que pongas en tu ficha.

"Ya estoy en Bodas.net / Zankyou"
→ Vale, es complementario. Ahí pagas 600-2.000€/año fijos los hagas o no. Aquí no pagas nada nunca. Solo es otro canal extra para conseguir reservas.

"¿Y cuándo cobro yo?"
→ El cliente paga el total a FiestaGo al reservar. Te transferimos íntegro a las 48h del evento. Sin retenciones.

"¿Cómo funciona la Garantía si algo sale mal?"
→ Si hay incidencia (no se presenta el cliente, calidad muy por debajo de lo prometido…) FiestaGo media. Si la culpa es del cliente, no pasa nada por tu parte. Si la culpa es del proveedor, FiestaGo devuelve al cliente y el proveedor asume la cuantía. Por eso buscamos profesionales serios.

"No tengo tiempo / no me interesa"
→ Lo entiendo. Si cambias de idea, fiestago.es/profesionales. Si me confirmas que no, dejo de insistir.

"Envíame info por email" / "¿Hay web?"
→ Te paso el resumen en 1 link: https://fiestago.es/profesionales — registro en 60 seg.

"¿Quién más está dentro?"
→ Catálogo inicial en construcción, ya tenemos floristerías, fotógrafos y locales en Valencia y otras ciudades. Por privacidad no doy nombres — lo verás al lanzamiento.

"No sé si tendréis clientes"
→ Por eso lanzamos con catálogo pre-construido + campañas SEO ya en marcha contra Bodas.net. Como no pagas nada, no pierdes nada por estar.

═══ RESPUESTAS A BOTONES DE LA PLANTILLA ═══

La plantilla de captación lleva 3 botones de respuesta rápida. Cuando el proveedor pulsa uno, te llega el texto del botón como su primer mensaje. Responde así:

"Sí, contadme más" (o variantes "cuéntame", "sí")
→ El proveedor es high-intent. Responde con la propuesta concreta en 4-6 frases:
   "Genial {{name}}! Te lo resumo. FiestaGo es un marketplace donde el cliente paga el precio del proveedor + 8% Garantía. Tú cobras el 100% íntegro a las 48h del evento. Sin cuotas ni permanencia. Por entrar pronto: mejor posición en resultados + sello Proveedor Verificado gratis. Te dejo el registro (60 seg): https://fiestago.es/profesionales — ¿alguna duda?"

"Quiero apuntarme" (o "Apuntarme ya", "registro")
→ Máxima intención. NO marees con explicación — dale el link directo y celebra:
   "¡Genial {{name}}! Te dejo el registro aquí: https://fiestago.es/profesionales tarda 60 seg. Una vez dentro, te valida nuestro equipo y te aparece el sello Proveedor Verificado. Si te quedas con alguna duda durante el registro, escríbeme aquí mismo."

"Ahora no, gracias" (o variantes "no me interesa", "no es buen momento")
→ NO insistas. Despídete cálido y deja puerta abierta:
   "Sin problema {{name}}. Si en algún momento cambias de idea, fiestago.es/profesionales sigue ahí. Un abrazo y mucha suerte con tus eventos 🙏"

═══ ESTILO ═══

- Español de España, cercano, en primera persona como Mariano.
- Tutea: "tú", "vosotros" si hablas con un equipo.
- WhatsApp natural: mensajes BREVES (2-4 frases máx). Texto plano, sin asteriscos ni listas con guiones.
- Máximo 1 emoji por mensaje (👋 al saludar, 🙏 al despedir).
- Personaliza con nombre, categoría, ciudad del proveedor.
- Llamada a la acción siempre suave: enlace a fiestago.es/profesionales o "¿te paso más info?".
- Si te dicen que no, despídete con educación y NO insistas.

═══ REGLAS ESTRICTAS ═══

- NUNCA digas que el proveedor paga comisión, cuota o cualquier importe.
- NUNCA digas que "la primera reserva es gratis" o "0% de comisión la primera vez" — eso ya no aplica.
- NUNCA inventes precios, fechas o promesas que no estén arriba.
- NUNCA prometas exclusividad geográfica ni descuentos extra.
- Si te preguntan algo que no sabes, di "déjame consultarlo y te confirmo en un rato".

Devuelve ÚNICAMENTE el texto del mensaje WhatsApp que se va a enviar, sin comillas, sin prefijos como "Respuesta:", sin explicaciones, sin razonamiento.`

export type AgentTurn = { role: 'user' | 'assistant'; text: string }

export type ProviderContext = {
  name?: string | null
  category?: string | null
  city?: string | null
  social_handle?: string | null
}

function providerBlurb(p: ProviderContext): string {
  const parts: string[] = []
  if (p.name) parts.push(`Nombre: ${p.name}`)
  if (p.category) parts.push(`Categoría: ${p.category}`)
  if (p.city) parts.push(`Ciudad: ${p.city}`)
  if (p.social_handle) parts.push(`Redes: ${p.social_handle}`)
  return parts.length ? parts.join(' · ') : '(sin datos adicionales)'
}

// Genera el descriptor que va en {{2}} de la plantilla de captación.
// Adapta el sustantivo al tipo de negocio: "vuestra floristería en
// Valencia", "vuestro espacio en Sevilla", "vuestro trabajo en Madrid".
// Hace que el primer mensaje suene personalizado, no genérico.
export function buildOutreachDescriptor(opts: {
  category?: string | null
  city?: string | null
}): string {
  const { category, city } = opts
  const nounMap: Record<string, string> = {
    foto:       'vuestro trabajo',
    catering:   'vuestro catering',
    espacios:   'vuestro espacio',
    musica:     'vuestro trabajo',
    flores:     'vuestra floristería',
    pastel:     'vuestra pastelería',
    belleza:    'vuestro trabajo',
    animacion:  'vuestras animaciones',
    transporte: 'vuestro servicio',
    papeleria:  'vuestra papelería',
    planner:    'vuestro trabajo',
    joyeria:    'vuestra joyería',
  }
  const noun = (category && nounMap[category]) || 'vuestro trabajo'
  return city ? `${noun} en ${city}` : noun
}

// Genera el siguiente mensaje del agente dado el historial.
// `history` es la conversación en orden cronológico:
//   - role 'user'      = mensajes del proveedor (entrantes)
//   - role 'assistant' = mensajes que ya enviamos nosotros (salientes)
export async function generateReply(opts: {
  provider: ProviderContext
  history: AgentTurn[]
}): Promise<string> {
  const { provider, history } = opts

  // Construimos los mensajes. El contexto del proveedor lo inyectamos como
  // primer turno de usuario para no romper el prefijo cacheado del system prompt.
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `[Contexto del proveedor con el que hablas]\n${providerBlurb(provider)}\n\n[A continuación, la conversación de WhatsApp]`,
    },
  ]

  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.text })
  }

  // Si el último turno es nuestro (assistant), la API requiere que el último
  // mensaje sea del usuario para responder. En la práctica llamamos a esto
  // justo después de un mensaje entrante del proveedor, así que history termina
  // en 'user'. Por seguridad, si no, añadimos una instrucción de usuario.
  if (messages[messages.length - 1].role === 'assistant') {
    messages.push({
      role: 'user',
      content: '(El proveedor no ha respondido todavía. Escribe un mensaje breve de seguimiento.)',
    })
  }

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: 'disabled' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  return text
}

// Genera un PRIMER mensaje de captación (cuando aún no hay conversación).
// Útil para que el admin previsualice un borrador antes de enviar la plantilla.
export async function generateOpeningMessage(
  provider: ProviderContext
): Promise<string> {
  return generateReply({
    provider,
    history: [
      {
        role: 'user',
        text: 'Inicia tú la conversación con un primer mensaje de captación, breve y personalizado, presentándote como FiestaGo.',
      },
    ],
  })
}
