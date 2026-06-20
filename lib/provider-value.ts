// ───────────────────────────────────────────────────────────────────────
// Fuente única de verdad del PITCH DE VALOR para proveedores.
// Lo consumen: la landing /proveedor/valor, el modal de bienvenida
// del panel, el email post-aprobación y el cerebro WhatsApp del
// cerrador. Si cambia el copy, cambia aquí — en un solo sitio.
// ───────────────────────────────────────────────────────────────────────

export type ValueTool = {
  emoji:        string
  title:        string
  pitch:        string         // 1 frase corta para el sub-título
  details:      string         // párrafo de detalle (markdown ok)
  saveTime:     string         // "30-45 min por presupuesto"
  saveMoney:    string         // "20-40€/mes"
  comparedTo:   string         // "ChatGPT Plus + Proposify"
  panelTab:     string         // id del tab del panel donde vive
  panelLabel:   string         // texto del CTA "ir a..."
}

export type ValueSection = {
  id:    'productividad' | 'web' | 'confianza' | 'gestion'
  emoji: string
  title: string
  tagline: string
  tools: ValueTool[]
}

export const VALUE_SECTIONS: ValueSection[] = [
  {
    id: 'productividad',
    emoji: '⚡',
    title: 'Ahorra-tiempo del día a día',
    tagline: 'Las tres herramientas IA que usarás cada semana',
    tools: [
      {
        emoji: '🧾',
        title: 'Presupuestos profesionales en 10 segundos',
        pitch: 'Pega el mensaje del cliente y la IA te escribe el presupuesto completo.',
        details: 'Le pasas el brief al sistema ("hola, busco fotógrafo para mi boda en septiembre, 80 invitados…") y en 10 segundos tienes el desglose, condiciones y total con tu nombre arriba. Le mandas al cliente un link por WhatsApp — él lo ve bonito en su móvil y puede hasta guardarlo como PDF.',
        saveTime:   '30-45 min por presupuesto',
        saveMoney:  '20-40€/mes',
        comparedTo: 'ChatGPT Plus + herramienta tipo Proposify',
        panelTab:   'quotes',
        panelLabel: '🧾 Presupuestos IA',
      },
      {
        emoji: '💬',
        title: 'Plantillas de WhatsApp para responder en 2 clics',
        pitch: 'Nueve respuestas ya escritas para cada momento del cliente.',
        details: 'Vienen listas para los momentos que se repiten: confirmar disponibilidad, mandar presupuesto, recordar al cliente que no contestó, pedir reseña… Las editas a tu gusto o creas las tuyas con IA. Al responder a un cliente: 2 clics, rellenas nombre y fecha, y WhatsApp abierto con el mensaje listo.',
        saveTime:   '5-10 min por cliente',
        saveMoney:  '15-30€/mes',
        comparedTo: 'apps tipo Respond.io o ManyChat',
        panelTab:   'wa-replies',
        panelLabel: '💬 Plantillas WhatsApp',
      },
      {
        emoji: '📍',
        title: 'Posts para tu Google Business escritos por IA',
        pitch: 'Aparece más alto cuando alguien busca tu servicio en tu ciudad.',
        details: 'Le dices a la IA un tema ("promoción de septiembre", "abrimos los domingos") y te escribe el post optimizado para que Google te muestre primero en búsquedas locales. Lo copias y lo publicas en tu ficha de Google Maps con un clic.',
        saveTime:   '20-30 min por post',
        saveMoney:  '150-400€/mes',
        comparedTo: 'community manager freelance',
        panelTab:   'gmb',
        panelLabel: '📍 Google Business',
      },
    ],
  },
  {
    id: 'web',
    emoji: '🌐',
    title: 'Tu negocio bien presentado online',
    tagline: 'Sin pagar Wix ni contratar a un programador',
    tools: [
      {
        emoji: '🏠',
        title: 'Tu propia ficha pública',
        pitch: 'Mini-web profesional con tus fotos, vídeos, servicios y precios.',
        details: 'Te montas tu perfil en FiestaGo con galería, vídeos, lista de servicios con precios, política de cancelación. Es como tener una web sin pagar suscripción mensual ni saber código.',
        saveTime:   '—',
        saveMoney:  '15-25€/mes',
        comparedTo: 'Wix o Squarespace',
        panelTab:   'profile',
        panelLabel: '✏️ Mi perfil',
      },
      {
        emoji: '🔗',
        title: 'Widget de reservas para pegar en tu web',
        pitch: 'Convierte tu web actual en máquina de captar clientes.',
        details: 'Te damos un cuadrito que pegas en tu web o Instagram. Tus visitas pueden reservarte directamente desde ahí, con pago seguro. Tu web pasa de ser un catálogo a una máquina de cerrar reservas.',
        saveTime:   '—',
        saveMoney:  '10-15€/mes',
        comparedTo: 'Calendly (que ni siquiera cobra pagos)',
        panelTab:   'embed',
        panelLabel: '🔗 Widget para mi web',
      },
      {
        emoji: '📅',
        title: 'Sincronización con Google Calendar',
        pitch: 'Cada reserva confirmada aparece sola en tu calendario.',
        details: 'Conectas tu Google Calendar una vez y cada reserva nueva entra automáticamente. Adiós a apuntarlo a mano y al "uy, me lo había olvidado".',
        saveTime:   'evita errores',
        saveMoney:  'incluido',
        comparedTo: 'Acuity, Calendly Pro',
        panelTab:   'availability',
        panelLabel: '📅 Disponibilidad',
      },
      {
        emoji: '🎟️',
        title: 'Cupones descuento para tus campañas',
        pitch: 'Códigos que sueltas en redes y sabes qué post te trae clientes.',
        details: 'Generas códigos tipo "LUCIA15" y los pones en tu Instagram. Si alguien lo usa, lo ves al instante en tu panel — sabes qué publicación funciona.',
        saveTime:   '—',
        saveMoney:  '20-30€/mes',
        comparedTo: 'Mailchimp + analytics',
        panelTab:   'coupons',
        panelLabel: '🎟️ Cupones',
      },
    ],
  },
  {
    id: 'confianza',
    emoji: '🛡️',
    title: 'Confianza que vale dinero real',
    tagline: 'Más reservas porque el cliente se siente seguro',
    tools: [
      {
        emoji: '⭐',
        title: 'Reseñas verificadas (no falseables)',
        pitch: 'Solo deja reseña quien te ha contratado de verdad.',
        details: 'Las reseñas en Google las puede escribir cualquiera y se inflan. En FiestaGo solo deja reseña quien reservó por la plataforma. El cliente que te ve sabe que esa nota es real → convierte mucho mejor.',
        saveTime:   '—',
        saveMoney:  '—',
        comparedTo: 'Trustpilot Pro (199€/mes)',
        panelTab:   'reviews',
        panelLabel: '⭐ Reseñas',
      },
      {
        emoji: '🏆',
        title: 'Sello de Calidad (cupo limitado a 100 primeros)',
        pitch: 'Distintivo que te coloca arriba en los listados.',
        details: 'Si te apruebas dentro del cupo de los primeros 100 proveedores, llevas el sello visible en tu perfil. Quien lo lleva aparece primero en las búsquedas de su categoría/ciudad.',
        saveTime:   '—',
        saveMoney:  '—',
        comparedTo: 'no se compra, solo se gana',
        panelTab:   'dashboard',
        panelLabel: '📊 Resumen',
      },
      {
        emoji: '🛡️',
        title: 'Garantía de Éxito incluida',
        pitch: 'Si hay un problema el día del evento, FiestaGo cubre.',
        details: 'El cliente paga un 8% extra que financia esta garantía. Tú no pones dinero, tú no asumes el lío. Y si cumples (que es lo normal), no te afecta en nada — solo le da tranquilidad al cliente para reservar contigo.',
        saveTime:   '—',
        saveMoney:  '35-65€/mes',
        comparedTo: 'seguro de responsabilidad civil profesional',
        panelTab:   'dashboard',
        panelLabel: '📊 Resumen',
      },
    ],
  },
  {
    id: 'gestion',
    emoji: '📊',
    title: 'Saber lo que pasa en tu negocio',
    tagline: 'Tu panel con números claros, sin Excel',
    tools: [
      {
        emoji: '📈',
        title: 'Estadísticas claras',
        pitch: 'Cuánta gente te vio, cuántas consultas se cerraron, en qué meses te va mejor.',
        details: 'Sin Google Analytics ni tablas raras: cuántas vistas tiene tu perfil esta semana, cuántas consultas se convirtieron en reserva, qué meses son tus mejores. Filtros por rango.',
        saveTime:   '—',
        saveMoney:  'incluido',
        comparedTo: 'Google Analytics + tiempo de configuración',
        panelTab:   'stats',
        panelLabel: '📈 Estadísticas',
      },
      {
        emoji: '💶',
        title: 'Panel de cobros con 0% de comisión',
        pitch: 'Tú cobras tu precio íntegro. La plataforma no te quita nada.',
        details: 'El cliente paga un 8% extra que financia la Garantía de Éxito. A ti te llega el precio íntegro de tu servicio. Cero comisión para ti, cero sorpresas.',
        saveTime:   '—',
        saveMoney:  'directo a tu cuenta',
        comparedTo: 'plataformas con 10-20% de comisión',
        panelTab:   'earnings',
        panelLabel: '💶 Cobros',
      },
      {
        emoji: '💬',
        title: 'Mensajería con clientes dentro de FiestaGo',
        pitch: 'Las consultas centralizadas en un sitio, no se pierden.',
        details: 'Si cambias de móvil o se te llena el WhatsApp personal, las conversaciones de FiestaGo siguen guardadas en tu panel. Histórico completo de cada cliente.',
        saveTime:   '—',
        saveMoney:  'incluido',
        comparedTo: 'mezclar lo personal con lo profesional',
        panelTab:   'messages',
        panelLabel: '💬 Mensajes',
      },
    ],
  },
]

