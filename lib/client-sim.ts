// ───────────────────────────────────────────────────────────────────────
// Simulación de clientes (al estilo MiroFish, pero directo con Claude).
//
// Crea un "enjambre" de personas sintéticas que podrían contratar en
// FiestaGo (parejas, familias de comuniones y cumples, adultos que
// celebran algo), les enseña la web y varios mensajes, y mide cómo
// reaccionan en dos rondas:
//   1. Cada persona reacciona sola a la web, a cada post y al perfil
//      actual de Instagram/TikTok (que hoy habla a proveedores).
//   2. Ve lo que comentaron otras personas y decide de nuevo
//      (influencia social, la parte "enjambre").
// Al final se agregan los números en código y Claude redacta el informe.
//
// Es una simulación: sirve para descartar mensajes y descubrir objeciones,
// no sustituye a los experimentos reales del CEO.
//
// Lo ejecuta netlify/functions/client-sim-background.mts y lo guarda todo
// en la tabla sim_runs.
// ───────────────────────────────────────────────────────────────────────

import { maskPrices, noShowCompensation, stripPrices } from '@/lib/proposals'
import { uniqueReviews } from '@/lib/google-reviews'
import { FIESTAGO_TERMS } from '@/lib/proposal-questions'
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIES } from '@/lib/constants'

const PERSONA_MODEL = process.env.SIM_PERSONA_MODEL || 'claude-sonnet-5-5'
const AGENT_MODEL   = process.env.SIM_AGENT_MODEL   || 'claude-haiku-5-5'
const REPORT_MODEL  = process.env.SIM_REPORT_MODEL  || 'claude-opus-5-5'
const CONCURRENCY   = 16

/** segments: si se indica, solo lo ven esas personas (anuncio segmentado). */
export type Stimulus = { id: string; label: string; text: string; segments?: string[] }

/** Posts que ve cada persona según su segmento. */
function postsFor(cfg: SimConfig, p: Persona) {
  return cfg.posts.filter(s => !s.segments || s.segments.includes(p.segment))
}

export type SimConfig = {
  personas: number
  segments: Array<{ name: string; share: number; brief: string }>
  web: string
  posts: Stimulus[]
  profile: string
  /** Agregados de una simulación anterior con las mismas personas, para comparar. */
  previous?: { label: string; aggregates: unknown }
  /** 'hypothetical_3': catálogo simulado de 3 proveedores por categoría en la zona. */
  catalog?: 'real' | 'hypothetical_3' | 'plan_fase1' | 'closing' | 'full' | 'full_proposal'
  /** Escenario distinto del "scroll en redes": p. ej. el cierre de una venta. */
  scenario?: { intro: string; question: string; round2_intro: string }
  /** Embudo completo: quien entra en la web pasa por el proceso real de cierre. */
  closing?: { intro: string; touchpoints: Stimulus[]; proposal?: boolean }
  /** Simulación de control: los proveedores reales con la ficha completa (hipotético, nunca se publica) */
  hypothetical_complete?: boolean
  /** Recorrido completo: ficha → propuesta → 48 h → detalles finales (simulación 12) */
  journey?: boolean
}

export const ACTIONS = ['ignorar', 'ver_perfil', 'entrar_web', 'hacer_quiz', 'apuntarse', 'reservar'] as const
type Action = typeof ACTIONS[number]
const ACTION_RANK: Record<Action, number> = { ignorar: 0, ver_perfil: 1, entrar_web: 2, hacer_quiz: 3, apuntarse: 4, reservar: 5 }

// ─── Configuración por defecto (datos reales de FiestaGo) ─────────

export function defaultConfig(providers: { total: number; byCategory: Record<string, number>; cities: string[] }): SimConfig {
  const cats = Object.entries(providers.byCategory).map(([c, n]) => `${c} (${n})`).join(', ')
  return {
    personas: 150,
    segments: [
      { name: 'Pareja boda 2027', share: 0.35, brief: 'Pareja que se casa en 2027 en Valencia o alrededores. Mezcla presupuestos ajustados, medios y altos; unas lo organizan solas, otras con mucha implicación de la familia.' },
      { name: 'Familia comunión', share: 0.2, brief: 'Madre o padre que organiza la comunión de su hijo o hija en primavera de 2027 en la zona de Valencia.' },
      { name: 'Familia cumple infantil', share: 0.15, brief: 'Madre o padre que prepara el cumpleaños de un niño o niña de 3 a 10 años y busca animación, tarta, espacio o catering.' },
      { name: 'Adulto cumple especial', share: 0.15, brief: 'Persona adulta que organiza su cumpleaños de 30, 40 o 50, o el de su pareja, con amigos: música, catering, fotógrafo.' },
      { name: 'Escéptico', share: 0.15, brief: 'Persona que ya usa Bodas.net, Google o recomendaciones de conocidos y desconfía de webs nuevas; cualquier tipo de evento.' },
    ],
    web: `fiestago.es, portada:
- Titular: "Tu celebración, sin sustos." Buscador por servicio y ciudad. Enlaces a "Garantía de Éxito", "Quiénes somos", "Quiz de 2 minutos" y "Soy profesional". FiestaGo está abierto a celebraciones en toda España.
- Sección "Ya están aquí": ${providers.total} proveedores publicados (${cats}). ${providers.cities.join(', ')}.
- Cómo funciona: 1) Qué celebras: boda, cumpleaños, comunión o cena de empresa, con fecha y ciudad te enseñamos quién está libre. 2) Precios a la vista: cada servicio tiene precio cerrado, sin pedir diez presupuestos. 3) Tu lista corta: guarda favoritos y compártelos con tu pareja o familia. 4) Reservas cuando lo tengas claro, pagando de forma segura dentro de FiestaGo; si tienes dudas antes, escríbenos. 5) El dinero espera: tu pago queda retenido en Stripe hasta que termina el evento. 6) Si tu proveedor cancela, te buscamos sustituto en 48 h; si no lo hay, respondemos con nuestro dinero.
- Página "Quiénes somos": foto de Mariano González Tejedo, el fundador, con un texto en primera persona ("si tienes cualquier duda antes de reservar, escríbeme"). WhatsApp visible: contesta una persona de lunes a viernes de 10:00 a 20:00 y, fuera de ese horario, un asistente automático; también email. Datos del titular: Francisco Mariano González Tejedo, NIF 09437664M, C/ Turina 6, Oviedo. Proveedores verificados (DNI/CIF y seguro de responsabilidad civil).
- Página de garantía: "Todos los servicios llevan la Garantía de Éxito incluida en el precio que ves; no hay suplementos. Ejemplo: reservas un fotógrafo por 1.080 €; tu pago queda retenido en Stripe, una entidad de pagos regulada, y el fotógrafo no cobra hasta que termina tu evento. Si todo va bien, no pagas nada más. Si cancela, te buscamos otro que cumpla las mismas funciones a un precio similar en 48 h; si no lo hay, te devolvemos 1.188 € (110 %). Si no se presenta, 1.080 € + 500 € de compensación = 1.580 €." También explica qué no cubre (lluvia, cambios pedidos por el cliente…) y que los reembolsos tardan como máximo 5 días hábiles.
- Packs con todo dentro: un precio, un pago y una persona que lo coordina.
- Quiz de 2 minutos para orientar qué necesitas. Lista de espera para avisarte.
- Marca nueva: aún no tiene reseñas de clientes publicadas.`,
    // Posts para clientes según lo aprendido en la 2.ª simulación.
    // 'fundador', 'pregunta_antes' y 'verificacion' se repiten para comparar.
    posts: [
      { id: 'garantia_boda', label: 'Garantía con números (boda)', text: 'Carrusel: "Tu boda, con garantía incluida". 1) Reservas fotógrafo por 1.080 €: es el precio final, con la garantía incluida. 2) Tu pago queda retenido en Stripe hasta que acaba tu boda. 3) Si cancela: te buscamos otro en 48 h. 4) Si no hay: te devolvemos 1.188 €. 5) Si no se presenta: 1.580 €. "Si todo va bien, no pagas nada más. Enlace en la bio."' },
      { id: 'garantia_cumple', label: 'Garantía con números (cumple infantil)', text: 'Carrusel: "El cumple de tu peque, sin sustos". 1) Reservas animador por 250 €, garantía incluida. 2) El dinero espera en Stripe hasta que acaba la fiesta. 3) ¿El animador cancela? Te buscamos otro en 48 h o te devolvemos 275 €. 4) ¿No aparece? Te devolvemos 250 € y 300 € más de compensación. 5) Animadores verificados con seguro de responsabilidad civil. "Enlace en la bio."' },
      { id: 'fundador', label: 'Quién hay detrás', text: 'Imagen: foto real de Mariano, sonriente, con americana.\nTexto: "Soy Mariano y estoy detrás de FiestaGo. Lo creé porque organizar una celebración no debería ser pagar por adelantado a alguien que no conoces y cruzar los dedos. Si tienes dudas antes de reservar, escríbeme por WhatsApp: entre semana te contesto yo y el fin de semana te atiende nuestro asistente. Enlace en la bio."' },
      { id: 'pregunta_antes', label: 'Habla con una persona antes de pagar', text: 'Imagen: captura de un chat de WhatsApp con una consulta tipo "¿el DJ incluye equipo de sonido?" y la respuesta.\nTexto: "¿Dudas antes de reservar? Pregúntanos por WhatsApp: qué incluye un servicio, disponibilidad para tu fecha o cómo funciona la garantía. Entre semana te responde una persona; el fin de semana, nuestro asistente, y el lunes lo retomamos. Reservas solo cuando lo tengas claro. Enlace en la bio."' },
      { id: 'verificacion', label: 'Cómo verificamos a los proveedores', text: 'Reel corto: "Antes de que un proveedor aparezca en FiestaGo, comprobamos su DNI o CIF y su seguro de responsabilidad civil. Si no lo tiene, no entra." Se ve una lista de comprobación marcándose. "Tu celebración, en manos de profesionales de verdad. Enlace en la bio."' },
      { id: 'dinero_stripe', label: '¿Dónde está tu dinero?', text: 'Post de pregunta frecuente: "¿Dónde está tu dinero hasta el día del evento? En Stripe, una entidad de pagos regulada. No llega al proveedor hasta que termina tu celebración. Y si algo falla, la garantía va incluida en todos los servicios. Enlace en la bio."' },
      { id: 'proveedor_real', label: 'Proveedor presentado con su trabajo', text: 'Carrusel: "Te presentamos a Lucía, fotógrafa de bodas en tu zona". Fotos de 4 bodas que ha hecho, qué incluye su paquete y su precio total con garantía incluida (1.250 €). "Verificada por FiestaGo. Consulta su disponibilidad: enlace en la bio."' },
    ],
    profile: `Cuenta de Instagram y TikTok de FiestaGo para clientes (renovada: ya no hay posts para proveedores, que tienen su propia cuenta). Bio: "Bodas, comuniones y cumpleaños sin sustos ✨ Proveedores verificados · Pago retenido hasta tu evento · Pregúntanos por WhatsApp 👇 fiestago.es". Destacados: "Quiénes somos" (Mariano con su foto), "Garantía" (ejemplos con números), "Tu dinero" (Stripe), "Cómo reservar", "WhatsApp". Los posts del perfil son los que acabas de ver, más otros proveedores presentados con su nombre, trabajos y precio, de bodas, comuniones y cumpleaños infantiles y de adultos. Cuenta nueva: pocos seguidores y aún pocos comentarios, aunque responden rápido a los que hay.`,
  }
}

// ─── Plan de confianza (simulación 4) ─────────────────────────────
// La web y las redes tal y como quedarían tras aplicar el plan de confianza
// (fase 0 y fase 1): primer paso sin riesgo, señal y cancelación gratis,
// persona también el sábado, navegación por evento con packs, catálogo
// local real y primeras reseñas reales de eventos fundadores. Es hipotético:
// sirve para comprobar el plan antes de construirlo entero.

const SEG = { boda: 'Pareja boda 2027', comunion: 'Familia comunión', infantil: 'Familia cumple infantil', adulto: 'Adulto cumple especial' }

