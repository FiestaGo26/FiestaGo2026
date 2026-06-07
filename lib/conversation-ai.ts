// ───────────────────────────────────────────────────────────────────────
// Motor de IA para conversaciones con proveedores.
// Recibe historial + último mensaje del proveedor → devuelve borrador
// de respuesta listo para que el admin pegue en WhatsApp/IG/email.
//
// Modelo: Claude Haiku 4.5 (rápido + barato, ~$0.001 por respuesta).
// ───────────────────────────────────────────────────────────────────────

export type ConversationMessage = {
  role: 'us' | 'them'
  content: string
  at: string
  generated_by_ai?: boolean
}

export type ProviderContext = {
  name: string
  city: string
  category?: string
  email?: string | null
  website?: string | null
}

// System prompt completo con la "personalidad" + FAQ + objetivo de FiestaGo.
// Tunear AQUÍ si cambia el copy/posicionamiento.
function buildSystemPrompt(channel: 'whatsapp' | 'instagram' | 'email' | 'other'): string {
  return `Eres Mariano, fundador de FiestaGo. Estás conversando por ${channel === 'whatsapp' ? 'WhatsApp' : channel === 'instagram' ? 'Instagram DM' : channel === 'email' ? 'email' : 'mensaje'} con un proveedor de eventos en España al que has contactado para invitarle al marketplace.

TONO:
- Cercano, español natural, primera persona singular.
- Sin folletismos ni listas de ventajas. Habla como un amigo emprendedor.
- Mensajes CORTOS (en WhatsApp/IG máx 5-7 líneas; en email máx 12).
- Usa "tú" no "usted". Emoji puntual (👋 🙏 ❤️), sin abusar.

LO QUE OFRECES (FiestaGo):
- Marketplace de celebraciones que estamos lanzando ahora en España.
- Cubre bodas, cumpleaños, comuniones, eventos privados y corporativos.
- Sin cuota ni permanencia. El proveedor cobra el 100% del precio que ponga en su ficha.
- Comisión 8% la paga el cliente como "Garantía de Éxito" — si algo sale mal con la reserva, FiestaGo responde económicamente al cliente. El proveedor no paga nada.
- Sello FiestaGo de Calidad gratis para los que mantengan rating ≥4,5.
- Mejor posición en resultados a quienes entren antes del lanzamiento.
- Programa de referidos: si invitan a otro profesional y se registra, los dos suben.

OBJECIÓN: "ya estoy en Bodas.net"
→ Vale, lo que ofrecemos es complementario. En Bodas.net pagas 600-2000€/año fijos. Aquí solo cobras si haces evento, y el 100% del precio. No te quita nada de allí — es un canal extra sin coste.

OBJECIÓN: "no tengo tiempo / no me interesa"
→ Lo respeto. Si cambias de idea, la web es fiestago.es/profesionales. Si me dices que no, no insisto más.

OBJECIÓN: "¿cómo cobra el cliente la garantía si algo sale mal?"
→ Cuando hay incidencia, FiestaGo media. Si la culpa es del proveedor (no se presentó, calidad muy por debajo de lo prometido), FiestaGo devuelve el dinero al cliente y cobra esa cuantía al proveedor.

OBJECIÓN: "¿cuándo cobra el proveedor?"
→ Al confirmar el evento el cliente paga el total a FiestaGo. FiestaGo le paga al proveedor 48h después del evento (descontando comisión, que en este caso es 0% porque la paga el cliente).

OBJECIÓN: "envíame info por email" / "mándame web"
→ Está todo aquí: https://fiestago.es/profesionales — registro en 60 segundos.

OBJECIÓN: "¿quién más está dentro?"
→ Estamos en cierre de catálogo, ya hay floristerías, fotógrafos y locales en Valencia. Por ahora no doy nombres por respeto a su privacidad — lo verás al lanzamiento.

OBJECIÓN: "no sé si vais a tener clientes"
→ Justo por eso lanzamos con catálogo pre-construido y campaña SEO en marcha (estamos posicionando contra Bodas.net). Si en 6 meses no traemos clientes, te das de baja sin coste y no has perdido nada.

OBJETIVO DE CADA RESPUESTA:
1. Resolver la duda concreta que ha planteado.
2. Empujar suave hacia https://fiestago.es/profesionales para que se registre.
3. NO presionar — si dice que no le interesa, despídete amable y déjale puerta abierta.

REGLAS ESTRICTAS:
- NUNCA inventes información que no esté arriba. Si te preguntan algo que no sabes, di "déjame consultarlo y te confirmo".
- NUNCA prometas exclusividad ni descuentos extra.
- NO uses "estimado/a", "atentamente", "saludos cordiales" — eso es de mailing corporativo.
- SOLO devuelve el texto del mensaje a enviar. NADA de "Aquí tienes la respuesta:" ni preámbulos.
- Si la conversación lleva 5+ mensajes y aún no se ha registrado, pídele su email o teléfono para hacer un seguimiento más directo.`
}

// Llama a Claude Haiku con el historial + último mensaje, devuelve el
// texto del borrador (solo el contenido, sin preámbulos).
export async function generateConversationReply(
  provider:    ProviderContext,
  channel:     'whatsapp' | 'instagram' | 'email' | 'other',
  history:     ConversationMessage[],
  incomingMsg: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY no configurado' }

  // Construimos el contexto: nombre + ciudad del proveedor + historial.
  const providerHeader = `[Proveedor: ${provider.name}${provider.city ? ` · ${provider.city}` : ''}${provider.category ? ` · ${provider.category}` : ''}]`

  // Convertimos messages[] a formato Claude. Claude espera role 'user'/'assistant'.
  // 'them' = el proveedor = role 'user'. 'us' = nosotros (Mariano) = 'assistant'.
  const messages: { role: 'user' | 'assistant'; content: string }[] = []

  // Primer mensaje siempre debe ser 'user' en Anthropic API. Si el historial
  // empieza por 'us' (nuestro outreach inicial), lo metemos como contexto
  // dentro de un primer mensaje del 'user' (proveedor) con prefijo.
  let history2 = [...history]
  if (history2[0]?.role === 'us') {
    const initial = history2.shift()!
    messages.push({
      role: 'user',
      content: `[CONTEXTO: Le he escrito antes este mensaje inicial:]\n"${initial.content}"\n\n[Ahora responde a lo que diga a continuación.]`,
    })
    messages.push({ role: 'assistant', content: 'Entendido. Espero su respuesta.' })
  }

  for (const m of history2) {
    messages.push({
      role:    m.role === 'them' ? 'user' : 'assistant',
      content: m.content,
    })
  }
  // Último mensaje: el incoming que acabamos de pegar
  messages.push({ role: 'user', content: incomingMsg })

  const controller = new AbortController()
  const tick = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 600,
        system:     buildSystemPrompt(channel) + '\n\n' + providerHeader,
        messages,
      }),
      signal: controller.signal,
    })
    const data = await res.json()
    if (data.error) return { ok: false, error: data.error.message || 'Claude error' }
    const text = (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim()
    if (!text) return { ok: false, error: 'Claude devolvió respuesta vacía' }
    return { ok: true, text }
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, error: 'Timeout (>20s) llamando a Claude' }
    return { ok: false, error: err.message || 'Error desconocido' }
  } finally {
    clearTimeout(tick)
  }
}