// Estimación agregada del ahorro mensual equivalente en SaaS sueltos.
// Es un rango orientativo; lo usamos en el pitch sin afinar al céntimo.
export const VALUE_SAVINGS = {
  monthlyMin:    265,
  monthlyMax:    605,
  yearlyMin:   3_180,
  yearlyMax:   7_260,
  hoursPerWeek: '5-10',
}

// Tabla limpia para renderizar en la landing/email.
export const VALUE_SAVINGS_TABLE: Array<{ item: string; range: string }> = [
  { item: 'Web profesional (Wix/Squarespace)',          range: '15-25 €' },
  { item: 'Herramienta de presupuestos IA',             range: '20-40 €' },
  { item: 'Calendly + sync Google Calendar',            range: '10-15 €' },
  { item: 'Community manager para Google Business',     range: '150-400 €' },
  { item: 'Herramienta de plantillas WhatsApp',         range: '15-30 €' },
  { item: 'Sistema de cupones + analytics',             range: '20-30 €' },
  { item: 'Seguro de responsabilidad civil',            range: '35-65 €' },
]

// Frase de cierre — usada en cerebro WhatsApp + landing.
export const VALUE_CLOSING_LINE =
  `Date de alta hoy: te llevas gratis y para siempre un pack de herramientas que si las pagases sueltas te costarían entre ${VALUE_SAVINGS.monthlyMin}€ y ${VALUE_SAVINGS.monthlyMax}€ al mes. Te ahorra de ${VALUE_SAVINGS.hoursPerWeek} horas a la semana. Y de regalo, te llegan clientes nuevos del marketplace — pero aunque no llegara ninguno, ya tienes valor desde el día 1.`