export function planConfig(): Omit<SimConfig, 'personas' | 'segments'> {
  return {
    web: `fiestago.es (versión con el plan de confianza aplicado):
- Portada: "Tu celebración, sin sustos." Cuatro entradas grandes: Cumple infantil, Comunión, Boda y Cumple adulto. Cada una abre una página con packs de ejemplo con PRECIO TOTAL, por ejemplo: "Cumple para 20 niños: animador 2 h + merienda + sala, 420 € todo incluido"; "Comunión para 30 personas en restaurante: menú, tarta y fotógrafo 2 h, 1.890 € todo incluido"; "Cumple de 40 para 40 personas: catering + DJ 4 h, 1.640 € todo incluido". Todo con la Garantía de Éxito incluida.
- Catálogo por zona, con nombres, pueblo, fotos de trabajos, precio y disponibilidad por fecha sin registrarse. Ejemplo en Valencia y l'Horta: 7 fotógrafos, 4 caterings (uno con menú halal y sin cerdo), 3 restaurantes y 2 salones para comuniones, 5 animadores infantiles, 2 ludotecas con merienda, 4 DJ, 2 fincas para bodas, 3 pastelerías. En comarcas (Safor, Ribera, Camp de Morvedre, Requena-Utiel) hay menos y se dice con claridad; si tu pueblo no está, un aviso: "aún no estamos en tu pueblo, déjanos tu correo y te avisamos".
- Reseñas: 11 reseñas reales con nombre, foto y fecha de los primeros "eventos fundadores" (6 cumples infantiles, 3 comuniones, 2 cumples de adulto; aún ninguna boda). Cada ficha de proveedor muestra además su nota y enlace a sus reseñas de Google (por ejemplo 4,8 con 63 opiniones).
- Primer paso sin riesgo: botón "Pide presupuesto o bloquea tu fecha 48 h gratis", sin pagar nada. Para reservar: señal del 10-20 % del total y el resto 2 meses antes del evento; precio calculado al momento según el número de invitados; botón "Te llamamos"; cancelación gratis durante 14 días tras reservar si faltan más de 60 días para el evento.
- El dinero: "Tu pago lo guarda Stripe, la plataforma de pagos que usan muchas tiendas online, y no llega al proveedor hasta que termina tu evento."
- Garantía en una sola página con tres casos claros: si el proveedor cancela (sustituto que cumpla las mismas funciones a precio similar en 48 h o te devolvemos el 110 %), si no se presenta (te devolvemos lo pagado más una compensación según el importe, con tabla: 300 € hasta 500 €, 500 € de 500 a 2.000 €, 1.000 € de 2.000 a 5.000 €, 2.000 € de 5.000 a 15.000 €, 3.000 € por encima; el 110 % se explica como "todo lo pagado y un 10 % más por las molestias"), si cancelas tú (gratis los primeros 14 días; después, la política de cada servicio, que se ve en su ficha). Reembolsos en máximo 5 días hábiles. Qué no cubre: lluvia, cambios pedidos por el cliente. Incluida en todos los servicios.
- Atención: WhatsApp atendido por una persona de lunes a viernes de 10:00 a 20:00 y sábados de 10:00 a 14:00, "te respondemos en menos de 2 horas en horario de atención", y opción de pedir una llamada de 10 minutos. Email.
- "Quiénes somos": foto de Mariano González Tejedo, el fundador, texto en primera persona; datos del titular (Francisco Mariano González Tejedo, NIF 09437664M, C/ Turina 6, Oviedo). FiestaGo atiende celebraciones en toda España. Proveedores verificados (DNI/CIF y seguro de responsabilidad civil).`,
    posts: [
      { id: 'dinero_faq', label: 'FAQ: ¿dónde está tu dinero?', text: 'Carrusel de preguntas frecuentes: "¿Dónde está tu dinero hasta el día del evento? Lo guarda Stripe, la plataforma de pagos que usan muchas tiendas online. El proveedor no lo cobra hasta que termina tu celebración. ¿Y si cancelas tú? Los primeros 14 días, gratis. ¿Y si falla el proveedor? Te buscamos otro en 48 h o te devolvemos el 110 %." "Enlace en la bio."' },
      { id: 'primer_paso', label: 'Bloquea tu fecha gratis', text: 'Imagen: calendario con una fecha rodeada.\nTexto: "¿Has visto al proveedor perfecto pero aún no te decides? Bloquea tu fecha 48 h gratis o pide presupuesto sin pagar nada. Y si reservas, empiezas con una señal de solo el 10-20 %. Pregúntanos lo que quieras por WhatsApp: te contesta una persona, también los sábados por la mañana. Enlace en la bio."' },
      { id: 'resena_cumple', label: 'Reseña real: cumple infantil', segments: [SEG.infantil, SEG.adulto], text: 'Carrusel con fotos de la fiesta: "El cumple de Martina (6 años), en Paterna. Animador 2 h + merienda + ludoteca para 18 niños, 410 €. Lo que dice su madre, Rocío: \'Reservé con señal, me contestaron un sábado y el animador llegó media hora antes. Repetiremos.\'" "Uno de nuestros primeros eventos. Enlace en la bio."' },
      { id: 'pack_cumple', label: 'Pack cumple infantil con precio total', segments: [SEG.infantil], text: 'Imagen: mesa de merienda infantil y un animador.\nTexto: "Cumple para 20 niños en Valencia y alrededores: animador 2 h + merienda + sala, 420 € todo incluido. Garantía de Éxito incluida: si el animador cancela, te buscamos otro en 48 h o te devolvemos el 110 %. Bloquea tu fecha gratis 48 h. Enlace en la bio."' },
      { id: 'pack_comunion', label: 'Pack comunión con precio total', segments: [SEG.comunion], text: 'Carrusel: "Comunión para 30 personas en un restaurante de l\'Horta: menú, tarta y fotógrafo 2 h, 1.890 € todo incluido. 3 restaurantes y 2 salones para elegir, con su menú y fotos. Reseña de una familia de Mislata: \'Todo cerrado en una tarde y sin sorpresas.\' Pide presupuesto sin compromiso: enlace en la bio."' },
      { id: 'garantia_boda', label: 'Garantía con números (boda)', segments: [SEG.boda], text: 'Carrusel: "Tu boda, con garantía incluida". 1) Reservas fotógrafo por 1.250 €, precio final con todo incluido. 2) Pagas una señal y el resto 2 meses antes; el dinero espera en Stripe. 3) Si cancela: te buscamos otro en 48 h. 4) Si no hay: te devolvemos el 110 %. 5) Si no se presenta: lo pagado y 500 € más. "Si todo va bien, no pagas nada más. Enlace en la bio."' },
      { id: 'proveedor_zona', label: 'Proveedor de tu zona con su trabajo', text: 'Carrusel: "Te presentamos a Pau, DJ en la Safor". Fotos y un vídeo corto de sesiones reales, qué incluye (equipo, 4 h, desplazamiento en la comarca) y precio total con garantía incluida (690 €). Nota en Google: 4,9 (41 opiniones). "Verificado por FiestaGo. Consulta su disponibilidad: enlace en la bio."' },
      { id: 'mariano_responde', label: 'Una persona responde', text: 'Vídeo corto: Mariano a cámara: "Soy Mariano, de FiestaGo. Cada semana nos preguntáis lo mismo: ¿quién guarda el dinero?, ¿y si llueve?, ¿y si cancelo yo? Os lo contesto en 30 segundos." Responde las tres. "Escríbenos por WhatsApp: entre semana y los sábados por la mañana te contesta una persona. Enlace en la bio."' },
    ],
    profile: `Cuenta de Instagram y TikTok de FiestaGo para clientes. Bio: "Bodas, comuniones y cumpleaños sin sustos ✨ Proveedores verificados · Tu dinero espera en Stripe · Bloquea tu fecha gratis 👇 fiestago.es". Destacados: "Opiniones" (11 reseñas reales de los primeros eventos, con fotos), "Cumples", "Comuniones", "Bodas", "Tu dinero", "Quiénes somos". Contenido equilibrado entre cumples infantiles, comuniones, bodas y cumples de adulto, con fotos de eventos reales. Cuenta joven (unos cientos de seguidores), pero con comentarios de clientes reales y respuestas firmadas ("Te contesta Mariano").`,
  }
}

// ─── Cierre de ventas (simulación 6 en adelante) ──────────────────
// Ya no es el primer contacto: la persona pidió presupuesto o llamada en la
// ficha de un proveedor, el proveedor respondió por FiestaGo y FiestaGo la
// llamó. Ahora decide si paga la señal y reserva. Objetivo: ≥ 50 % reserva.
// Es la web REAL actual (sin reseñas todavía); cambiarla aquí al mejorarla.

export function closingConfig(): Omit<SimConfig, 'personas' | 'segments'> {
  return {
    scenario: {
      intro: 'Hace unos días encontraste FiestaGo buscando proveedores para tu evento, entraste en la ficha de un proveedor y pediste presupuesto (o que te llamaran). Esto es lo que ha pasado desde entonces:',
      question: 'Ahora tienes que decidir. Para cada cosa de las que te han llegado (respuesta del proveedor, llamada, email…): cuánto te ha llamado la atención (1-5), cuánta confianza te da (1-5), qué harías ahora de verdad, qué pensarías o comentarías y tu principal objeción. "reservar" significa pagar ya la señal en FiestaGo; "apuntarse" significa bloquear la fecha 48 h gratis o pedir más información sin pagar; "entrar_web" es volver a mirar la ficha; "ignorar" es dejarlo o buscar por otro lado. Para la web: confianza y claridad (1-5), qué harías, lo que más te gusta, lo que echas en falta y tu objeción. Para el perfil: si entiendes que es para clientes como tú y si te da más o menos confianza.',
      round2_intro: 'Ayer recibiste la respuesta del proveedor y la llamada de FiestaGo.',
    },
    web: `Lo que ves en fiestago.es (web real actual):
- Ficha del proveedor: fotos de trabajos, qué incluye, precio a la vista que se recalcula al poner tu número de invitados (precio final con la Garantía de Éxito incluida), calendario de disponibilidad.
- Botones: "Enviar solicitud de reserva" (pagas una señal del 10-20 % del total con tarjeta y el resto 2 meses antes del evento; si faltan menos de 2 meses, pagas todo al reservar), "Bloquear esta fecha 48 h gratis" (sin tarjeta ni DNI), "Pedir presupuesto gratis" y "Prefiero que me llaméis desde FiestaGo".
- Tu pago queda retenido en Stripe, una entidad de pagos regulada, y el proveedor no cobra hasta que termina tu evento.
- Garantía de Éxito incluida en todos los servicios: si el proveedor cancela, sustituto que cumpla las mismas funciones a precio similar en 48 h o te devuelven todo y un 10 % más; si no se presenta, te devuelven lo pagado más una compensación según el importe (300 € hasta 500 €, 500 € de 500 a 2.000 €, 1.000 € de 2.000 a 5.000 €…). No cubre la lluvia ni los cambios que pidas tú. Reembolsos en máximo 5 días hábiles.
- Si cancelas tú: la política de cancelación del servicio, que se ve en la ficha (por ejemplo "Moderada: reembolso completo hasta 14 días antes; 50 % entre 14 y 7 días; nada después").
- "Quiénes somos": foto de Mariano González Tejedo, el fundador; NIF y dirección del titular (Oviedo); WhatsApp atendido por una persona de lunes a viernes de 10:00 a 20:00 y sábados de 10:00 a 14:00.
- Proveedores verificados (DNI/CIF y seguro de responsabilidad civil).
- Marca nueva: todavía no hay reseñas de clientes publicadas.`,
    posts: [
      { id: 'respuesta_boda', label: 'Respuesta del proveedor (boda)', segments: ['Pareja boda 2027'], text: 'Email de FiestaGo: "Laura Ferrer Fotografía te ha respondido: \'¡Hola! Tengo libre vuestra fecha. Para 120 invitados el reportaje completo (preparativos, ceremonia, banquete y fiesta hasta las 01:00, 2 fotógrafos, 600 fotos editadas en galería online en 6 semanas) son 1.890 € con la Garantía de Éxito incluida. Os puedo enseñar dos bodas completas que hice este verano.\' Si os encaja, bloquead la fecha 48 h gratis o reservad con una señal desde su ficha."' },
      { id: 'respuesta_comunion', label: 'Respuesta del proveedor (comunión)', segments: ['Familia comunión'], text: 'Email de FiestaGo: "Restaurante La Alquería te ha respondido: \'Tenemos libre el sábado que pedís. Menú de comunión para 45 adultos y 12 niños: 2.430 € todo incluido (entrantes, principal, postre, tarta, bebida, sala privada de 13:30 a 18:30). Podemos adaptar menús sin gluten y sin cerdo.\' Si os encaja, bloquead la fecha 48 h gratis o reservad con una señal desde su ficha."' },
      { id: 'respuesta_infantil', label: 'Respuesta del proveedor (cumple infantil)', segments: ['Familia cumple infantil'], text: 'Email de FiestaGo: "Fiestas Pompitas te ha respondido: \'¡Hola! Ese sábado lo tengo libre. Animación de 2 horas para 18 niños con juegos, pintacaras y globoflexia, con desplazamiento a vuestra zona: 245 € con la Garantía de Éxito incluida. Tengo seguro de responsabilidad civil y llevo 8 años con cumples.\' Si os encaja, bloquead la fecha 48 h gratis o reservad con una señal desde su ficha."' },
      { id: 'respuesta_adulto', label: 'Respuesta del proveedor (cumple adulto)', segments: ['Adulto cumple especial'], text: 'Email de FiestaGo: "DJ Marc Events te ha respondido: \'Tengo la fecha libre. Sesión de 4 horas con equipo de sonido e iluminación para 60 personas, música de los 90 y actual a vuestro gusto: 690 € con la Garantía de Éxito incluida. Os mando una sesión grabada para que la escuchéis.\' Si os encaja, bloquead la fecha 48 h gratis o reservad con una señal desde su ficha."' },
      { id: 'respuesta_general', label: 'Respuesta del proveedor (otro evento)', segments: ['Escéptico'], text: 'Email de FiestaGo: "El proveedor que elegiste te ha respondido con disponibilidad para tu fecha, el precio total para tu número de invitados con la Garantía de Éxito incluida, qué incluye exactamente y fotos de dos eventos parecidos al tuyo. Si te encaja, bloquea la fecha 48 h gratis o reserva con una señal desde su ficha."' },
      { id: 'llamada_fiestago', label: 'Llamada de FiestaGo', text: 'Te llamó Mariano, de FiestaGo, en la franja que pediste (8 minutos): te preguntó por tu evento, te explicó que pagas solo una señal del 10-20 % y que el dinero queda retenido en Stripe hasta después del evento, qué cubre la garantía y qué no, y te resolvió una duda concreta preguntándosela al proveedor. Al colgar te mandó por WhatsApp el enlace de la ficha para bloquear la fecha o reservar. No te presionó.' },
      { id: 'recordatorio', label: 'Recordatorio a las 24 h', text: 'WhatsApp de FiestaGo al día siguiente: "Hola, soy Mariano de FiestaGo. ¿Pudiste ver la propuesta? Si quieres, te bloqueo la fecha 48 h sin pagar nada mientras lo hablas en casa. Cualquier duda, por aquí."' },
    ],
    profile: 'Cuenta de clientes de FiestaGo en Instagram y TikTok: pocos seguidores todavía, posts sobre cómo funciona la garantía, dónde está el dinero (Stripe) y vídeos de Mariano respondiendo dudas. Sin reseñas de clientes todavía.',
  }
}

// ─── Embudo completo (simulación 6 en adelante) ───────────────────
// 1) Descubrimiento: posts para clientes (lo real de hoy), web y perfil.
// 2) Opiniones de otros. 3) Cierre: quien entra en la web o hace algo más
// pide presupuesto/llamada y recibe la respuesta del proveedor, la llamada
// de FiestaGo y el recordatorio; decide si paga la señal. 4) Entrevista.
// Objetivo: que reserve ≥ 50 % de quienes llegan al cierre.

