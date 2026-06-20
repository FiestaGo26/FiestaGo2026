// Plantillas WhatsApp universales que sembramos en la cuenta del
// proveedor la primera vez que abre la pestaña (si no tiene ninguna).
// Cubren los 6 momentos típicos de una conversación con cliente.
// El proveedor puede editar, borrar o añadir las suyas después.

export const QUICK_REPLY_DEFAULTS: Array<{
  category: 'consulta' | 'presupuesto' | 'confirmacion' | 'seguimiento' | 'rechazo' | 'agradecimiento'
  label:    string
  body:     string
}> = [
  {
    category: 'consulta',
    label:    'Pedir detalles del evento',
    body:     `¡Hola {{nombre}}! Gracias por escribirme 😊\n\nPara prepararte un presupuesto ajustado, necesito un par de datos:\n\n• Fecha del evento\n• Ciudad o lugar\n• Número aproximado de invitados\n• ¿Hay algún detalle especial que quieras que tenga en cuenta?\n\nEn cuanto me lo confirmes te paso números 🙌`,
  },
  {
    category: 'consulta',
    label:    'Confirmar disponibilidad de fecha',
    body:     `¡Hola {{nombre}}! Mirando la agenda... {{fecha}} la tengo libre ✅\n\n¿Te gustaría que te preparase un presupuesto a medida? Si me cuentas un poco más del evento te lo paso hoy mismo.`,
  },
  {
    category: 'presupuesto',
    label:    'Enviar presupuesto adjunto',
    body:     `¡Aquí tienes el presupuesto que me pediste, {{nombre}}! 📄\n\n{{enlace}}\n\nEl total son {{precio}}. Incluye todo lo que comentamos. Si quieres ajustar algo o tienes dudas, dime y lo revisamos juntos 🙂\n\nLa disponibilidad para {{fecha}} la mantengo bloqueada 48h.`,
  },
  {
    category: 'presupuesto',
    label:    'Recordatorio amable de presupuesto pendiente',
    body:     `¡Hola {{nombre}}! 👋\n\nNo quería darte la lata, solo quería saber si pudiste echar un ojo al presupuesto que te pasé. Si quieres ajustar algo o tienes dudas, aquí estoy.\n\nLa fecha {{fecha}} sigue disponible pero la tengo solo un par de días más bloqueada antes de liberarla 🙏`,
  },
  {
    category: 'confirmacion',
    label:    'Confirmar reserva tras señal',
    body:     `¡Perfecto {{nombre}}, reserva confirmada! 🎉\n\n• Fecha: {{fecha}}\n• Lugar: {{ciudad}}\n• Invitados: {{invitados}}\n\nLa semana antes del evento te escribo para repasar los últimos detalles. Si surge cualquier cosa antes, aquí me tienes.\n\n¡Estoy deseando que llegue el día!`,
  },
  {
    category: 'seguimiento',
    label:    'Repasar detalles 1 semana antes',
    body:     `¡Hola {{nombre}}! Ya queda nada para {{fecha}} 🎊\n\n¿Podemos repasar 5 minutos los últimos detalles? Necesito confirmar:\n\n• Hora de llegada\n• Punto exacto del lugar\n• Persona de contacto el día del evento\n• Cualquier cambio de última hora\n\n¿Cuándo te viene bien hablar?`,
  },
  {
    category: 'seguimiento',
    label:    'Día después del evento',
    body:     `¡{{nombre}}, qué pasada el evento de ayer! 🥳\n\nGracias por confiar en mí, fue un placer trabajar con vosotros. Cuando puedas, ¿me harías el favor de dejarme una reseña? Para mí es ENORME que la gente sepa cómo trabajamos.\n\nUn abrazo grande para los dos 🙌`,
  },
  {
    category: 'rechazo',
    label:    'Fecha ocupada, sugerir alternativas',
    body:     `¡Hola {{nombre}}! 😔\n\nQué pena, ese día {{fecha}} ya lo tengo cogido con otro evento. ¿Tendríais flexibilidad para cambiar de fecha? Tengo libre semanas alrededor que podrían encajar.\n\nSi no, te entiendo perfectamente — y si conoces a alguien que también esté buscando, te lo agradeceré mucho 🙏`,
  },
  {
    category: 'agradecimiento',
    label:    'Agradecer y pedir reseña',
    body:     `¡Mil gracias {{nombre}}! 🌟\n\nMe ha encantado trabajar con vosotros. Si os apetece, dejarme una reseña en mi perfil de FiestaGo o en Google me ayuda muchísimo:\n\n{{enlace}}\n\n¡Y por supuesto, cualquier evento futuro me tenéis aquí!`,
  },
]
