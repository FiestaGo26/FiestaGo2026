// Los 10 guiones de Reels/Shorts en formato máquina-legible.
// Cada uno se compone de escenas con: texto sobreimpreso (kicker),
// contenido de la escena (subtítulo, iconos, etc.), y duración.
// El audio de voz IA se sincroniza con la suma de duraciones.

export type Scene = {
  kicker:     string     // texto grande, principal, animado
  sub?:       string     // texto secundario más pequeño
  icon?:      string     // emoji o glifo grande decorativo (opcional)
  bgAccent?:  boolean    // si true, fondo con accent color (para hooks o CTAs)
  visual?:    'stats' | 'compare' | 'panel' | 'quote' | 'guarantee' | 'clock' | 'chips'
  duration:   number     // segundos
}

export type Script = {
  slug:       string
  title:      string
  target:     'provider' | 'client'
  voiceover:  string     // texto EXACTO que dirá ElevenLabs (une hook + body + cta)
  scenes:     Scene[]    // motion graphics sincronizados con la voz
  ctaUrl:     string     // URL final destacada al cierre
}

export const SCRIPTS: Script[] = [
  {
    slug: '01-consultas-activas', target: 'provider',
    title: 'Cada lunes hay 40 parejas buscando fotógrafo',
    ctaUrl: 'fiestago.es/registro-proveedor',
    voiceover:
      'Cada lunes hay unas 40 parejas buscando fotógrafo en Valencia. ' +
      '¿Cuántas te han escrito a ti esta semana? ' +
      'Esas consultas se las lleva quien aparece cuando buscan. ' +
      'El que no está dado de alta no existe para esa pareja. ' +
      'Date de alta gratis hoy en fiestago punto es barra registro proveedor.',
    scenes: [
      { kicker: '40 parejas',       sub: 'buscando fotógrafo esta semana', icon: '📅',   duration: 2.5, bgAccent: true },
      { kicker: '¿Cuántas te han escrito a ti?', duration: 2.5 },
      { kicker: 'Se las lleva\nel que aparece', visual: 'stats',           duration: 3.5 },
      { kicker: 'El que no está,\nno existe',    sub: 'sin cuota · sin permanencia', duration: 3 },
      { kicker: 'Date de alta\ngratis hoy',      sub: 'fiestago.es/registro-proveedor', bgAccent: true, duration: 3.5 },
    ],
  },
  {
    slug: '02-cero-comision', target: 'provider',
    title: 'Bodas.net 60€/mes · FiestaGo 0€',
    ctaUrl: 'fiestago.es/registro-proveedor',
    voiceover:
      'Bodas punto net te cobra 60 euros al mes. Vendas o no vendas. ' +
      'En Fiestago pagas cero. Y la comisión no sale de tu bolsillo. ' +
      'La paga el cliente encima como Garantía. Tú cobras el 100% de tu precio, siempre. ' +
      'Hazlo bien: fiestago punto es barra registro proveedor.',
    scenes: [
      { kicker: '60 €/mes',   sub: 'vendas o no vendas',              duration: 2.5 },
      { kicker: '0 €/mes',    sub: 'sin cuota · sin permanencia',     bgAccent: true, duration: 2.5 },
      { kicker: 'La comisión\nla paga el cliente', visual: 'compare', duration: 3 },
      { kicker: 'Tú cobras el 100%\nde tu precio',                    duration: 3 },
      { kicker: 'Hazlo bien',  sub: 'fiestago.es/registro-proveedor', bgAccent: true, duration: 2.5 },
    ],
  },
  {
    slug: '03-presupuestos-ia', target: 'provider',
    title: '10 segundos por presupuesto con IA',
    ctaUrl: 'fiestago.es/registro-proveedor',
    voiceover:
      'Yo tardaba 40 minutos por cada presupuesto. Ahora mira. ' +
      'Pego el mensaje de WhatsApp del cliente, le doy a generar, ' +
      'y en 10 segundos tengo el presupuesto listo con precios, condiciones y link para mandar. ' +
      'Todo esto está incluido gratis en tu panel. ' +
      'Únete en fiestago punto es barra registro proveedor.',
    scenes: [
      { kicker: '40 min',          sub: 'antes',                            duration: 2 },
      { kicker: '10 segundos',     sub: 'ahora, con IA',                    bgAccent: true, duration: 2.5 },
      { kicker: 'Pega el WhatsApp\ndel cliente', visual: 'panel',           duration: 3.5 },
      { kicker: 'Precio, condiciones,\nlink para enviar', visual: 'quote',  duration: 4 },
      { kicker: 'Todo gratis\nen tu panel',                                  duration: 2.5 },
      { kicker: 'fiestago.es',     sub: 'regístrate y empieza hoy',         bgAccent: true, duration: 3 },
    ],
  },
  {
    slug: '04-verifactu', target: 'provider',
    title: 'Facturas Verifactu automáticas',
    ctaUrl: 'fiestago.es/registro-proveedor',
    voiceover:
      'Si eres autónomo, sabes lo que es Verifactu, el QR y la numeración correlativa. ' +
      'En Fiestago tú no haces facturas. Las emite la plataforma en tu nombre, cumpliendo Verifactu, ' +
      'con QR verificable en la Agencia Tributaria. Tú solo cobras y te olvidas. ' +
      'Deja de perder tardes en papeles. Fiestago punto es barra registro proveedor.',
    scenes: [
      { kicker: '¿Autónomo?',  sub: 'Verifactu · QR · Hash · Correlativa', icon: '📄', duration: 3 },
      { kicker: 'Ya no haces\nfacturas',   bgAccent: true,                              duration: 3 },
      { kicker: 'Las emite Fiestago\nen tu nombre', sub: 'Art. 5 RD 1619/2012',        duration: 4 },
      { kicker: 'QR verificable\nen la AEAT',       visual: 'panel',                    duration: 3.5 },
      { kicker: 'Cobras y\nte olvidas',   sub: 'fiestago.es/registro-proveedor',        bgAccent: true, duration: 3 },
    ],
  },
  {
    slug: '05-sello-verificado', target: 'provider',
    title: 'Lo que hace que un cliente pulse reservar',
    ctaUrl: 'fiestago.es/registro-proveedor',
    voiceover:
      'Tu ficha en Instagram parece igual que la de tu competencia. ' +
      '¿Por qué te van a reservar a ti y no a otro? ' +
      'En Fiestago tu ficha lleva sello verificado, reseñas de clientes reales, ' +
      'y garantía de reembolso 110%. Eso es lo que da permiso al cliente para pulsar reservar. ' +
      'Empieza a cerrar más ventas. Fiestago punto es barra registro proveedor.',
    scenes: [
      { kicker: 'Todos parecen\niguales',  duration: 2.5 },
      { kicker: '¿Por qué\na ti?',         icon: '🤔',                     duration: 2 },
      { kicker: 'Sello ✓ · Reseñas ★\nGarantía 110%', visual: 'chips',    bgAccent: true, duration: 4 },
      { kicker: 'La confianza\nvende', sub: 'convertir a "reservar ya"',   duration: 3 },
      { kicker: 'Únete gratis hoy',    sub: 'fiestago.es/registro-proveedor', bgAccent: true, duration: 3 },
    ],
  },

  // ─── CLIENTES ──────────────────────────────────────────────────
  {
    slug: '06-tres-clicks', target: 'client',
    title: '47 llamadas · o 3 clicks',
    ctaUrl: 'fiestago.es',
    voiceover:
      'Organizar una boda son 47 llamadas. O tres clicks. ' +
      'Eliges categoría. Miras el proveedor con sus reseñas y su precio. Reservas y pagas. ' +
      'Fiestago punto es. Sin llamadas, sin sorpresas.',
    scenes: [
      { kicker: '47 llamadas',      sub: 'lo de siempre',           duration: 2.5 },
      { kicker: 'o 3 clicks',        bgAccent: true,                 duration: 2 },
      { kicker: 'Elige · Compara\nReserva', visual: 'panel',        duration: 3.5 },
      { kicker: 'Sin llamadas\nsin sorpresas',                       duration: 3 },
      { kicker: 'fiestago.es',       sub: 'reserva tu evento hoy',   bgAccent: true, duration: 3 },
    ],
  },
  {
    slug: '07-garantia-110', target: 'client',
    title: 'Garantía de Éxito 110%',
    ctaUrl: 'fiestago.es',
    voiceover:
      'Semana antes de tu boda. El fotógrafo te dice que no puede. ¿Qué haces? ' +
      'Si reservaste en Fiestago, nosotros te buscamos un sustituto en menos de 48 horas. ' +
      'Y si no encontramos, te devolvemos el 110% de lo que pagaste. Sin peros. ' +
      'Reserva con red debajo. Solo en fiestago punto es.',
    scenes: [
      { kicker: 'Semana antes\nde tu evento', duration: 2.5 },
      { kicker: 'El proveedor\ncancela',      icon: '😱',            duration: 2.5 },
      { kicker: 'Sustituto en 48h', visual: 'guarantee',              duration: 3.5 },
      { kicker: 'O te devolvemos\nel 110%',   bgAccent: true,          duration: 4 },
      { kicker: 'Reserva con\nred debajo',    sub: 'solo en fiestago.es', duration: 3 },
    ],
  },
  {
    slug: '08-todo-en-un-sitio', target: 'client',
    title: 'Un solo carrito · toda tu boda',
    ctaUrl: 'fiestago.es',
    voiceover:
      'Fotógrafo, catering, música, flores, coche, espacio. ' +
      'Antes eran seis Excel, seis WhatsApps y seis facturas distintas. ' +
      'En Fiestago lo eliges todo en el mismo sitio, con un solo calendario y un solo pago. ' +
      'Todo tu evento, en un mismo lugar. Fiestago punto es.',
    scenes: [
      { kicker: 'Foto · Catering\nMúsica · Flores', visual: 'chips',      duration: 3 },
      { kicker: '6 Excel\n6 WhatsApps',  sub: 'antes',                    duration: 3 },
      { kicker: '1 carrito',              bgAccent: true, sub: 'todo tu evento', duration: 3 },
      { kicker: 'Un solo calendario\nUn solo pago',                        duration: 3.5 },
      { kicker: 'fiestago.es',           sub: 'todo tu evento en un sitio', bgAccent: true, duration: 3 },
    ],
  },
  {
    slug: '09-precios-reales', target: 'client',
    title: 'El precio es el precio',
    ctaUrl: 'fiestago.es',
    voiceover:
      '¿Cuánto es? Depende. Escríbeme por privado y hablamos. Odio esta frase. ' +
      'En Fiestago el precio es el precio. Sin llamadas, sin negociar, sin sorpresas. ' +
      'Cliqueas y ves cuánto vale, todo incluido. Sin llamadas. Fiestago punto es.',
    scenes: [
      { kicker: '"Depende.\nEscríbeme"',   sub: 'la peor frase del sector', duration: 3 },
      { kicker: 'El precio\nes el precio', bgAccent: true,                   duration: 3 },
      { kicker: 'Sin llamadas\nSin negociar',                                duration: 2.5 },
      { kicker: 'Todo incluido',  sub: 'garantía · impuestos · reembolso',   visual: 'chips', duration: 3.5 },
      { kicker: 'fiestago.es',    sub: 'sin llamadas',                       bgAccent: true, duration: 2.5 },
    ],
  },
  {
    slug: '10-wow-planners', target: 'client',
    title: 'Los planners de WOW ya reservan aquí',
    ctaUrl: 'fiestago.es',
    voiceover:
      'Los wedding planners de la comunidad WOW reservan a sus proveedores por Fiestago. ' +
      '¿Por qué? Porque en una tarde cierran el equipo entero de la boda. ' +
      'Un solo sitio. Un solo calendario. Las facturas llegan solas. ' +
      'Reserva tu boda igual de rápido. Fiestago punto es.',
    scenes: [
      { kicker: 'Los planners\nde WOW',   sub: 'ya reservan aquí',    icon: '💍',   duration: 3 },
      { kicker: '¿Por qué?',                                                        duration: 1.5 },
      { kicker: 'Cierran el equipo\nen una tarde',                                  duration: 3 },
      { kicker: 'Un sitio · Un calendario\nLas facturas llegan solas', bgAccent: true, duration: 4 },
      { kicker: 'Reserva igual\nde rápido',  sub: 'fiestago.es',       bgAccent: true, duration: 3 },
    ],
  },
]

export function totalDuration(s: Script): number {
  return s.scenes.reduce((sum, sc) => sum + sc.duration, 0)
}