export function fullConfig(): Omit<SimConfig, 'personas' | 'segments'> {
  const c = closingConfig()
  return {
    web: c.web,
    profile: c.profile,
    posts: [
      { id: 'dinero_faq', label: 'FAQ: ¿dónde está tu dinero?', text: 'Carrusel: "¿Dónde está tu dinero hasta el día del evento? En Stripe, una entidad de pagos regulada: el proveedor no cobra hasta que termina tu celebración. Reservas con una señal de solo el 10-20 %. ¿Y si el proveedor falla? Te buscamos otro en 48 h o te devolvemos todo y un 10 % más." "Enlace en la bio."' },
      { id: 'mariano_responde', label: 'Una persona responde', text: 'Vídeo corto: Mariano a cámara: "Soy Mariano, de FiestaGo. ¿Quién guarda tu dinero? ¿Y si llueve? ¿Y si cancelas tú? Te lo contesto en 30 segundos." Responde las tres. "¿Prefieres hablarlo? Pide que te llamemos desde la ficha y te llamo yo. Enlace en la bio."' },
      { id: 'primer_paso', label: 'Primer paso sin pagar', text: 'Imagen: calendario con una fecha rodeada.\nTexto: "¿Has visto al proveedor perfecto pero aún no te decides? Bloquea tu fecha 48 h gratis, pide presupuesto o que te llamemos, sin pagar ni dar la tarjeta. Y cuando lo tengas claro, reservas con una señal del 10-20 %. Enlace en la bio."' },
      { id: 'precio_invitados', label: 'Precio final según invitados', text: 'Vídeo de pantalla: en la ficha de un animador se escribe "18 niños" y el precio cambia al momento: "245 € todo incluido". Texto: "Sin pedir diez presupuestos: pon cuántos sois y ves el precio final, con la garantía incluida. Cumpleaños, comuniones y fiestas. Enlace en la bio."' },
      { id: 'garantia_cumple', label: 'Garantía con números (cumple infantil)', segments: ['Familia cumple infantil', 'Adulto cumple especial'], text: 'Carrusel: "El cumple, sin sustos". 1) Reservas animador por 250 €, garantía incluida. 2) Pagas solo la señal; el resto espera en Stripe. 3) ¿Cancela? Te buscamos otro en 48 h o te devolvemos 275 €. 4) ¿No aparece? Te devolvemos lo pagado y 300 € más. "Enlace en la bio."' },
      { id: 'garantia_comunion', label: 'Garantía con números (comunión)', segments: ['Familia comunión', 'Pareja boda 2027'], text: 'Carrusel: "Tu celebración, con garantía incluida". 1) Reservas el restaurante por 2.430 € para 57 invitados, todo incluido. 2) Pagas solo la señal; el resto, 2 meses antes, y el restaurante no cobra hasta el evento. 3) Si cancela: otro equivalente en 48 h o te devolvemos todo y un 10 % más. 4) Si no cumple el día: lo pagado y 1.000 € de compensación. "Enlace en la bio."' },
    ],
    closing: {
      intro: 'Como te interesó, entraste en la ficha de un proveedor de tu zona para tu evento y pediste presupuesto (o que te llamaran). Esto es lo que ha pasado desde entonces:',
      touchpoints: c.posts,
    },
  }
}

// ─── Embudo completo con propuesta escrita (simulación 7 en adelante) ──
// Lo construido tras la 6.ª: cada cliente recibe una propuesta escrita de un
// proveedor REAL de FiestaGo de su tipo de evento (con sus opiniones de
// Google reales), con precio cerrado para SU número de invitados, qué
// incluye, la señal en euros y las condiciones, en una página que puede
// compartir. Quien bloquea la fecha decide otra vez 48 h después, tras
// hablarlo en casa y recibir el seguimiento de ayuda (sin presión).

export function proposalConfig(): Omit<SimConfig, 'personas' | 'segments'> {
  const f = fullConfig()
  const c = closingConfig()
  const call = c.posts.find(x => x.id === 'llamada_fiestago')!
  return {
    ...f,
    web: c.web
      .replace('- Si cancelas tú:', '- Reserva sin riesgo: en los 7 días siguientes a pagar la señal puedes cancelar y te devuelven la señal entera (eventos a 30 días o más). Después, si cancelas tú:')
      .replace('- Marca nueva: todavía no hay reseñas de clientes publicadas.', '- Marca nueva: todavía no hay reseñas de clientes de FiestaGo, pero cada ficha muestra la nota y las opiniones de Google del proveedor, que puedes comprobar buscándolo en Google Maps.')
      .replace('"Prefiero que me llaméis desde FiestaGo".', '"Prefiero que me llaméis desde FiestaGo". Si pides presupuesto o bloqueas la fecha, el proveedor te manda su propuesta por escrito: una página con el precio cerrado para tu caso, qué incluye, la señal en euros, las condiciones y un botón para compartirla con quien decide contigo y otro para reservar.'),
    closing: {
      intro: 'Como te interesó, entraste en la ficha de un proveedor de tu zona y le pediste presupuesto (o bloqueaste la fecha 48 h gratis) para UNO de los servicios de tu celebración. En FiestaGo cada servicio es un proveedor independiente: esta propuesta es solo de ese servicio y el resto (local, comida, música…) lo contratas aparte, en FiestaGo o donde quieras. Valora esta propuesta por lo que es. Esto es lo que ha pasado desde entonces:',
      proposal: true,
      touchpoints: [
        { id: 'propuesta_escrita', label: 'Propuesta escrita del proveedor', text: '(se genera para cada persona)' },
        call,
        { id: 'seguimiento_ayuda', label: 'Llamada de seguimiento (a las 20 h)', text: 'Al día siguiente te vuelve a llamar Mariano, de FiestaGo (5 minutos), para ver si te queda alguna duda: repasa contigo las respuestas por escrito que ya tienes en la propuesta, te aclara lo de la garantía, los pagos o la cancelación si lo necesitas, y si quedaba algo del servicio sin contestar, te dice que se lo pide al proveedor ahora mismo. No te pide que reserves ni te mete prisa.' },
      ],
    },
  }
}

// Simulación 12: todas las personas tienen una celebración en mente
export const CELEBRATION_SEGMENTS: SimConfig['segments'] = [
  { name: 'Pareja boda 2027', share: 0.22, brief: 'Pareja que se casa en 2027 en Valencia o alrededores y está buscando proveedores. Presupuestos ajustados, medios y altos; unas lo organizan solas, otras con mucha implicación de la familia.' },
  { name: 'Familia comunión', share: 0.15, brief: 'Madre o padre que organiza la comunión de su hijo o hija en primavera de 2027 en la zona de Valencia.' },
  { name: 'Familia cumple infantil', share: 0.15, brief: 'Madre o padre que prepara el cumpleaños de un niño o niña de 3 a 10 años en los próximos meses.' },
  { name: 'Adulto cumple o fiesta sorpresa', share: 0.15, brief: 'Persona adulta que organiza un cumpleaños redondo, un aniversario o una fiesta sorpresa para alguien querido, con amigos o familia.' },
  { name: 'Despedida de soltero/a', share: 0.1, brief: 'Amigo o amiga que organiza la despedida de soltero o soltera de alguien de su grupo, con presupuesto compartido entre varios.' },
  { name: 'Fiesta de empresa', share: 0.1, brief: 'Persona de una pyme o empresa que organiza la cena de Navidad, un aniversario de la empresa o un evento con el equipo o clientes.' },
  { name: 'Escéptico', share: 0.13, brief: 'Persona que tiene una celebración en mente (cualquier tipo) pero suele usar Bodas.net, Google o recomendaciones de conocidos y desconfía de webs nuevas.' },
]

const SEGMENT_CATEGORIES: Record<string, string[]> = {
  'Adulto cumple o fiesta sorpresa': ['musica', 'catering', 'pastel', 'animacion', 'foto'],
  'Despedida de soltero/a': ['animacion', 'musica', 'catering', 'belleza'],
  'Fiesta de empresa': ['catering', 'musica', 'foto', 'planner'],
  'Pareja boda 2027': ['foto', 'musica', 'planner', 'flores', 'belleza'],
  'Familia comunión': ['catering', 'pastel', 'animacion', 'foto'],
  'Familia cumple infantil': ['animacion', 'pastel'],
  'Adulto cumple especial': ['musica', 'catering', 'pastel'],
}

type RealProvider = {
  id: string; name: string; category: string; city: string | null; description: string | null
  hypothetical?: boolean
  google_rating: number | null; google_rating_count: number | null
  google_reviews: Array<{ text: string; stars: number }> | null
  services: Array<{ name: string; price: number | null; pricing_unit: string | null; included_guests: number | null; extra_guest_price: number | null; included_hours: number | null; extra_hour_price: number | null; description: string | null; cancellation_policy: string | null }>
  photos: number
}

async function loadRealProviders(supabase: SupabaseClient): Promise<RealProvider[]> {
  const { data } = await supabase.from('providers')
    .select('id, name, category, city, description, google_rating, google_rating_count, google_reviews, photo_url, provider_services(name, price, pricing_unit, included_guests, extra_guest_price, included_hours, extra_hour_price, description, cancellation_policy, service_media(id))')
    .eq('status', 'approved')
  return (data || []).map((p: any) => ({
    ...p, services: p.provider_services || [],
    google_reviews: Array.isArray(p.google_reviews) ? uniqueReviews(p.google_reviews) : null,
    photos: (p.provider_services || []).reduce((n: number, s: any) => n + (s.service_media?.length || 0), 0) || (p.photo_url ? 1 : 0),
  }))
}

/** Simulación: cada proveedor enseña 3 reseñas en su perfil. Si no tiene
 *  bastantes reales de Google, se completan con hipotéticas (solo aquí). */
async function withThreeReviews(provs: RealProvider[]): Promise<RealProvider[]> {
  return Promise.all(provs.map(async x => {
    const real = (x.google_reviews || []).slice(0, 3)
    if (real.length >= 3) return { ...x, google_reviews: real }
    const r = await askJson<{ resenas: Array<{ text: string; stars: number }> }>(AGENT_MODEL,
      'Escribes reseñas verosímiles y variadas de clientes españoles para una simulación interna de mercado (no se publican): concretas, con algún matiz, como las de Google. Nota entre 4 y 5.',
      `Negocio: ${x.name} (${x.category}, ${x.city}). ${x.description ? x.description.slice(0, 300) : ''}\nEscribe ${3 - real.length} reseña(s) de 2-3 frases de clientes de eventos distintos.`,
      obj({ resenas: { type: 'array', items: obj({ text: str, stars: { type: 'integer' } }) } }), 1500).catch(() => ({ resenas: [] }))
    const all = [...real, ...r.resenas.map(v => ({ text: v.text, stars: Math.max(4, Math.min(5, v.stars)) }))].slice(0, 3)
    return { ...x, google_reviews: all, google_rating: x.google_rating || 4.7, google_rating_count: Math.max(x.google_rating_count || 0, all.length) }
  }))
}

/** Qué tipo de proveedor contactaría primero esta persona (de los que hay). */
async function chooseCategory(p: Persona, cats: string[]): Promise<{ categoria: string; que_le_pides: string }> {
  const labels = cats.map(id => `${id} (${(CATEGORIES as readonly any[]).find(c => c.id === id)?.label || id})`).join(', ')
  return askJson<{ categoria: string; que_le_pides: string }>(AGENT_MODEL, AGENT_SYSTEM, personaCard(p) + '\n\n' +
    `En FiestaGo hay proveedores de: ${labels}. Para tu evento, ¿a qué tipo de proveedor de estos le pedirías presupuesto primero (el que más necesitas)? Di también qué le pides exactamente, en una frase.`,
    obj({ categoria: { type: 'string', enum: cats }, que_le_pides: str }), 1000)
}

function pickProvider(provs: RealProvider[], p: Persona, category?: string): RealProvider | null {
  const cats = category ? [category] : SEGMENT_CATEGORIES[p.segment]
  const fit = provs.filter(x => !cats || cats.includes(x.category))
  const pool = fit.filter(x => /valencia|paterna/i.test(x.city || '')).length ? fit.filter(x => /valencia|paterna/i.test(x.city || '')) : fit
  // Primero los que tienen opiniones de Google, como en la ficha real
  const withG = pool.filter(x => x.google_rating)
  const src = withG.length ? withG : pool
  return src.length ? src[(p.id * 7) % src.length] : null
}

type ProviderQuote = {
  cobra_por: 'personas' | 'horas' | 'cerrado'
  precio_base_eur: number           // IVA incluido, lo que cobra el proveedor
  incluidas: number                 // personas u horas que incluye el precio base (0 si cerrado)
  precio_extra_eur: number          // € por persona u hora de más (0 si cerrado)
  invitados: number; horas: number  // lo que pide el cliente
  incluye: string; no_incluye: string; plan_b: string; requisitos: string; fecha_libre: boolean; mensaje: string
}

/** Total del proveedor para el caso del cliente (como lib/pricing.ts → priceFor). */
function quoteBase(q: ProviderQuote) {
  if (q.cobra_por === 'personas') return q.precio_base_eur + Math.max(0, q.invitados - q.incluidas) * q.precio_extra_eur
  if (q.cobra_por === 'horas') return q.precio_base_eur + Math.max(0, Math.ceil(q.horas) - q.incluidas) * q.precio_extra_eur
  return q.precio_base_eur
}

