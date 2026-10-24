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

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIES } from '@/lib/constants'

const PERSONA_MODEL = process.env.SIM_PERSONA_MODEL || 'claude-sonnet-5-5'
const AGENT_MODEL   = process.env.SIM_AGENT_MODEL   || 'claude-haiku-5-5'
const REPORT_MODEL  = process.env.SIM_REPORT_MODEL  || 'claude-opus-5-5'
const CONCURRENCY   = 12

export type Stimulus = { id: string; label: string; text: string }

export type SimConfig = {
  personas: number
  segments: Array<{ name: string; share: number; brief: string }>
  web: string
  posts: Stimulus[]
  profile: string
  /** Agregados de una simulación anterior con las mismas personas, para comparar. */
  previous?: { label: string; aggregates: unknown }
  /** 'hypothetical_3': catálogo simulado de 3 proveedores por categoría en la zona. */
  catalog?: 'real' | 'hypothetical_3'
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
    posts: { type: 'array', items: obj({ id: { type: 'string', enum: cfg.posts.map(s => s.id) }, atencion: int15, confianza: int15, accion: action, comentario: str, objecion: str }) },
    perfil: obj({ entiende_que_es_para_clientes: { type: 'boolean' }, efecto: { type: 'string', enum: ['mejora', 'neutro', 'empeora'] }, reaccion: str }),
  })
  const posts = shuffle(cfg.posts).map(s => `[${s.id}]\n${s.text}`).join('\n\n')
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
    mejor_post: { type: 'string', enum: [...cfg.posts.map(s => s.id), 'ninguno'] },
    cambia_opinion: { type: 'boolean' }, accion_final: action, motivo: str, que_te_haria_reservar: str,
  })
  const mine = r1.posts.map(x => `[${x.id}] atención ${x.atencion}, confianza ${x.confianza}, ${x.accion}: "${x.comentario}"`).join('\n')
  return askJson<Round2>(AGENT_MODEL, AGENT_SYSTEM, personaCard(p) + '\n\n' +
    `Ayer viste los posts y la web de FiestaGo. Tu reacción fue:\n${mine}\nWeb: confianza ${r1.web.confianza}, ${r1.web.accion}. Te faltaba: ${r1.web.lo_que_falta}\n\n` +
    `Hoy, en los comentarios de esos posts y en un grupo de WhatsApp, lees lo que opinan otras personas:\n${others.map(o => `- ${o}`).join('\n')}\n\n` +
    'Con eso, ¿qué post te convenció más (o ninguno)? ¿Cambias de opinión? ¿Qué harías finalmente con FiestaGo para tu evento, y por qué? ¿Qué tendría que pasar para que reservaras?',
    schema, 1200)
}

// ─── 4. Agregados e informe ───────────────────────────────────────

function avg(xs: number[]) { return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null }
function pct(n: number, d: number) { return d ? Math.round((n / d) * 1000) / 10 : 0 }

