// Contenido de los tutoriales del centro de ayuda.
// Cada uno tiene pasos numerados y consejos. Se renderiza en TutorialCard.
// Si algún día se graba un vídeo real con Loom para un slug concreto,
// añade `videoUrl` y la card lo muestra en vez de los pasos.

export type Tutorial = {
  slug:     string
  title:    string
  hint:     string
  panelTab: string       // ?tab= al panel para "hacerlo tras leer"
  category: 'basico' | 'ventas' | 'gestion' | 'marketing'
  steps:    string[]     // 3-6 pasos numerados
  tips?:    string[]     // 1-3 consejos opcionales
  videoUrl?: string      // opcional · si se graba un Loom
}

export const TUTORIALS: Tutorial[] = [
  {
    slug: '01-primer-login', category: 'basico',
    title: 'Tu primer inicio de sesión',
    hint: 'Cómo acceder al panel y qué te encuentras al entrar.',
    panelTab: 'dashboard',
    steps: [
      'Abre https://fiestago.es/proveedor/login',
      'Introduce el email con el que te registraste',
      'Pulsa "Enviar enlace" — recibirás un email con un botón de acceso (sin contraseña)',
      'Abre el email y pulsa "Entrar en el panel"',
      'Al entrar por primera vez ves el Resumen: reservas del mes, cobros y tus 3 herramientas IA',
    ],
    tips: [
      'Añade fiestago.es a remitentes seguros para que el enlace no caiga en spam',
      'El enlace del email caduca a los 60 min · si tarda, pídelo de nuevo',
    ],
  },
  {
    slug: '02-perfil', category: 'basico',
    title: 'Rellenar tu perfil',
    hint: 'Foto, descripción, ciudad y activar videollamada preventa.',
    panelTab: 'profile',
    steps: [
      'En el sidebar pulsa "✏️ Mi perfil"',
      'Sube una foto de portada · usa una foto de tu trabajo (no un logo)',
      'Escribe una descripción de 3-4 líneas · qué haces y qué te diferencia',
      'Rellena teléfono, web e Instagram para que el cliente pueda verificarte',
      'Activa el toggle "Ofrezco videollamada gratuita" si quieres captar leads con más confianza',
      'Pulsa "Guardar cambios"',
    ],
    tips: [
      'La foto se ve en la ficha pública y en el resultado de búsqueda · elige una que hable por sí sola',
      'Una descripción con detalles concretos (años, tipos de eventos, filosofía) convierte más que un texto genérico',
    ],
  },
  {
    slug: '03-servicios', category: 'basico',
    title: 'Crear tu primer servicio',
    hint: 'Nombre, precio, anticipo, fotos y política de cancelación.',
    panelTab: 'services',
    steps: [
      'En el sidebar pulsa "💼 Mis servicios" → "+ Nuevo servicio"',
      'Nombre del servicio (ej. "Reportaje boda completo") y descripción de qué incluye',
      'Precio que TÚ cobras (sin comisión) · el cliente verá ese precio + la Garantía',
      'Anticipo % (0-40) · si es un servicio caro, un 20-30% le da confianza al cliente',
      'Añade 3-6 fotos de trabajos reales',
      'Elige política de cancelación (flexible, moderada, estricta)',
      'Guarda',
    ],
    tips: [
      'Puedes crear varios servicios (paquete básico, premium, extra…) · el cliente elige uno al reservar',
      'Los "extras opcionales" del servicio son buenas herramientas para hacer upsell (álbum, hora extra, etc.)',
    ],
  },
  {
    slug: '04-datos-fiscales', category: 'basico',
    title: 'Configurar datos fiscales',
    hint: 'NIF, régimen y activar facturación delegada Verifactu.',
    panelTab: 'fiscal',
    steps: [
      'En el sidebar pulsa "🧾 Datos fiscales"',
      'Rellena NIF/CIF, nombre fiscal completo y dirección',
      'Elige tu régimen fiscal (autónomo, autónomo por días puntuales, sociedad)',
      'Marca el consentimiento de "facturación delegada" · FiestaGo emitirá las facturas Verifactu en tu nombre',
      'Marca el compromiso de estar dado de alta como autónomo el día del evento',
      'Guarda',
    ],
    tips: [
      'Puedes usar la plataforma sin datos fiscales hasta que tengas tu primera reserva, pero rellénalos ahora para no correr después',
      'FiestaGo cumple RD 1007/2023 (Verifactu) por ti · te ahorras el software de facturación',
    ],
  },

  {
    slug: '05-presupuestos-ia', category: 'ventas',
    title: 'Presupuestos con IA en 10 seg',
    hint: 'Pega el mensaje del cliente y la IA te redacta el presupuesto profesional.',
    panelTab: 'quotes',
    steps: [
      'En el sidebar pulsa "🧾 Presupuestos IA"',
      'Copia el mensaje del cliente de WhatsApp (o transcribe el audio)',
      'Pégalo en el brief · añade fecha, ciudad e invitados si los sabes',
      'Rellena nombre + email + teléfono del cliente para poder mandárselo después',
      'Pulsa "✨ Generar" · en 10 seg tienes el presupuesto listo',
      'Revisa el resultado en la nueva pestaña que se abre',
      'Vuelve al panel · pulsa "💬 WhatsApp" para mandarle el link al cliente directamente',
    ],
    tips: [
      'La IA usa tus servicios reales, tus últimos presupuestos y tus preferencias · cuanto más tengas rellenado, mejor',
      'Configura una vez tus preferencias (regla del 30% anticipo, incluye/no incluye, tono) en la caja de "Ajustes de la IA"',
    ],
  },
  {
    slug: '06-plantillas-whatsapp', category: 'ventas',
    title: 'Plantillas de WhatsApp',
    hint: 'Responder al cliente en 2 clics con mensajes ya escritos.',
    panelTab: 'wa-replies',
    steps: [
      'En el sidebar pulsa "💬 Plantillas WhatsApp" · la primera vez te siembra 9 plantillas por defecto',
      'Elige la plantilla que necesitas (consulta inicial, presupuesto enviado, confirmación, seguimiento, etc.)',
      'Pulsa "📋 Copiar" para pegar en el chat de WhatsApp que ya tengas abierto',
      'O pulsa "💬 Enviar" · abre un modal donde eliges cliente existente (autofill) o metes el teléfono a mano',
      'Se abre WhatsApp con el mensaje ya escrito · solo pulsa enviar',
    ],
    tips: [
      'Edita las plantillas por defecto para adaptarlas a tu tono · rellena {{nombre}}, {{fecha}}, {{ciudad}} etc',
      'Crea plantillas nuevas para tus casos únicos con el botón "+ Nueva plantilla"',
    ],
  },
  {
    slug: '07-cupones', category: 'ventas',
    title: 'Crear y compartir cupones',
    hint: 'Descuentos para clientes concretos o campañas por servicio.',
    panelTab: 'coupons',
    steps: [
      'En el sidebar pulsa "🎟️ Cupones" → "+ Crear cupón"',
      'Nombre del cupón en mayúsculas (ej. AMIGO20)',
      'Elige el % de descuento (1-100)',
      'Opcional: limitar a un servicio concreto, poner máx. de usos o fecha de caducidad',
      'Al crearlo, pulsa "💬 Compartir por WhatsApp" o "🔗 Copiar link con cupón"',
      'El cliente al abrir el link ve el descuento ya aplicado sin teclear nada',
    ],
    tips: [
      'Un cupón "solo para el servicio X" es útil para promocionar un paquete concreto sin abaratar todo tu catálogo',
      'Combina con Instagram Stories · "Los primeros 10 que reserven con el código PROMO tienen -20%"',
    ],
  },
  {
    slug: '08-videollamada', category: 'ventas',
    title: 'Videollamada preventa',
    hint: 'Aceptar solicitud y compartir sala Jitsi con el cliente.',
    panelTab: 'video-calls',
    steps: [
      'Primero activa la opción en Mi perfil (toggle "Ofrezco videollamada gratuita")',
      'Cuando un cliente potencial la pida, aparece en "📹 Videollamadas"',
      'Pulsa "✓ Aceptar y crear sala" · se genera automáticamente un enlace de Jitsi Meet',
      'Pulsa "💬 Enviar por WhatsApp" para mandárselo al cliente acordando la hora',
      'La hora acordada, ambos entráis por el mismo enlace · funciona en cualquier navegador',
      'Después de la llamada, marca "Marcar completada" para llevar el registro',
    ],
    tips: [
      'La primera vez que abras una sala como anfitrión, Jitsi te pedirá loguearte con Google/GitHub · solo una vez',
      'El link no caduca · sirve para futuras videollamadas con el mismo cliente',
    ],
  },

  {
    slug: '09-aceptar-reserva', category: 'gestion',
    title: 'Aceptar una reserva y facturar',
    hint: 'Confirmar → factura Verifactu se emite automáticamente.',
    panelTab: 'bookings',
    steps: [
      'Cuando llega una reserva nueva aparece en "📋 Reservas" con badge coral · también te llega email',
      'Revisa los datos del cliente y del evento',
      'Si te encaja, pulsa "✓ Confirmar reserva" · el cliente recibe email con botón de pago',
      'Cuando el cliente paga (o simulamos en modo test), se emiten automáticamente las 2 facturas Verifactu',
      'Puedes ver las facturas en "📄 Facturas" del sidebar o en el email del cliente',
    ],
    tips: [
      'Confirma rápido (idealmente <24h) · los clientes que esperan mucho suelen contratar a otro',
      'Si no puedes hacer el evento, pulsa "✕ Cancelar" para liberar la fecha en el calendario',
    ],
  },
  {
    slug: '10-cobros', category: 'gestion',
    title: 'Ver tus cobros y facturas',
    hint: 'Cuánto has cobrado por año/mes y descargar las facturas legales.',
    panelTab: 'earnings',
    steps: [
      'En el sidebar pulsa "💶 Cobros"',
      'Ve tus totales del año: cobras tú, cliente pagó, comisión FiestaGo',
      'El gráfico mensual muestra la evolución',
      'Cambia el año con el selector arriba',
      'Descarga toda tu contabilidad en CSV con "⬇ Export CSV"',
      'Para las facturas Verifactu ve al tab "📄 Facturas" · un click y las descargas en PDF',
    ],
    tips: [
      'Tú siempre cobras el 100% de tu precio · la comisión la paga el cliente encima como Garantía',
      'El CSV es válido para pasárselo a tu gestor sin más',
    ],
  },
  {
    slug: '11-mensajes', category: 'gestion',
    title: 'Chat con clientes',
    hint: 'Conversación interna con adjuntos y videollamada integrada.',
    panelTab: 'messages',
    steps: [
      'En "💬 Mensajes" ves las conversaciones abiertas con clientes que ya reservaron',
      'Solo se puede chatear después de que TÚ confirmes la reserva (así no dan la lata sin compromiso)',
      'Pulsa una conversación · caja de mensajes tipo WhatsApp',
      'Puedes adjuntar imágenes, audios o PDFs con el clip 📎',
      'Pulsa "📹 Videollamada" para generar una sala Jitsi en la conversación',
    ],
    tips: [
      'Cada mensaje que envías queda registrado como prueba en caso de disputa · úsalo como canal principal',
      'Responde en <24h · los badges del sidebar te avisan si tienes mensajes sin leer',
    ],
  },
  {
    slug: '12-disponibilidad', category: 'gestion',
    title: 'Calendario y disponibilidad',
    hint: 'Marcar días libres y sincronizar con Google Calendar.',
    panelTab: 'availability',
    steps: [
      'En "📅 Disponibilidad" ves el calendario del mes en curso',
      'Pulsa en un día para bloquearlo (no vas a poder recibir reservas ese día)',
      'Pulsa "◀ ▶" para navegar meses',
      'Para sincronizar con Google Calendar, pulsa "Sincronizar con Google Calendar" y da permisos',
      'A partir de ese momento, los eventos de tu Google Calendar bloquean fechas en FiestaGo automáticamente',
    ],
    tips: [
      'Las reservas confirmadas bloquean su día automáticamente · no tienes que hacerlo tú',
      'La sincronización con Google es bidireccional: FiestaGo también añade tus reservas al calendario',
    ],
  },

  {
    slug: '13-google-business', category: 'marketing',
    title: 'Posts en Google Business con IA',
    hint: 'Generar posts optimizados para tu ficha de Google Maps.',
    panelTab: 'gmb',
    steps: [
      'En "📍 Google Business" pega en el buscador de arriba tu URL de ficha (business.google.com/dashboard/l/...)',
      'Guarda · así el botón "Abrir Google Business" te llevará directo a tu ficha',
      'En el campo "Sobre qué quieres publicar" escribe un tema (ej. "promoción bodas otoño 15% dto")',
      'Pulsa "✨ Generar post" · en 10 seg tienes el post redactado',
      'Pulsa "📋 Copiar y abrir Google Business" · se copia + abre tu ficha',
      'En Google Business pulsa "Añadir novedad" y pega',
    ],
    tips: [
      'Publica 1 post a la semana · Google premia las fichas activas en búsquedas locales',
      'Activa el recordatorio semanal por email para no olvidarte',
    ],
  },
  {
    slug: '14-widget', category: 'marketing',
    title: 'Widget para tu web',
    hint: 'Botón para embed en tu web propia (botón o tarjeta).',
    panelTab: 'embed',
    steps: [
      'En "🔗 Widget para mi web" elige el estilo: 🔘 Botón pequeño o 🪪 Tarjeta con foto',
      'Opcionalmente elige un servicio concreto en el selector',
      'Vista previa muestra cómo quedará',
      'Pulsa "📋 Copiar" · el HTML va al portapapeles',
      'Pégalo en tu web (WordPress: bloque HTML personalizado · Wix/Squarespace: bloque Embed)',
      'O si prefieres compartir por WhatsApp/email/redes, usa los botones "O comparte el link directamente"',
    ],
    tips: [
      'El link con OpenGraph se ve como tarjeta con foto en WhatsApp automáticamente · no hace falta imagen',
      'Añade el botón en la firma de tu email para captar cada respuesta',
    ],
  },
  {
    slug: '15-compartir-servicio', category: 'marketing',
    title: 'Compartir un servicio concreto',
    hint: 'Link directo al servicio + botón WhatsApp para cerrar leads.',
    panelTab: 'services',
    steps: [
      'En "💼 Mis servicios" baja a la tarjeta del servicio que quieras compartir',
      'Al final de cada tarjeta hay 3 botones: "🔗 Copiar link", "💬 Enviar por WhatsApp", "</> Copiar HTML"',
      'El más útil para cerrar leads: "💬 Enviar por WhatsApp"',
      'Se abre WhatsApp con un mensaje ya escrito + link al servicio con el precio ya calculado',
      'El cliente al pulsar aterriza en tu ficha con ese servicio ya seleccionado, solo tiene que meter fecha y pagar',
    ],
    tips: [
      'Guarda como plantilla los links de tus servicios más vendidos · en el chat con un lead pegas y listo',
      'Cada link lleva utm_source=service_share · sabrás cuántas conversiones te trae',
    ],
  },
]