/** El proveedor (real) responde con su propuesta, a precio de mercado. */
async function generateQuote(p: Persona, prov: RealProvider, ask?: string): Promise<ProviderQuote> {
  const schema = obj({
    cobra_por: { type: 'string', enum: ['personas', 'horas', 'cerrado'] },
    precio_base_eur: { type: 'integer' }, incluidas: { type: 'integer' }, precio_extra_eur: { type: 'integer' },
    invitados: { type: 'integer' }, horas: { type: 'integer' },
    incluye: str, no_incluye: str, plan_b: str, requisitos: str, fecha_libre: { type: 'boolean' }, mensaje: str,
  })
  const tarifa = prov.services.length
    ? prov.services.map(s => `${s.name}: ${s.price ?? '?'} €${s.included_guests ? ` (incluye ${s.included_guests} personas, +${s.extra_guest_price} €/persona de más)` : s.included_hours ? ` (incluye ${s.included_hours} h, +${s.extra_hour_price} €/hora de más)` : ''}${s.description ? ` — ${s.description.slice(0, 200)}` : ''}`).join('\n')
    : 'Sin tarifa publicada: usa precios de mercado de tu categoría en Valencia.'
  return askJson<ProviderQuote>(AGENT_MODEL,
    'Eres un proveedor de eventos español respondiendo a una petición de presupuesto. Eres honesto y realista: das el precio de mercado de lo que de verdad necesita ese evento en Valencia, sin rebajarlo para encajar en el presupuesto del cliente ni inflarlo. Escribes en español de España, breve y concreto.',
    `Tu negocio: ${prov.name} (${prov.category}, ${prov.city}). ${prov.description ? prov.description.slice(0, 400) : ''}\nTus tarifas:\n${tarifa}\n` +
    (prov.hypothetical ? 'Tu ficha está completa: llevas años en esto, has hecho decenas de eventos como este, tienes galerías completas de varios que el cliente ve en la propuesta, seguro de responsabilidad civil en vigor y verificado por FiestaGo, y sabes resolver los imprevistos habituales de tu servicio.\n' : '') +
    `\nPetición del cliente: ${ask ? `${ask}. ` : ''}Evento: ${p.evento}. Fecha: ${p.fecha}. Zona: ${p.ciudad}. Lo que cuenta: ${p.situacion.slice(0, 300)}\n\n` +
    'Solo presupuestas TU servicio (no el local, la comida ni nada de otros proveedores). Rellena tu propuesta como en el panel de FiestaGo, con todos los precios con IVA incluido: cómo cobras (por personas —fotógrafo, catering, local…—, por horas —DJ, animación…— o precio cerrado —una tarta—), tu precio base, cuántas personas u horas incluye, cuánto cobras por persona u hora de más, cuántos invitados y cuántas horas has entendido que pide el cliente, qué incluye exactamente, qué NO incluye (con el precio de los extras si los hay), tu plan B si llueve o hay un imprevisto (obligatorio si tu servicio es de foto, catering, espacios, música, flores, animación o planner; si no, "No aplica"), qué necesitas del local o del cliente (corriente, cocina, espacio… o "nada"), si tienes libre su fecha (casi siempre sí; di que no solo si es muy realista) y un mensaje corto al cliente sin teléfonos, emails ni precios. La garantía, los pagos y las cancelaciones los explica FiestaGo: no hables de eso. Trabajas a través de FiestaGo y firmaste sus compromisos: la Garantía de Éxito la da FiestaGo (si cancelas, ayudas a buscar sustituto o pagas una penalización); si te preguntan por garantía, pagos o cancelaciones, di que lo gestiona FiestaGo y está en el documento de reserva. Nunca escribas precios ni cifras de euros en tus textos: el cliente ve un único precio y los extras van en tu tarifa por persona u hora de más.',
    schema, 3500)
}

/** El proveedor contesta por escrito, con honestidad (puede decir que no). */
async function answerQuestions(prov: RealProvider, q: ProviderQuote, questions: string[], proposal = ''): Promise<Array<{ q: string; a: string }>> {
  if (!questions.length) return []
  // Como en la web (lib/proposal-questions.ts): garantía, pagos y cancelaciones las contesta FiestaGo
  const routed = await askJson<{ items: Array<{ para: 'fiestago' | 'proveedor'; respuesta_fiestago: string }> }>(AGENT_MODEL,
    `Atiendes por FiestaGo las preguntas de un cliente sobre su propuesta. Para cada pregunta: "fiestago" si es de garantía, pagos, señal, devoluciones, cancelaciones, facturas, IVA, seguridad del dinero o quién es FiestaGo; si no, "proveedor". Si es "fiestago", contesta en "respuesta_fiestago" (1-4 frases, cifras exactas de estas condiciones); si no, déjalo vacío.\n\n${FIESTAGO_TERMS}\n\nPropuesta: ${proposal.slice(0, 1500)}`,
    questions.map((x, i) => `${i + 1}. ${x}`).join('\n'),
    obj({ items: { type: 'array', items: obj({ para: { type: 'string', enum: ['fiestago', 'proveedor'] }, respuesta_fiestago: str }) } }), 3000).catch(() => ({ items: [] }))
  const forProvider = questions.filter((_, i) => routed.items[i]?.para !== 'fiestago' || !routed.items[i]?.respuesta_fiestago)
  const provAnswers = forProvider.length ? await answerAsProvider(prov, q, forProvider) : []
  return questions.map((x, i) => routed.items[i]?.para === 'fiestago' && routed.items[i]?.respuesta_fiestago
    ? { q: x, a: `(FiestaGo) ${routed.items[i].respuesta_fiestago}` }
    : { q: x, a: `(${prov.name}) ${stripPrices(provAnswers.find(a => a.q === x)?.a || 'Lo vemos y te contesto en breve.')}` })
}

async function answerAsProvider(prov: RealProvider, q: ProviderQuote, questions: string[]): Promise<Array<{ q: string; a: string }>> {
  const res = await askJson<{ respuestas: string[] }>(AGENT_MODEL,
    'Eres un proveedor de eventos español contestando por escrito preguntas de un cliente sobre tu propuesta. Eres honesto y concreto: si algo no lo haces o no lo puedes garantizar, lo dices claramente y, si puedes, ofreces una alternativa real. Solo hablas de tu servicio. Trabajas a través de FiestaGo y firmaste sus compromisos: la Garantía de Éxito la da FiestaGo (si cancelas, ayudas a buscar sustituto o pagas una penalización); si te preguntan por garantía, pagos o cancelaciones, di que lo gestiona FiestaGo y está en el documento de reserva. Nunca escribas precios ni cifras de euros en tus textos: el cliente ve un único precio y los extras van en tu tarifa por persona u hora de más. Sin teléfonos ni emails.',
    `Tu negocio: ${prov.name} (${prov.category}, ${prov.city}). Tu propuesta: incluye ${q.incluye}; no incluye ${q.no_incluye}; plan B: ${q.plan_b}.\n` +
    (prov.hypothetical ? 'Llevas años en esto y has hecho decenas de eventos como este; tienes galerías completas que ya se ven en la propuesta y seguro de responsabilidad civil verificado por FiestaGo. Sigues siendo honesto con lo que no haces.\n' : '') +
    `\nPreguntas del cliente:\n${questions.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nContesta cada una en 1-3 frases, en el mismo orden.`,
    obj({ respuestas: { type: 'array', items: str } }), 3000)
  return questions.map((x, i) => ({ q: x, a: res.respuestas[i] || 'Lo vemos y te contesto en breve.' }))
}

/** Resumen honesto de la videollamada de 10 min con el proveedor. */
async function videoCall(p: Persona, prov: RealProvider, q: ProviderQuote): Promise<string> {
  const r = await askJson<{ resumen: string }>(AGENT_MODEL,
    'Eres un narrador neutral. Describes en 3-5 frases, en segunda persona y en español de España, cómo fue una videollamada de 10 minutos entre un cliente y un proveedor de eventos, con realismo: lo que el proveedor enseñó y explicó, cómo le cayó al cliente y lo que quedó sin resolver si algo quedó. Sin exagerar en ningún sentido.',
    personaCard(p) + `\n\nProveedor: ${prov.name} (${prov.category}, ${prov.city}), ${prov.photos} fotos de trabajos${prov.hypothetical ? ', experiencia de años y galerías completas' : ''}. Su propuesta: ${stripPrices(q.incluye)}; no incluye: ${stripPrices(q.no_incluye)}.`,
    obj({ resumen: str }), 1500).catch(() => ({ resumen: '' }))
  return r.resumen
}

const COMMISSION = 0.08
function proposalText(p: Persona, prov: RealProvider, q: ProviderQuote) {
  const total = Math.round(quoteBase(q) * (1 + COMMISSION))
  const senal = Math.round(total * 0.1)
  const svc = prov.services.find(s => s.cancellation_policy)
  const pol = svc?.cancellation_policy === 'flexible' ? 'Flexible: reembolso completo hasta 7 días antes; 50 % entre 7 días y 48 h; nada después.'
    : svc?.cancellation_policy === 'strict' ? 'Estricta: 50 % hasta 30 días antes; nada después.'
    : 'Moderada: reembolso completo hasta 14 días antes; 50 % entre 14 y 7 días; nada después.'
  const reviews = (prov.google_reviews || []).slice(0, 3)
  const google = prov.google_rating
    ? `Opiniones de Google: ${String(prov.google_rating).replace('.', ',')} ★ (${prov.google_rating_count || 0} opiniones), comprobable buscándolo en Google Maps.${reviews.length ? ` Algunas: ${reviews.map(r => `"${r.text.slice(0, 220)}" (${r.stars}★)`).join(' · ')}` : ''}`
    : 'Opiniones de Google: este proveedor todavía no tiene opiniones en Google.'
  const k = 1 + COMMISSION
  const como = q.cobra_por === 'personas' ? `${Math.round(q.precio_base_eur * k)} € para ${q.incluidas} personas y ${Math.round(q.precio_extra_eur * k)} € por persona de más; para tus ${q.invitados} invitados`
    : q.cobra_por === 'horas' ? `${Math.round(q.precio_base_eur * k)} € por ${q.incluidas} h y ${Math.round(q.precio_extra_eur * k)} € por hora de más; para tus ${q.horas} h`
    : 'precio cerrado'
  const perPerson = q.invitados > 0 ? ` (≈ ${(total / q.invitados).toFixed(2).replace('.', ',')} € por persona)` : ''
  return `Email de FiestaGo: "${prov.name} te ha enviado su propuesta." Enlace al "Documento de reserva" de FiestaGo (un único documento: arriba FiestaGo, el proveedor y el precio; luego el servicio, los detalles acordados por escrito, cómo pagas y al final la Garantía FiestaGo y sus condiciones; se puede descargar; es solo de este servicio, el resto lo contratas aparte):\n` +
    `- ${prov.name} (${prov.category}, ${prov.city}) para tu evento: ${q.invitados} invitados${q.horas ? `, ${q.horas} h` : ''}, ${p.fecha}.${q.fecha_libre ? ` ✓ Confirma que tiene libre tu fecha.` : ' No confirma que tenga libre tu fecha.'}\n` +
    `- Cómo cobra: ${como}.\n` +
    `- Precio del servicio para tu caso: ${total.toLocaleString('es-ES')} €${perPerson}. Precio único y cerrado, con IVA y Garantía FiestaGo incluidos (el desglose solo sale en la factura).\n` +
    `- Al reservar pagas la señal del 10 %: ${senal.toLocaleString('es-ES')} €. El resto, ${(total - senal).toLocaleString('es-ES')} €, 2 meses antes del evento. El dinero queda retenido en Stripe y el proveedor no lo cobra hasta que termina tu evento.\n` +
    `- Qué incluye: ${stripPrices(q.incluye)}\n- Qué no incluye: ${stripPrices(q.no_incluye)}\n- Plan B si llueve o hay un imprevisto: ${stripPrices(q.plan_b)}\n- Qué necesita del local o de ti: ${stripPrices(q.requisitos)}\n- Mensaje del proveedor: "${maskPrices(q.mensaje)}"\n- ${google}\n` +
    (prov.hypothetical ? `- Sus trabajos: galería con ${prov.photos} fotos de eventos parecidos al tuyo, incluidas dos celebraciones completas.\n- Verificado por FiestaGo: identidad (DNI/CIF) y seguro de responsabilidad civil en vigor.\n`
      : prov.photos ? `- Sus trabajos: ${prov.photos} foto${prov.photos > 1 ? 's' : ''} de eventos que ha hecho.\n` : '- Sus trabajos: todavía no ha subido fotos de sus trabajos.\n') +
    `- Con quién contratas: ${prov.name} presta el servicio; FiestaGo (Francisco Mariano González Tejedo, NIF 09437664M, Oviedo) cobra la señal y el resto, los retiene en Stripe hasta después del evento y responde de la garantía con su dinero. Recibes la factura del servicio (de ${prov.name}) y la de la garantía (de FiestaGo). El precio de la propuesta es el único que pagas.\n` +
    '- Reserva sin riesgo: si en los 7 días siguientes a pagar la señal no cerráis los detalles finales (menú, boceto, horario…) o cambian tus planes, cancelas y te devuelven la señal entera (eventos a 30 días o más).\n' +
    `- Condiciones por escrito: si el proveedor cancela, sustituto equivalente en 48 h o te devuelven todo y un 10 % más; si no se presenta, lo pagado y ${noShowCompensation(total)} € de compensación; la garantía la da FiestaGo con su dinero (el proveedor firmó sus compromisos: si cancela, ayuda a buscar sustituto o paga una penalización); después de esos 7 días, si cancelas tú, política ${pol} No cubre la lluvia ni los cambios que pidas tú.\n` +
    '- Botones: "Pregunta antes de reservar" (con atajos para pedir el detalle final por escrito: menú, boceto, horario, cuántas personas vienen; lo del servicio lo contesta el proveedor por escrito y queda en la propuesta; lo de la garantía, los pagos y las cancelaciones lo contesta FiestaGo al momento), "Verle por videollamada antes de reservar" (el proveedor propone hora y FiestaGo te manda el enlace), "Reservar con señal", "Compartir con quien lo decide conmigo" y "Ver tu celebración completa" (todas tus propuestas juntas con el total, lo que tiene que tener el local y lo que suele faltar).'
}

// ─── Utilidades ────────────────────────────────────────────────────

let _client: Anthropic | null = null
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
    _client = new Anthropic()
  }
  return _client
}

const usage = { input: 0, output: 0, calls: 0, failed: 0, last_error: '' }

async function askJson<T>(model: string, system: string, user: string, schema: Record<string, unknown>, maxTokens = 4000): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await client().messages.create({
        model,
        max_tokens: maxTokens,
        output_config: { format: { type: 'json_schema', schema } },
        system,
        messages: [{ role: 'user', content: user }],
      } as any)
      usage.calls++
      usage.input += resp.usage?.input_tokens || 0
      usage.output += resp.usage?.output_tokens || 0
      const raw = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
      return JSON.parse(raw) as T
    } catch (err) {
      lastErr = err
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
  throw lastErr
}

async function pool<I, O>(items: I[], fn: (item: I, i: number) => Promise<O>): Promise<Array<O | null>> {
  const out: Array<O | null> = new Array(items.length).fill(null)
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const i = next++
      try { out[i] = await fn(items[i], i) } catch (err: any) {
        out[i] = null
        usage.failed++
        usage.last_error = String(err?.message || err).slice(0, 300)
      }
    }
  }))
  return out
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const str = { type: 'string' }
// Los esquemas JSON de la API no admiten minimum/maximum: la escala 1-5 va en el prompt
const int15 = { type: 'integer', description: 'de 1 a 5' }
const action = { type: 'string', enum: [...ACTIONS] }
const obj = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) })