function aggregate(cfg: SimConfig, personas: Persona[], r1: Array<Round1 | null>, r2: Array<Round2 | null>) {
  const segments = ['TODOS', ...cfg.segments.map(s => s.name)]
  const bySeg: Record<string, unknown> = {}
  for (const seg of segments) {
    const idx = personas.map((p, i) => i).filter(i => (seg === 'TODOS' || personas[i].segment === seg) && r1[i])
    const posts: Record<string, unknown> = {}
    for (const s of cfg.posts) {
      const rs = idx.map(i => r1[i]!.posts.find(x => x.id === s.id)).filter(Boolean) as Round1['posts']
      posts[s.id] = {
        atencion: avg(rs.map(r => r.atencion)), confianza: avg(rs.map(r => r.confianza)),
        pct_entra_web_o_mas: pct(rs.filter(r => ACTION_RANK[r.accion] >= 2).length, rs.length),
        pct_ignora: pct(rs.filter(r => r.accion === 'ignorar').length, rs.length),
        pct_mejor_post_ronda2: pct(idx.filter(i => r2[i]?.mejor_post === s.id).length, idx.length),
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
    }
  }
  return bySeg
}

function samples(personas: Persona[], r1: Array<Round1 | null>, r2: Array<Round2 | null>, max = 70) {
  return shuffle(personas.map((p, i) => ({ p, a: r1[i], b: r2[i] })).filter(x => x.a && x.b)).slice(0, max).map(({ p, a, b }) => ({
    quien: `${p.segment} · ${p.nombre}, ${p.edad}, ${p.ciudad} · ${p.presupuesto}`,
    comentarios: a!.posts.map(x => `[${x.id}] ${x.comentario} | objeción: ${x.objecion}`),
    web_falta: a!.web.lo_que_falta, web_objecion: a!.web.objecion, perfil: a!.perfil.reaccion,
    final: `${b!.accion_final} (${b!.mejor_post}): ${b!.motivo}`, para_reservar: b!.que_te_haria_reservar,
  }))
}

async function writeReport(cfg: SimConfig, agg: unknown, quotes: unknown): Promise<string> {
  const resp = await client().messages.create({
    model: REPORT_MODEL,
    max_tokens: 16000,
    system: 'Eres analista de marketing de FiestaGo, un marketplace español de proveedores para bodas, comuniones y cumpleaños. Redactas para Mariano, el dueño, en español claro y directo, sin jerga. Recuerda siempre que son datos de una simulación con personas sintéticas: sirven para priorizar y descubrir objeciones, no son resultados reales.',
    messages: [{
      role: 'user',
      content: `Informe de una simulación de ${cfg.personas} clientes potenciales.\n\n` +
        (cfg.catalog === 'hypothetical_3' ? 'En esta simulación el catálogo es HIPOTÉTICO: 3 proveedores de cada servicio que cubren la zona de cada persona. La pregunta clave es si con ese mínimo ya compensa hacer marketing de clientes en una ciudad, o qué más haría falta (y para qué tipo de evento y servicio). Dedícale una sección propia con una recomendación clara.\n\n' : '') +
        (cfg.previous ? `IMPORTANTE: son las mismas personas de una simulación anterior (${cfg.previous.label}). Compara SIEMPRE con ella (confianza en la web, efecto del perfil, acciones finales, posts repetidos) y di qué ha mejorado y qué no. Agregados de la anterior (JSON):\n${JSON.stringify(cfg.previous.aggregates)}\n\n` : '') +
        `Posts probados:\n${cfg.posts.map(s => `[${s.id}] ${s.label}: ${s.text}`).join('\n\n')}\n\nAgregados por segmento (JSON):\n${JSON.stringify(agg)}\n\nMuestra de reacciones (JSON):\n${JSON.stringify(quotes)}\n\n` +
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
  const { data: run } = await supabase.from('sim_runs').select('id, config, personas').eq('id', runId).single()
  if (!run) throw new Error(`No existe la simulación ${runId}`)
  const save = (patch: Record<string, unknown>) => supabase.from('sim_runs').update({ ...patch, usage, updated_at: new Date().toISOString() }).eq('id', runId)

  let cfg = run.config as SimConfig | null
  if (!cfg || !cfg.posts) {
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
  const personas: Persona[] = Array.isArray(run.personas) && run.personas.length ? run.personas : await generatePersonas(cfg)
  await save({ status: 'ronda1', personas })

  const r1 = await pool(personas, p => runRound1(cfg!, p))
  await save({ status: 'ronda2', round1: r1 })
  if (r1.filter(Boolean).length < personas.length / 2) throw new Error(`Ronda 1: solo ${r1.filter(Boolean).length}/${personas.length} respuestas. Último error: ${usage.last_error}`)

  // Cada persona lee 6 comentarios de otras, de segmentos variados
  const voices = personas.flatMap((p, i) => (r1[i]?.posts || []).map(x => ({ i, text: `${p.nombre} (${p.segment.toLowerCase()}), sobre el post "${cfg!.posts.find(s => s.id === x.id)?.label}": "${x.comentario}"` })))
  const r2 = await pool(personas, (p, i) => r1[i]
    ? runRound2(cfg!, p, r1[i]!, shuffle(voices.filter(v => v.i !== i)).slice(0, 6).map(v => v.text))
    : Promise.reject(new Error('sin ronda 1')))
  const agg = aggregate(cfg, personas, r1, r2)
  await save({ status: 'informe', round2: r2, aggregates: agg })

  const report = await writeReport(cfg, agg, samples(personas, r1, r2))
  await save({ status: 'done', report })
  return { personas: personas.length, ok1: r1.filter(Boolean).length, ok2: r2.filter(Boolean).length, usage }
}