// ─── 1. Personas ──────────────────────────────────────────────────

export type Persona = {
  id: number; segment: string; nombre: string; edad: number; ciudad: string
  evento: string; fecha: string; presupuesto: string; situacion: string
  como_busca: string; redes: string; miedos: string; personalidad: string
}

async function generatePersonas(cfg: SimConfig): Promise<Persona[]> {
  const batches: Array<{ segment: SimConfig['segments'][number]; n: number }> = []
  for (const seg of cfg.segments) {
    let left = Math.round(cfg.personas * seg.share)
    while (left > 0) { const n = Math.min(15, left); batches.push({ segment: seg, n }); left -= n }
  }
  const schema = obj({
    personas: {
      type: 'array',
      items: obj({ nombre: str, edad: { type: 'integer' }, ciudad: str, evento: str, fecha: str, presupuesto: str, situacion: str, como_busca: str, redes: str, miedos: str, personalidad: str }),
    },
  })
  const system = 'Creas perfiles realistas y variados de consumidores españoles para un estudio de mercado. Evitas estereotipos y clones: varía edad, ingresos, barrio o pueblo, nivel digital, carácter y circunstancias. Escribe en español de España.'
  const res = await pool(batches, ({ segment, n }) => askJson<{ personas: Omit<Persona, 'id' | 'segment'>[] }>(
    PERSONA_MODEL, system,
    `Genera ${n} personas distintas del segmento "${segment.name}": ${segment.brief}\n\nCampos: nombre, edad, ciudad (Valencia ciudad o pueblos del área), evento (qué celebra y para cuánta gente), fecha, presupuesto (cifra aproximada y cómo de ajustado), situacion (trabajo, familia, cuánto tiempo tiene), como_busca (dónde busca proveedores hoy), redes (qué redes usa y cuánto), miedos (qué le preocupa al contratar), personalidad (2-3 rasgos).`,
    schema, 8000,
  ).then(r => r.personas.slice(0, n).map(p => ({ ...p, segment: segment.name }))))
  return res.flatMap(r => r || []).map((p, i) => ({ ...p, id: i + 1 }) as Persona)
}

// ─── 2. Ronda 1: reacción individual ──────────────────────────────

export type Round1 = {
  web: { confianza: number; claridad: number; accion: Action; lo_que_mas_gusta: string; lo_que_falta: string; objecion: string }
  posts: Array<{ id: string; atencion: number; confianza: number; accion: Action; comentario: string; objecion: string }>
  perfil: { entiende_que_es_para_clientes: boolean; efecto: 'mejora' | 'neutro' | 'empeora'; reaccion: string }
}

function personaCard(p: Persona) {
  return `Eres ${p.nombre}, ${p.edad} años, de ${p.ciudad}. ${p.situacion}
Evento: ${p.evento}, fecha ${p.fecha}. Presupuesto: ${p.presupuesto}.
Hoy buscas proveedores así: ${p.como_busca}. Redes: ${p.redes}.
Te preocupa: ${p.miedos}. Personalidad: ${p.personalidad}.`
}

const AGENT_SYSTEM = `Interpretas a una persona real en un estudio de mercado. Respondes como ella de verdad reaccionaría, no como un cliente ideal: si algo no te interesa, lo ignoras; si desconfías, lo dices; si no lo entiendes, lo dices. La mayoría de la gente ignora casi todos los posts que ve en redes. Sé honesto con tus dudas y escribe los comentarios como los escribirías tú (cortos, coloquiales, español de España).
Acciones posibles, de menos a más compromiso: ignorar, ver_perfil, entrar_web, hacer_quiz, apuntarse (lista de espera o dejar datos), reservar.`

async function runRound1(cfg: SimConfig, p: Persona): Promise<Round1> {
  const schema = obj({
    web: obj({ confianza: int15, claridad: int15, accion: action, lo_que_mas_gusta: str, lo_que_falta: str, objecion: str }),
    posts: { type: 'array', items: obj({ id: { type: 'string', enum: postsFor(cfg, p).map(s => s.id) }, atencion: int15, confianza: int15, accion: action, comentario: str, objecion: str }) },
    perfil: obj({ entiende_que_es_para_clientes: { type: 'boolean' }, efecto: { type: 'string', enum: ['mejora', 'neutro', 'empeora'] }, reaccion: str }),
  })
  const posts = shuffle(postsFor(cfg, p)).map(s => `[${s.id}]\n${s.text}`).join('\n\n')
  if (cfg.scenario) {
    return askJson<Round1>(AGENT_MODEL, AGENT_SYSTEM, personaCard(p) + '\n\n' +
      `${cfg.scenario.intro}\n\n${posts}\n\nLa web de FiestaGo que has visto:\n${cfg.web}\n\nSu perfil de Instagram/TikTok:\n${cfg.profile}\n\n${cfg.scenario.question}`,
      schema, 5000)
  }
  return askJson<Round1>(AGENT_MODEL, AGENT_SYSTEM, personaCard(p) + '\n\n' +
    `Mientras haces scroll en Instagram o TikTok te aparecen estos posts patrocinados de FiestaGo, una marca que no conocías:\n\n${posts}\n\n` +
    `Imagina además que entras en la web y ves esto:\n${cfg.web}\n\n` +
    `Y que antes de fiarte miras su perfil de Instagram/TikTok:\n${cfg.profile}\n\n` +
    'Para cada post: atención (1-5), confianza (1-5), qué harías de verdad, el comentario que pensarías o escribirías, y tu principal objeción. Para la web: confianza y claridad (1-5), qué harías, lo que más te gusta, lo que echas en falta y tu objeción. Para el perfil: si entiendes que FiestaGo es para clientes como tú, si te da más o menos confianza y por qué.',
    schema, 5000)
}

// ─── 3. Ronda 2: influencia social ────────────────────────────────

export type Round2 = { mejor_post: string; cambia_opinion: boolean; accion_final: Action; motivo: string; que_te_haria_reservar: string }

async function runRound2(cfg: SimConfig, p: Persona, r1: Round1, others: string[]): Promise<Round2> {
  const schema = obj({
    mejor_post: { type: 'string', enum: [...postsFor(cfg, p).map(s => s.id), 'ninguno'] },
    cambia_opinion: { type: 'boolean' }, accion_final: action, motivo: str, que_te_haria_reservar: str,
  })
  const mine = r1.posts.map(x => `[${x.id}] atención ${x.atencion}, confianza ${x.confianza}, ${x.accion}: "${x.comentario}"`).join('\n')
  return askJson<Round2>(AGENT_MODEL, AGENT_SYSTEM, personaCard(p) + '\n\n' +
    `${cfg.scenario?.round2_intro || 'Ayer viste los posts y la web de FiestaGo.'} Tu reacción fue:\n${mine}\nWeb: confianza ${r1.web.confianza}, ${r1.web.accion}. Te faltaba: ${r1.web.lo_que_falta}\n\n` +
    `Hoy, en los comentarios de esos posts y en un grupo de WhatsApp, lees lo que opinan otras personas:\n${others.map(o => `- ${o}`).join('\n')}\n\n` +
    'Con eso, ¿qué post te convenció más (o ninguno)? ¿Cambias de opinión? ¿Qué harías finalmente con FiestaGo para tu evento, y por qué? ¿Qué tendría que pasar para que reservaras?',
    schema, 1200)
}

// ─── 3a. Cierre: pidió presupuesto, ¿paga la señal? ────────────────

export const CLOSE_DECISIONS = ['reservar', 'bloquear_fecha', 'seguir_comparando', 'descartar'] as const
export type RoundClose = {
  puntos: Array<{ id: string; confianza: number; efecto: 'me_acerca' | 'neutro' | 'me_aleja'; comentario: string }>
  decision: typeof CLOSE_DECISIONS[number]
  senal_aceptable: boolean
  motivo: string
  que_faltaria_para_reservar: string
  /** Solo con propuesta escrita: la persona y el proveedor real que la mandó */
  proveedor?: string
  propuesta?: ProviderQuote
  preguntas_al_proveedor?: string[]
  pide_videollamada?: boolean
  respuestas?: Array<{ q: string; a: string }>
  videollamada?: string
  journey?: Journey
  /** Quien bloqueó la fecha vuelve a decidir 48 h después */
  segunda?: { decision: 'reservar' | 'descartar_definitivamente'; efecto_seguimiento: 'me_acerca' | 'neutro' | 'me_aleja'; que_dijo_quien_decide_conmigo: string; motivo: string; motivo_exacto_descarte: string; que_faltaria_para_reservar: string }
}

async function runClose(cfg: SimConfig, p: Persona, r2: Round2, override?: Stimulus[]): Promise<RoundClose> {
  const tps = override || cfg.closing!.touchpoints.filter(s => !s.segments || s.segments.includes(p.segment))
  const schema = obj({
    puntos: { type: 'array', items: obj({ id: { type: 'string', enum: tps.map(s => s.id) }, confianza: int15, efecto: { type: 'string', enum: ['me_acerca', 'neutro', 'me_aleja'] }, comentario: str }) },
    decision: { type: 'string', enum: [...CLOSE_DECISIONS] },
    senal_aceptable: { type: 'boolean' },
    motivo: str,
    que_faltaria_para_reservar: str,
    ...(cfg.closing!.proposal ? {
      preguntas_al_proveedor: { type: 'array', items: str, description: '0 a 3 preguntas o detalles finales que pedirías por escrito desde la propuesta antes de decidir (vacío si no tienes)' },
      pide_videollamada: { type: 'boolean', description: 'si pedirías la videollamada con el proveedor antes de reservar' },
    } : {}),
  })
  return askJson<RoundClose>(AGENT_MODEL, AGENT_SYSTEM, personaCard(p) + '\n\n' +
    `Hace unos días viste FiestaGo y decidiste: ${r2.accion_final} ("${r2.motivo}").\n\n${cfg.closing!.intro}\n\n` +
    tps.map(s => `[${s.id}] ${s.label}\n${s.text}`).join('\n\n') + '\n\n' +
    'Para cada cosa que te ha llegado: cuánta confianza te da (1-5), si te acerca o te aleja de reservar y qué piensas. ' +
    'Después decide de verdad, como lo harías tú con tu dinero y tu evento: "reservar" (pagas ya la señal en FiestaGo), "bloquear_fecha" (bloqueas 48 h gratis para pensarlo), "seguir_comparando" (miras otras opciones fuera) o "descartar". ' +
    'Di si la señal (10-20 % del total) te parece aceptable, por qué decides eso y qué te faltaría para reservar ahora mismo.' +
    (cfg.closing!.proposal ? ' En la propuesta puedes preguntar o pedir el detalle final por escrito (hasta 3 cosas) y pedir una videollamada con el proveedor; di qué harías.' : ''),
    schema, 3000)
}

async function runClose2(cfg: SimConfig, p: Persona, first: RoundClose, proposal: string, answers: Array<{ q: string; a: string }> = [], video = ''): Promise<NonNullable<RoundClose['segunda']>> {
  const follow = cfg.closing!.touchpoints.find(t => t.id === 'seguimiento_ayuda')
  const schema = obj({
    decision: { type: 'string', enum: ['reservar', 'descartar_definitivamente'] },
    efecto_seguimiento: { type: 'string', enum: ['me_acerca', 'neutro', 'me_aleja'] },
    que_dijo_quien_decide_conmigo: str, motivo: str,
    motivo_exacto_descarte: { type: 'string', description: 'si descartas: la razón exacta y concreta por la que no vas a reservar con FiestaGo; si reservas, cadena vacía' },
    que_faltaria_para_reservar: str,
  })
  return askJson<NonNullable<RoundClose['segunda']>>(AGENT_MODEL, AGENT_SYSTEM, personaCard(p) + '\n\n' +
    `Hace dos días recibiste esta propuesta:\n${proposal}\n\nTe llamaron de FiestaGo y decidiste bloquear la fecha 48 h gratis para pensarlo ("${first.motivo}").\n\n` +
    `Desde entonces has tenido tiempo de mirarlo con calma y, si lo decides con alguien (pareja, familia, amigos), se lo has enseñado con el enlace de la propuesta; imagina con realismo qué te ha dicho según tu situación. Mientras tanto pasó esto:\n[seguimiento_ayuda] ${follow?.text || ''}\n\n` +
    (answers.length ? `Las preguntas que hiciste desde la propuesta y sus respuestas por escrito (quedan en tu propuesta; entre paréntesis, quién contesta):\n${answers.map(x => `- Tú: ${x.q}\n  Respuesta: ${x.a}`).join('\n')}\n\n` : '') +
    (video ? `Hiciste la videollamada con el proveedor: ${video}\n\n` : '') +
    'El bloqueo caduca hoy y FiestaGo te pide una respuesta clara: o reservas, o lo descartas definitivamente (no hay "ya veré"). Decide de verdad, con tu dinero y tu evento, como lo harías en la vida real: "reservar" (pagas la señal en FiestaGo) o "descartar_definitivamente" (no vas a contratar este servicio con FiestaGo). Si descartas, di EXACTAMENTE por qué, con la razón concreta y real (no una genérica). Di también si el seguimiento te acercó o te alejó, qué te dijo quien decide contigo y qué te faltaría para reservar.',
    schema, 1500)
}

// ─── 3c. Recorrido completo (simulación 12) ───────────────────────
// Ficha del proveedor → propuesta + llamada → 48 h (respuestas,
// videollamada, llamada de seguimiento) → detalles finales cerrados.
// En cada paso puede reservar, seguir con dudas, seguir hablando con el
// proveedor o descartar; al final, con todo cerrado, reserva o no.

export const JOURNEY_STEPS = ['ficha', 'propuesta', 'a_48h', 'detalles_finales'] as const
export type Journey = {
  pasos: Array<{ fase: typeof JOURNEY_STEPS[number]; decision: string; motivo: string; preguntas?: string[]; videollamada?: boolean }>
  reserva_en: typeof JOURNEY_STEPS[number] | null
  motivo_final: string
}

function fichaText(p: Persona, prov: RealProvider, q: ProviderQuote) {
  const total = Math.round(quoteBase(q) * (1 + COMMISSION))
  const k = 1 + COMMISSION
  const como = q.cobra_por === 'personas' ? `${Math.round(q.precio_base_eur * k)} € para ${q.incluidas} personas y ${Math.round(q.precio_extra_eur * k)} € por persona de más`
    : q.cobra_por === 'horas' ? `${Math.round(q.precio_base_eur * k)} € por ${q.incluidas} h y ${Math.round(q.precio_extra_eur * k)} € por hora de más` : 'precio cerrado'
  const google = (prov.google_rating ? `${String(prov.google_rating).replace('.', ',')} ★ (${prov.google_rating_count || 0} opiniones)` : 'sin opiniones todavía') +
    ((prov.google_reviews || []).length ? `. Reseñas en su perfil: ${(prov.google_reviews || []).slice(0, 3).map(r => `"${r.text.slice(0, 200)}" (${r.stars}★)`).join(' · ')}` : '')
  return `Ficha de ${prov.name} en FiestaGo (${prov.category}, ${prov.city}): ${prov.description ? prov.description.slice(0, 250) + ' ' : ''}` +
    `Cómo cobra (precio único: IVA y Garantía de Éxito incluidos; el desglose solo sale en la factura): ${como}. Pones tus invitados${q.cobra_por === 'horas' ? ' y horas' : ''} y te sale ${total.toLocaleString('es-ES')} € para tu caso${q.invitados > 0 ? ` (≈ ${(total / q.invitados).toFixed(2).replace('.', ',')} € por persona)` : ''}. ` +
    `${prov.hypothetical ? `Galería con ${prov.photos} fotos de eventos parecidos; verificado (DNI/CIF y seguro de RC). ` : prov.photos ? `${prov.photos} fotos de trabajos. ` : 'Sin fotos de trabajos todavía. '}${google}. ` +
    'Señal del 10 % al reservar y el resto 2 meses antes, retenido en Stripe hasta después del evento. Reserva sin riesgo: 7 días desde la señal para cancelar con devolución íntegra. ' +
    'Botones: "Reservar con señal", "Pedir que me cuente más detalles" (te manda su propuesta por escrito), "Verle por videollamada" y "Prefiero que me llaméis desde FiestaGo".'
}

const STEP_DECISIONS = ['reservar', 'tengo_dudas', 'seguir_hablando_con_el_proveedor', 'descartar'] as const

async function journeyStep(p: Persona, context: string, ask: string, final = false) {
  const schema = obj({
    decision: { type: 'string', enum: final ? ['reservar', 'no_reservar'] : [...STEP_DECISIONS] },
    motivo: str,
    preguntas: { type: 'array', items: str, description: 'si sigues: 0-3 dudas o detalles concretos que necesitas cerrar por escrito (vacío si no)' },
    videollamada: { type: 'boolean', description: 'si pedirías (o vuelves a pedir) videollamada con el proveedor' },
  })
  return askJson<{ decision: string; motivo: string; preguntas: string[]; videollamada: boolean }>(AGENT_MODEL, AGENT_SYSTEM,
    personaCard(p) + '\n\n' + context + '\n\n' + ask, schema, 3500)
}

/** El proveedor cierra por escrito los detalles pendientes (honesto). */
async function finalDetails(p: Persona, prov: RealProvider, q: ProviderQuote, pending: string[]): Promise<string> {
  const r = await askJson<{ detalles: string }>(AGENT_MODEL,
    'Eres un proveedor de eventos español cerrando por escrito los detalles finales de una propuesta antes de que el cliente reserve: concretas lo que te piden (menú, boceto o diseño, horario de llegada y fin, cuántas personas de tu equipo, qué necesitas del local, cómo resuelves lo que te preocupa). Eres honesto: si algo no lo haces, lo dices y das la alternativa real.  Trabajas a través de FiestaGo y firmaste sus compromisos: la Garantía de Éxito la da FiestaGo (si cancelas, ayudas a buscar sustituto o pagas una penalización); si te preguntan por garantía, pagos o cancelaciones, di que lo gestiona FiestaGo y está en el documento de reserva. Nunca escribas precios ni cifras de euros en tus textos: el cliente ve un único precio y los extras van en tu tarifa por persona u hora de más. Sin teléfonos ni emails. 5-10 frases.',
    `Tu negocio: ${prov.name} (${prov.category}, ${prov.city}).${prov.hypothetical ? ' Llevas años y has hecho decenas de eventos como este.' : ''} Tu propuesta: incluye ${q.incluye}; no incluye ${q.no_incluye}; plan B: ${q.plan_b}; necesitas del local: ${q.requisitos}.\nEvento del cliente: ${p.evento}, ${p.fecha}, ${p.ciudad}.\nLo que te pide cerrar por escrito:\n${pending.map(x => `- ${x}`).join('\n') || '- el detalle final de lo que incluye y el horario'}`,
    obj({ detalles: str }), 3000).catch(() => ({ detalles: '' }))
  return stripPrices(r.detalles) || `Te confirmo por escrito: ${q.incluye}. No incluye: ${q.no_incluye}. Plan B: ${q.plan_b}. Necesito del local: ${q.requisitos}.`
}

async function runJourney(cfg: SimConfig, p: Persona, r2: Round2, prov: RealProvider, q: ProviderQuote, proposal: string): Promise<RoundClose> {
  const call = cfg.closing!.touchpoints.find(t => t.id === 'llamada_fiestago')?.text || ''
  const follow = cfg.closing!.touchpoints.find(t => t.id === 'seguimiento_ayuda')?.text || ''
  const j: Journey = { pasos: [], reserva_en: null, motivo_final: '' }
  const pending: string[] = []
  let story = `Hace unos días viste FiestaGo por primera vez y decidiste: ${r2.accion_final} ("${r2.motivo}"). Entraste en la web y elegiste un proveedor para UNO de los servicios de tu celebración (el resto lo contratas aparte).`
  const end = (fase: Journey['reserva_en'], motivo: string) => { j.reserva_en = fase; j.motivo_final = motivo }

  // 1) Ficha
  const s1 = await journeyStep(p, `${story}\n\n${fichaText(p, prov, q)}`,
    'Estás en su ficha. ¿Qué haces de verdad? "reservar" (pagas ya la señal), "tengo_dudas" o "seguir_hablando_con_el_proveedor" (pides que te cuente más detalles por escrito y/o una videollamada; di cuáles) o "descartar".')
  j.pasos.push({ fase: 'ficha', decision: s1.decision, motivo: s1.motivo, preguntas: s1.preguntas, videollamada: s1.videollamada })
  if (s1.decision === 'reservar') { end('ficha', s1.motivo); return asClose(j, prov, q) }
  if (s1.decision === 'descartar') { j.motivo_final = s1.motivo; return asClose(j, prov, q) }
  pending.push(...(s1.preguntas || []))

  // 2) Propuesta escrita + llamada de FiestaGo
  story += `\n\nEn su ficha pediste que te contara más${s1.videollamada ? ' y una videollamada' : ''}. Desde entonces:\n[propuesta] ${proposal}\n[llamada_fiestago] ${call}`
  const s2 = await journeyStep(p, story, 'Con su propuesta escrita delante y tras la llamada, ¿qué haces? "reservar", "tengo_dudas", "seguir_hablando_con_el_proveedor" (di qué detalles le pides por escrito y si quieres videollamada) o "descartar". Puedes bloquear la fecha 48 h gratis mientras tanto.')
  j.pasos.push({ fase: 'propuesta', decision: s2.decision, motivo: s2.motivo, preguntas: s2.preguntas, videollamada: s2.videollamada })
  if (s2.decision === 'reservar') { end('propuesta', s2.motivo); return asClose(j, prov, q) }
  if (s2.decision === 'descartar') { j.motivo_final = s2.motivo; return asClose(j, prov, q) }
  pending.push(...(s2.preguntas || []))

  // 3) A las 48 h: respuestas por escrito, videollamada y llamada de seguimiento
  const answers = await answerQuestions(prov, q, pending.slice(0, 4), proposal).catch(() => [])
  const video = s1.videollamada || s2.videollamada ? await videoCall(p, prov, q) : ''
  story += `\n\nHan pasado 48 h (tienes la fecha bloqueada). ${answers.length ? `Respuestas por escrito en tu propuesta:\n${answers.map(x => `- Tú: ${x.q}\n  Respuesta: ${x.a}`).join('\n')}\n` : ''}${video ? `Hiciste la videollamada: ${video}\n` : ''}[seguimiento] ${follow}\nSi lo decides con alguien, ya se lo has enseñado; imagina con realismo qué te ha dicho.`
  const s3 = await journeyStep(p, story, 'El bloqueo de 48 h termina. ¿Qué haces? "reservar" (pagas la señal, con 7 días de Reserva sin riesgo), "tengo_dudas" o "seguir_hablando_con_el_proveedor" (di qué detalles finales necesitas por escrito para decidir) o "descartar".')
  j.pasos.push({ fase: 'a_48h', decision: s3.decision, motivo: s3.motivo, preguntas: s3.preguntas })
  if (s3.decision === 'reservar') { end('a_48h', s3.motivo); return asClose(j, prov, q) }
  if (s3.decision === 'descartar') { j.motivo_final = s3.motivo; return asClose(j, prov, q) }

  // 4) Detalles finales cerrados por escrito → decisión definitiva
  const details = await finalDetails(p, prov, q, [...(s3.preguntas || []), ...pending].slice(0, 6))
  story += `\n\nSeguiste hablando con el proveedor por FiestaGo y te ha cerrado por escrito los detalles finales:\n${details}`
  const s4 = await journeyStep(p, story, 'Ya tienes todos los detalles por escrito. Decisión definitiva, como en la vida real con tu dinero: "reservar" (pagas la señal; tienes 7 días de Reserva sin riesgo) o "no_reservar". Explica el motivo exacto.', true)
  j.pasos.push({ fase: 'detalles_finales', decision: s4.decision, motivo: s4.motivo })
  if (s4.decision === 'reservar') end('detalles_finales', s4.motivo)
  else j.motivo_final = s4.motivo
  return asClose(j, prov, q)
}

/** Encaja el recorrido en RoundClose para reutilizar agregados y muestras. */
function asClose(j: Journey, prov: RealProvider, q: ProviderQuote): RoundClose {
  const last = j.pasos[j.pasos.length - 1]
  return {
    puntos: [], decision: j.reserva_en ? 'reservar' : last.decision === 'descartar' || last.decision === 'no_reservar' ? 'descartar' : 'seguir_comparando',
    senal_aceptable: true, motivo: j.motivo_final || last.motivo, que_faltaria_para_reservar: j.reserva_en ? '' : j.motivo_final,
    proveedor: `${prov.name} (${prov.category})`, propuesta: q, journey: j,
  }
}

function journeyStats(rs: RoundClose[], total: number) {
  const js = rs.map(r => r.journey).filter(Boolean) as Journey[]
  const n = js.length
  const at = (f: Journey['reserva_en']) => js.filter(j => j.reserva_en === f).length
  const reached = (f: typeof JOURNEY_STEPS[number]) => js.filter(j => j.pasos.some(x => x.fase === f)).length
  const booked = js.filter(j => j.reserva_en).length
  return {
    llegan_a_la_ficha: n,
    reservan_en: Object.fromEntries(JOURNEY_STEPS.map(f => [f, at(f)])),
    llegan_a: Object.fromEntries(JOURNEY_STEPS.map(f => [f, reached(f)])),
    decisiones_por_fase: Object.fromEntries(JOURNEY_STEPS.map(f => [f, js.flatMap(j => j.pasos.filter(x => x.fase === f).map(x => x.decision))
      .reduce((m: Record<string, number>, d) => ({ ...m, [d]: (m[d] || 0) + 1 }), {})])),
    con_detalles_cerrados_reservan_pct: pct(at('detalles_finales'), reached('detalles_finales')),   // la pregunta clave
    reservan_total_pct: pct(booked, n),                                                            // OBJETIVO ≥ 50 %
    reservan_sobre_personas_pct: pct(booked, total),
    piden_videollamada_pct: pct(js.filter(j => j.pasos.some(x => x.videollamada)).length, n),
    motivos_no_reservar_con_detalles: js.filter(j => j.pasos.some(x => x.fase === 'detalles_finales') && !j.reserva_en).map(j => j.motivo_final).slice(0, 60),
  }
}

// ─── 3b. Entrevista final: qué te haría reservar ──────────────────
// Pregunta directa a cada persona, con todo lo que ha visto y leído.

export const CONDITIONS = [
  'resenas_reales', 'precio_total_cerrado', 'senal_menor', 'hablar_con_persona', 'telefono',
  'proveedores_en_mi_zona', 'servicio_central_de_mi_evento', 'disponibilidad_mi_fecha',
  'garantia_clara', 'seguridad_del_dinero', 'empresa_solida', 'cancelacion_flexible',
  'ver_trabajos_reales', 'recomendacion_conocido', 'necesidad_especifica', 'otro',
] as const
const CHANNELS = ['whatsapp', 'telefono', 'email', 'videollamada', 'en_persona', 'solo_web'] as const

export type Round3 = {
  condiciones: Array<{ categoria: typeof CONDITIONS[number]; detalle: string }>
  reservaria_si_se_cumple: 'si' | 'probablemente' | 'no'
  senal_maxima_pct: number
  canal_preferido: typeof CHANNELS[number]
  respuesta_literal: string
}

async function runRound3(p: Persona, r2: Round2, close?: RoundClose | null): Promise<Round3> {
  const schema = obj({
    condiciones: { type: 'array', items: obj({ categoria: { type: 'string', enum: [...CONDITIONS] }, detalle: str }) },
    reservaria_si_se_cumple: { type: 'string', enum: ['si', 'probablemente', 'no'] },
    senal_maxima_pct: { type: 'integer', description: 'de 0 a 100' },
    canal_preferido: { type: 'string', enum: [...CHANNELS] },
    respuesta_literal: str,
  })
  return askJson<Round3>(AGENT_MODEL, AGENT_SYSTEM, personaCard(p) + '\n\n' +
    `Ya conoces FiestaGo (la web, sus posts y lo que comenta la gente). Tu decisión fue: ${r2.accion_final}, porque "${r2.motivo}".\n` +
    (close ? `Después pediste presupuesto, te respondió el proveedor y te llamaron de FiestaGo; decidiste: ${close.decision} ("${close.motivo}").\n` : '') + '\n' +
    'Ahora te entrevista FiestaGo y te pregunta directamente: "¿Qué tendría que pasar EXACTAMENTE para que reservaras tu evento con nosotros?" ' +
    'Responde con sinceridad, pensando en tu caso concreto (tu evento, tu fecha, tu presupuesto, tu pueblo). Da entre 1 y 3 condiciones, de la más a la menos importante, cada una con su categoría y un detalle concreto ' +
    '(por ejemplo "ver 3 reseñas de comuniones en l\'Horta", "una señal de 100 € como mucho", "que me llame una persona antes de pagar"). ' +
    'Di si reservarías de verdad si se cumplieran, qué señal máxima pagarías al reservar (en % del total) y por qué canal preferirías resolver tus dudas. ' +
    'En "respuesta_literal" contéstalo como lo dirías tú, en 1-3 frases.',
    schema, 1200)
}

/** Embudo: cuántos llegan al cierre y qué deciden; efecto de cada paso. */
function funnelStats(cfg: SimConfig, total: number, rs: Round3Close[]) {
  const n = rs.length
  const dec = Object.fromEntries(CLOSE_DECISIONS.map(d => [d, rs.filter(r => r.decision === d).length]))
  const touch: Record<string, unknown> = {}
  for (const t of cfg.closing!.touchpoints) {
    const ps = rs.flatMap(r => r.puntos.filter(x => x.id === t.id))
    if (!ps.length) continue
    touch[t.id] = {
      n: ps.length,
      confianza: avg(ps.map(x => x.confianza)),
      me_acerca_pct: pct(ps.filter(x => x.efecto === 'me_acerca').length, ps.length),
      me_aleja_pct: pct(ps.filter(x => x.efecto === 'me_aleja').length, ps.length),
    }
  }
  return {
    personas: total,
    llegan_al_cierre: n,
    llegan_pct: pct(n, total),
    cierre_reservan_pct: pct(dec.reservar || 0, n),          // OBJETIVO ≥ 50 %
    bloquean_fecha_pct: pct(dec.bloquear_fecha || 0, n),
    siguen_comparando_pct: pct(dec.seguir_comparando || 0, n),
    descartan_pct: pct(dec.descartar || 0, n),
    reservan_sobre_total_pct: pct(dec.reservar || 0, total),
    senal_aceptable_pct: pct(rs.filter(r => r.senal_aceptable).length, n),
    pasos: touch,
    ...(rs.some(r => r.journey) ? { recorrido: journeyStats(rs, total) } : {}),
    ...(rs.some(r => r.segunda) ? (() => {
      const second = rs.filter(r => r.segunda)
      const finalBook = rs.filter(r => r.decision === 'reservar' || r.segunda?.decision === 'reservar').length
      return {
        tras_bloqueo: {
          n: second.length,
          reservan_pct: pct(second.filter(r => r.segunda!.decision === 'reservar').length, second.length),
          descartan_definitivamente_pct: pct(second.filter(r => r.segunda!.decision === 'descartar_definitivamente').length, second.length),
          motivos_descarte: second.filter(r => r.segunda!.decision === 'descartar_definitivamente').map(r => r.segunda!.motivo_exacto_descarte).filter(Boolean).slice(0, 80),
          seguimiento_me_acerca_pct: pct(second.filter(r => r.segunda!.efecto_seguimiento === 'me_acerca').length, second.length),
          seguimiento_me_aleja_pct: pct(second.filter(r => r.segunda!.efecto_seguimiento === 'me_aleja').length, second.length),
        },
        cierre_final_reservan_pct: pct(finalBook, n),          // OBJETIVO ≥ 50 % (tras las 48 h)
        cierre_final_sobre_total_pct: pct(finalBook, total),
        piden_videollamada_pct: pct(rs.filter(r => r.pide_videollamada).length, n),
      }
    })() : {}),
  }
}
type Round3Close = RoundClose

/** Qué condiciones repiten (y la primera de cada uno), si reservarían, señal y canal. */
function interviewStats(rs: Round3[]) {
  const n = rs.length
  const count = (f: (r: Round3) => boolean) => pct(rs.filter(f).length, n)
  const senal = rs.map(r => Math.max(0, Math.min(100, Number(r.senal_maxima_pct) || 0))).sort((a, b) => a - b)
  const ranked = (f: (c: typeof CONDITIONS[number]) => number) =>
    Object.fromEntries(CONDITIONS.map(c => [c, f(c)] as const).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]))
  return {
    n,
    condicion_mencionada_pct: ranked(c => count(r => r.condiciones.some(x => x.categoria === c))),
    condicion_principal_pct: ranked(c => count(r => r.condiciones[0]?.categoria === c)),
    reservaria_si_se_cumple_pct: {
      si: count(r => r.reservaria_si_se_cumple === 'si'),
      probablemente: count(r => r.reservaria_si_se_cumple === 'probablemente'),
      no: count(r => r.reservaria_si_se_cumple === 'no'),
    },
    senal_maxima_mediana_pct: senal.length ? senal[Math.floor(senal.length / 2)] : null,
    canal_preferido_pct: Object.fromEntries(CHANNELS.map(c => [c, count(r => r.canal_preferido === c)] as const).filter(([, v]) => v > 0)),
  }
}

// ─── 4. Agregados e informe ───────────────────────────────────────

function avg(xs: number[]) { return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null }
function pct(n: number, d: number) { return d ? Math.round((n / d) * 1000) / 10 : 0 }

function aggregate(cfg: SimConfig, personas: Persona[], r1: Array<Round1 | null>, r2: Array<Round2 | null>, r3: Array<Round3 | null> = [], rc: Array<RoundClose | null> = []) {
  const segments = ['TODOS', ...cfg.segments.map(s => s.name)]
  const bySeg: Record<string, unknown> = {}
  for (const seg of segments) {
    const idx = personas.map((p, i) => i).filter(i => (seg === 'TODOS' || personas[i].segment === seg) && r1[i])
    const posts: Record<string, unknown> = {}
    for (const s of cfg.posts) {
      const rs = idx.map(i => r1[i]!.posts.find(x => x.id === s.id)).filter(Boolean) as Round1['posts']
      if (!rs.length) continue // post segmentado que este grupo no ve
      // Denominador: quienes vieron el post (con anuncios segmentados no lo ven todos)
      const seen = idx.filter(i => r1[i]!.posts.some(x => x.id === s.id))
      posts[s.id] = {
        n_vistos: rs.length,
        atencion: avg(rs.map(r => r.atencion)), confianza: avg(rs.map(r => r.confianza)),
        pct_entra_web_o_mas: pct(rs.filter(r => ACTION_RANK[r.accion] >= 2).length, rs.length),
        pct_ignora: pct(rs.filter(r => r.accion === 'ignorar').length, rs.length),
        pct_mejor_post_ronda2: pct(seen.filter(i => r2[i]?.mejor_post === s.id).length, seen.length),
      }
    }
    const final = idx.map(i => r2[i]?.accion_final).filter(Boolean) as Action[]
    bySeg[seg] = {
      n: idx.length,
      posts,
      ninguno_convence_pct: pct(idx.filter(i => r2[i]?.mejor_post === 'ninguno').length, idx.length),
      web: {
        confianza: avg(idx.map(i => r1[i]!.web.confianza)), claridad: avg(idx.map(i => r1[i]!.web.claridad)),
        acciones: Object.fromEntries(ACTIONS.map(a => [a, pct(idx.filter(i => r1[i]!.web.accion === a).length, idx.length)])),
      },
      perfil: {
        entiende_para_clientes_pct: pct(idx.filter(i => r1[i]!.perfil.entiende_que_es_para_clientes).length, idx.length),
        empeora_pct: pct(idx.filter(i => r1[i]!.perfil.efecto === 'empeora').length, idx.length),
      },
      accion_final_pct: Object.fromEntries(ACTIONS.map(a => [a, pct(final.filter(x => x === a).length, final.length)])),
      cambia_opinion_pct: pct(idx.filter(i => r2[i]?.cambia_opinion).length, idx.length),
      ...(r3.some(Boolean) ? { entrevista: interviewStats(idx.map(i => r3[i]).filter(Boolean) as Round3[]) } : {}),
      ...(cfg.closing ? { embudo: funnelStats(cfg, idx.length, idx.map(i => rc[i]).filter(Boolean) as RoundClose[]) } : {}),
    }
  }
  return bySeg
}

function samples(personas: Persona[], r1: Array<Round1 | null>, r2: Array<Round2 | null>, r3: Array<Round3 | null> = [], rc: Array<RoundClose | null> = [], max = 70) {
  return shuffle(personas.map((p, i) => ({ p, a: r1[i], b: r2[i], c: r3[i], d: rc[i] })).filter(x => x.a && x.b)).slice(0, max).map(({ p, a, b, c, d }) => ({
    quien: `${p.segment} · ${p.nombre}, ${p.edad}, ${p.ciudad} · ${p.presupuesto}`,
    comentarios: a!.posts.map(x => `[${x.id}] ${x.comentario} | objeción: ${x.objecion}`),
    web_falta: a!.web.lo_que_falta, web_objecion: a!.web.objecion, perfil: a!.perfil.reaccion,
    final: `${b!.accion_final} (${b!.mejor_post}): ${b!.motivo}`, para_reservar: b!.que_te_haria_reservar,
    ...(d ? { cierre: { decision: d.decision, motivo: d.motivo, falta: d.que_faltaria_para_reservar, senal_ok: d.senal_aceptable, pasos: d.puntos.map(x => `[${x.id}] ${x.efecto}: ${x.comentario}`), ...(d.proveedor ? { proveedor: d.proveedor, precio_proveedor: d.propuesta ? quoteBase(d.propuesta) : null, cobra_por: d.propuesta?.cobra_por, invitados: d.propuesta?.invitados } : {}), ...(d.segunda ? { tras_48h: d.segunda } : {}), ...(d.journey ? { recorrido: d.journey } : {}) } } : {}),
    ...(c ? { entrevista: { condiciones: c.condiciones, reservaria: c.reservaria_si_se_cumple, senal_max: c.senal_maxima_pct, canal: c.canal_preferido, literal: c.respuesta_literal } } : {}),
  }))
}

async function writeReport(cfg: SimConfig, agg: unknown, quotes: unknown, interview = false): Promise<string> {
  const resp = await client().messages.create({
    model: REPORT_MODEL,
    max_tokens: 16000,
    system: 'Eres analista de marketing de FiestaGo, un marketplace español de proveedores para bodas, comuniones y cumpleaños. Redactas para Mariano, el dueño, en español claro y directo, sin jerga. Recuerda siempre que son datos de una simulación con personas sintéticas: sirven para priorizar y descubrir objeciones, no son resultados reales.',
    messages: [{
      role: 'user',
      content: `Informe de una simulación de ${cfg.personas} clientes potenciales.\n\n` +
        (cfg.journey ? 'Todas las personas tienen una celebración en mente (bodas, comuniones, cumpleaños, fiestas sorpresa, despedidas, fiestas de empresa) y todas entran en la web y eligen un proveedor; cada proveedor enseña 3 reseñas en su perfil (hipotéticas si no tiene bastantes reales); precio único con IVA y garantía; documento de reserva FiestaGo. ' + 'SIMULACIÓN 12 · RECORRIDO COMPLETO: desde que nos ven por primera vez hasta la decisión con todos los detalles cerrados (ficha → propuesta + llamada → 48 h con respuestas, videollamada y llamada de seguimiento → detalles finales por escrito). Datos en embudo.recorrido: cuántos llegan a cada fase, qué deciden en cada una, dónde reservan, con_detalles_cerrados_reservan_pct (la pregunta clave: con todo cerrado, ¿reservan?) y reservan_total_pct frente al 50 %. Abre con ese embudo por segmento y dedica una sección a por qué no reservan quienes tenían ya todos los detalles (motivos_no_reservar_con_detalles), separando lo que depende de FiestaGo, de los proveedores o de la situación de cada cliente.\n\n' : '') +
        (cfg.hypothetical_complete ? 'SIMULACIÓN DE CONTROL (hipotética): los proveedores reales con la ficha completa (galería de trabajos parecidos, seguro de RC verificado, opiniones de Google). Sirve para saber si, con buena oferta, el proceso llega al 50 %; compárala con la anterior (proveedores tal como están) y separa lo que depende de los proveedores de lo que depende de FiestaGo.\n\n' : '') +
        (cfg.catalog === 'full_proposal' ? 'Desde la 11.ª: Reserva sin riesgo de 7 días, videollamada con el proveedor antes de pagar, detalle final por escrito, "Tu celebración" con el total del evento y lo que debe tener el local, y una sola cifra en todos los precios (en "embudo" verás piden_videollamada_pct). Desde la 9.ª: cada servicio es un proveedor independiente (la propuesta es solo de su servicio), precios con IVA incluido por personas, por horas o cerrados con precio por persona, qué no incluye, plan B, fecha confirmada, fotos de sus trabajos; las preguntas de garantía, pagos y cancelaciones las contesta FiestaGo y el seguimiento es una llamada de Mariano. ' + 'SIMULACIÓN DEL EMBUDO COMPLETO CON PROPUESTA ESCRITA (lo construido tras la 6.ª simulación, que dio 0 % de reservas en el cierre): cada persona que llega al cierre recibe una propuesta escrita de un proveedor REAL de FiestaGo con precio cerrado para su número de invitados, qué incluye y qué no, la señal en euros, las condiciones y sus opiniones de Google reales; luego la llamada de FiestaGo. Quien bloquea la fecha vuelve a decidir 48 h después, tras hablarlo en casa y recibir un seguimiento de ayuda; en esa segunda decisión solo puede reservar o descartarlo definitivamente diciendo el motivo exacto (motivo_exacto_descarte en la muestra): agrupa esos motivos y cuantifícalos, son la lista de lo que hay que arreglar. En "embudo": cierre_reservan_pct (en el primer momento), tras_bloqueo y cierre_final_reservan_pct (OBJETIVO ≥ 50 %). Abre el informe con el embudo completo en total y por segmento frente al 50 % y frente a la 6.ª simulación (en "previous"). Analiza qué pesa en la propuesta (precio frente a presupuesto, opiniones de Google, proveedores con o sin opiniones, qué incluye), qué dice quien decide con el cliente, y termina con "Qué falta para llegar al 50 %": palancas concretas ordenadas por impacto.\n\n' : '') +
        (cfg.catalog === 'full' ? 'SIMULACIÓN DEL EMBUDO COMPLETO: 1) ven posts, web y perfil (lo real de FiestaGo hoy); 2) leen opiniones de otros; 3) quien entra en la web o hace algo más pide presupuesto/llamada y vive el proceso real de cierre (respuesta del proveedor por FiestaGo, llamada de FiestaGo, recordatorio) y decide; 4) entrevista a todos. Datos del embudo en "embudo" de cada segmento. El OBJETIVO es que reserve al menos el 50 % de quienes llegan al cierre (cierre_reservan_pct). Abre el informe con el embudo completo (personas → llegan al cierre → reservan / bloquean / siguen comparando / descartan) en total y por segmento, frente al 50 %. Incluye una sección "Qué falta para llegar al 50 %" con palancas concretas ordenadas por impacto estimado, separando lo que mejora la llegada al cierre de lo que mejora el cierre.\n\n' : '') +
        (cfg.catalog === 'closing' ? 'ESCENARIO DE CIERRE DE VENTA: cada persona ya pidió presupuesto o llamada, recibió la respuesta del proveedor por FiestaGo, la llamada de FiestaGo y un recordatorio. "reservar" = paga la señal en FiestaGo; "apuntarse" = bloquea la fecha 48 h gratis o pide más información. El OBJETIVO es que al menos el 50 % RESERVE. Abre el informe con la tasa de cierre (reservar) y la de bloqueo (apuntarse) al final, en total y por segmento, frente al 50 %. Dedica una sección a "Qué falta para llegar al 50 %" con las palancas concretas ordenadas por impacto estimado (qué cambiar en la respuesta del proveedor, la llamada, el seguimiento, la web, el pago o la garantía).\n\n' : '') +
        (cfg.catalog === 'plan_fase1' ? 'En esta simulación la web y las redes son HIPOTÉTICAS: así quedarían tras aplicar el plan de confianza (primer paso sin pagar, señal y cancelación gratis 14 días, persona también el sábado, navegación por evento con packs de precio total, catálogo local con nombres, 11 reseñas reales de eventos fundadores y notas de Google de los proveedores). Cada persona solo ve los posts de su tipo de evento, como con anuncios segmentados (n_vistos). Preguntas clave, cada una con su sección: ¿qué objeciones desaparecen y cuáles quedan?; ¿aparecen ya intenciones de apuntarse o reservar, en qué segmento y por qué?; ¿qué parte del plan pesa más (para priorizar qué construir primero)?\n\n' : '') +
        (cfg.catalog === 'hypothetical_3' ? 'En esta simulación el catálogo es HIPOTÉTICO: 3 proveedores de cada servicio que cubren la zona de cada persona. La pregunta clave es si con ese mínimo ya compensa hacer marketing de clientes en una ciudad, o qué más haría falta (y para qué tipo de evento y servicio). Dedícale una sección propia con una recomendación clara.\n\n' : '') +
        (cfg.previous ? `IMPORTANTE: son las mismas personas de una simulación anterior (${cfg.previous.label}). Compara SIEMPRE con ella (confianza en la web, efecto del perfil, acciones finales, posts repetidos) y di qué ha mejorado y qué no. Agregados de la anterior (JSON):\n${JSON.stringify(cfg.previous.aggregates)}\n\n` : '') +
        `Posts probados:\n${cfg.posts.map(s => `[${s.id}] ${s.label}: ${s.text}`).join('\n\n')}\n\nAgregados por segmento (JSON):\n${JSON.stringify(agg)}\n\nMuestra de reacciones (JSON):\n${JSON.stringify(quotes)}\n\n` +
        (interview ? 'Al final hubo una ENTREVISTA directa a cada persona: "¿qué tendría que pasar exactamente para que reservaras?" (agregados en "entrevista" de cada segmento y respuestas en la muestra). Dedícale la sección 5 entera: por segmento, las condiciones que más se repiten y la principal (con %), cuántos reservarían si se cumplieran, la señal máxima mediana y el canal preferido, con 2-3 frases literales por segmento; termina con una lista "Para que reserven, hay que…" ordenada por impacto.\n\n' : '') +
        'Escribe el informe en Markdown con estas secciones:\n1. Resumen en 5 líneas' + (cfg.previous ? ' (empieza por el antes y el después)' : '') + '\n2. Qué mensaje gana, en general y por segmento (con las cifras), y qué tipo de post conviene hacer más\n3. La web: qué convence y qué frena (y las 5 objeciones más repetidas con frases literales)\n4. El perfil actual de Instagram/TikTok visto por un cliente\n5. Qué les haría reservar\n6. Recomendaciones concretas y priorizadas (posts, web, perfil)\n7. Qué conviene validar con experimentos reales y cómo medirlo\nLímites de la simulación al final, en 2-3 líneas.',
    }],
  })
  usage.calls++
  usage.input += resp.usage?.input_tokens || 0
  usage.output += resp.usage?.output_tokens || 0
  return resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
}

// ─── Orquestación ─────────────────────────────────────────────────

export async function runClientSim(supabase: SupabaseClient, runId: string) {
  const { data: run } = await supabase.from('sim_runs').select('id, config, personas, round1, round2, round_close').eq('id', runId).single()
  if (!run) throw new Error(`No existe la simulación ${runId}`)
  const save = (patch: Record<string, unknown>) => supabase.from('sim_runs').update({ ...patch, usage, updated_at: new Date().toISOString() }).eq('id', runId)

  let cfg = run.config as SimConfig | null
  if (cfg?.catalog === 'full_proposal' && !cfg.posts) {
    const base = defaultConfig({ total: 0, byCategory: {}, cities: [] })
    cfg = { ...base, ...proposalConfig(), ...cfg }
  } else if (cfg?.catalog === 'full' && !cfg.posts) {
    const base = defaultConfig({ total: 0, byCategory: {}, cities: [] })
    cfg = { ...base, ...fullConfig(), ...cfg }
  } else if (cfg?.catalog === 'closing' && !cfg.posts) {
    const base = defaultConfig({ total: 0, byCategory: {}, cities: [] })
    cfg = { ...base, ...closingConfig(), ...cfg }
  } else if (cfg?.catalog === 'plan_fase1' && !cfg.posts) {
    const base = defaultConfig({ total: 0, byCategory: {}, cities: [] })
    cfg = { ...base, ...planConfig(), ...cfg }
  } else if (!cfg || !cfg.posts) {
    let catalog: { total: number; byCategory: Record<string, number>; cities: string[] }
    if (cfg?.catalog === 'hypothetical_3') {
      // Catálogo hipotético: 3 proveedores por categoría que cubren la zona de
      // cada persona. Sirve para saber si con ese mínimo ya compensa hacer
      // marketing de clientes en una ciudad (ceo_settings.supply_threshold).
      const byCategory = Object.fromEntries(CATEGORIES.map((c: any) => [c.label, 3]))
      catalog = { total: CATEGORIES.length * 3, byCategory, cities: ['En tu zona hay 3 proveedores de cada servicio, cada uno con su ficha, fotos de trabajos y precio, y todos cubren tu municipio'] }
    } else {
      const { data: provs } = await supabase.from('providers').select('category, city').eq('status', 'approved')
      const byCategory: Record<string, number> = {}
      for (const p of provs || []) byCategory[p.category] = (byCategory[p.category] || 0) + 1
      catalog = { total: provs?.length || 0, byCategory, cities: [`Ciudades: ${Array.from(new Set((provs || []).map(p => p.city))).join(', ')}. La mayoría están en Valencia`] }
    }
    cfg = { ...defaultConfig(catalog), ...(cfg || {}) }
  }

  await save({ status: 'personas', config: cfg })
  // Si la fila ya trae personas (p. ej. copiadas de otra simulación), se reutilizan
  if (cfg.journey && !(Array.isArray(run.personas) && run.personas.length)) cfg = { ...cfg, segments: CELEBRATION_SEGMENTS }
  const personas: Persona[] = Array.isArray(run.personas) && run.personas.length ? run.personas : await generatePersonas(cfg)
  await save({ status: 'ronda1', personas, config: cfg })

  // Reanudable: si Netlify corta la función a los 15 min y la reintenta,
  // se aprovecha lo ya guardado (rondas completas y cierres hechos).
  const full = (x: unknown): x is Array<any> => Array.isArray(x) && x.length === personas.length && x.filter(Boolean).length >= personas.length / 2
  const r1: Array<Round1 | null> = full(run.round1) ? run.round1 : await pool(personas, p => runRound1(cfg!, p))
  await save({ status: 'ronda2', round1: r1 })
  if (r1.filter(Boolean).length < personas.length / 2) throw new Error(`Ronda 1: solo ${r1.filter(Boolean).length}/${personas.length} respuestas. Último error: ${usage.last_error}`)

  // Cada persona lee 6 comentarios de otras, de segmentos variados
  const voices = personas.flatMap((p, i) => (r1[i]?.posts || []).map(x => ({ i, text: `${p.nombre} (${p.segment.toLowerCase()}), sobre el post "${cfg!.posts.find(s => s.id === x.id)?.label}": "${x.comentario}"` })))
  const r2: Array<Round2 | null> = full(run.round2) ? run.round2 : await pool(personas, (p, i) => r1[i]
    ? runRound2(cfg!, p, r1[i]!, shuffle(voices.filter(v => v.i !== i)).slice(0, 6).map(v => v.text))
    : Promise.reject(new Error('sin ronda 1')))
  await save({ status: cfg.closing ? 'cierre' : 'entrevista', round2: r2 })

  // Cierre: quien entró en la web o hizo algo más vive el proceso real
  let rc: Array<RoundClose | null> = personas.map(() => null)
  if (cfg.closing) {
    let provs = cfg.closing.proposal ? await loadRealProviders(supabase) : []
    // Control: ¿llega el proceso al 50 % con fichas completas? (hipotético)
    if (cfg.journey) {
      // Las reseñas de la simulación se guardan para que un reintento use las mismas
      const cached = (cfg as any).sim_reviews as Record<string, RealProvider['google_reviews']> | undefined
      if (cached) provs = provs.map(x => cached[x.id] ? { ...x, google_reviews: cached[x.id], google_rating: x.google_rating || 4.7, google_rating_count: Math.max(x.google_rating_count || 0, 3) } : x)
      else {
        provs = await withThreeReviews(provs)
        cfg = { ...cfg, sim_reviews: Object.fromEntries(provs.map(x => [x.id, x.google_reviews])) } as SimConfig
        await save({ config: cfg })
      }
    }
    if (cfg.hypothetical_complete) provs = provs.map(x => ({
      ...x, hypothetical: true, photos: Math.max(x.photos, 12),
      google_rating: x.google_rating || 4.8, google_rating_count: Math.max(x.google_rating_count || 0, 25),
    }))
    const closeOne = async (p: Persona, i: number): Promise<RoundClose | null> => {
      if (!cfg!.closing!.proposal) return runClose(cfg!, p, r2[i]!)
      // Propuesta escrita de un proveedor real, para su evento
      const avail = Array.from(new Set(provs.filter(x => /valencia|paterna/i.test(x.city || '')).map(x => x.category)))
      const choice = avail.length ? await chooseCategory(p, avail).catch(() => null) : null
      const prov = pickProvider(provs, p, choice?.categoria)
      if (!prov) return runClose(cfg!, p, r2[i]!)
      const q = await generateQuote(p, prov, choice?.que_le_pides)
      const text = proposalText(p, prov, q)
      if (cfg!.journey) return runJourney(cfg!, p, r2[i]!, prov, q, text)
      const tps = cfg!.closing!.touchpoints.filter(t => t.id !== 'seguimiento_ayuda')
        .map(t => t.id === 'propuesta_escrita' ? { ...t, text } : t)
      const first = await runClose(cfg!, p, r2[i]!, tps)
      const out: RoundClose = { ...first, proveedor: `${prov.name} (${prov.category})`, propuesta: q }
      const qs = (first.preguntas_al_proveedor || []).filter(Boolean).slice(0, 3)
      if (first.decision === 'bloquear_fecha') {
        out.respuestas = await answerQuestions(prov, q, qs, text).catch(() => [])
        if (first.pide_videollamada) out.videollamada = await videoCall(p, prov, q)
        out.segunda = await runClose2(cfg!, p, first, text, out.respuestas, out.videollamada)
      }
      return out
    }
    const prev: Array<RoundClose | null> = Array.isArray(run.round_close) && run.round_close.length === personas.length ? run.round_close : personas.map(() => null)
    let done = 0
    rc = await pool(personas, async (p, i) => {
      if (prev[i]) return prev[i]
      // En el recorrido completo todos entran en la web y eligen proveedor
      if (!r2[i] || (!cfg!.journey && ACTION_RANK[r2[i]!.accion_final] < 2)) return null
      const r = await closeOne(p, i)
      // Guardado parcial cada 10 cierres, por si la función se corta
      if (r && ++done % 10 === 0) { prev[i] = r; await save({ round_close: prev }) }
      else if (r) prev[i] = r
      return r
    })
    await save({ status: 'entrevista', round_close: rc })
  }

  // Entrevista: qué haría que cada persona reservase
  // En el recorrido completo no hay entrevista: la decisión final ya es la respuesta
  // (y así cabe en los 15 min de la función)
  const r3 = cfg.journey ? personas.map(() => null) : await pool(personas, (p, i) => r2[i] ? runRound3(p, r2[i]!, rc[i]) : Promise.reject(new Error('sin ronda 2')))
  const agg = aggregate(cfg, personas, r1, r2, r3, rc)
  await save({ status: 'informe', round3: r3, aggregates: agg })

  const report = await writeReport(cfg, agg, samples(personas, r1, r2, r3, rc), r3.some(Boolean))
  await save({ status: 'done', report })
  return { personas: personas.length, ok1: r1.filter(Boolean).length, ok2: r2.filter(Boolean).length, ok3: r3.filter(Boolean).length, usage }
}
