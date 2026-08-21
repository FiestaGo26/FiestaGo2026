// ═══════════════════════════════════════════════════════════════════
// Verificador de nóminas — X Convenio de Enseñanza y Formación No Reglada
// Lee una nómina en PDF, extrae los datos con Claude y comprueba si el
// salario y las cotizaciones a la Seguridad Social coinciden con lo que
// corresponde según la categoría/grupo profesional y las horas trabajadas
// a la semana.
//
// USO:
//   node verificar-nomina.mjs <ruta-a-nomina.pdf> [--out=reporte.json]
//
// Requiere ANTHROPIC_API_KEY en .env (copia .env.example).
//
// AVISO: esta herramienta es una ayuda de revisión, no asesoramiento
// legal. Antes de reclamar o tomar decisiones, contrasta el resultado
// con un/a graduado/a social o con el sindicato del sector.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const envFile = readFileSync(resolve(__dirname, '.env'), 'utf-8')
    envFile.split('\n').forEach(line => {
      const t = line.trim()
      if (!t || t.startsWith('#')) return
      const [key, ...vals] = t.split('=')
      if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
    })
  } catch {
    console.error('❌ No se encontró tools/verificador-nomina-convenio/.env (copia .env.example y añade tu ANTHROPIC_API_KEY)')
    process.exit(1)
  }
}
loadEnv()

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.MODEL || 'claude-sonnet-5'

const CONVENIO = JSON.parse(readFileSync(resolve(__dirname, 'convenio-x-ensenanza-no-reglada.json'), 'utf-8'))
const COTIZACION = JSON.parse(readFileSync(resolve(__dirname, 'cotizacion-ss.json'), 'utf-8'))

function log(msg) { console.log(msg) }
function money(n) { return typeof n === 'number' ? n.toFixed(2) + ' €' : 'n/d' }
function pct(n) { return typeof n === 'number' ? (n * 100).toFixed(2) + ' %' : 'n/d' }

// ── 1. Leer PDF y pedir a Claude que extraiga los datos estructurados ──

async function extraerDatosNomina(pdfPath) {
  const pdfBuffer = readFileSync(pdfPath)
  const base64 = pdfBuffer.toString('base64')

  const categoriasConocidas = CONVENIO.grupos.flatMap(g =>
    g.categorias.map(c => `${g.id} · ${g.nombre} → "${c.id}" (${c.nombre})`)
  ).join('\n')

  const system = `Eres un experto en nóminas españolas y en el X Convenio Colectivo Estatal de Enseñanza y Formación No Reglada.
Vas a recibir el PDF de una nómina. Extrae los datos y devuelve EXCLUSIVAMENTE un JSON válido (sin texto antes ni después, sin bloques markdown), con este esquema exacto:

{
  "periodo": "YYYY-MM",
  "anio": 2026,
  "empresa": "string o null",
  "trabajador": "string o null",
  "categoria_declarada_nomina": "texto literal de la categoría/grupo profesional tal como aparece en la nómina",
  "categoria_convenio_id": "uno de los ids de esta lista, el que mejor encaje, o null si ninguno encaja:\n${categoriasConocidas}",
  "grupo_convenio_id": "I, II, III o IV según la lista anterior, o null",
  "tipo_contrato": "indefinido | temporal | null",
  "jornada_porcentaje": 100,
  "horas_semana": null,
  "salario_base_nomina": 0,
  "complementos": [{ "concepto": "string", "importe": 0 }],
  "total_devengado": 0,
  "base_cotizacion_contingencias_comunes": 0,
  "cuota_trabajador_contingencias_comunes": 0,
  "cuota_trabajador_desempleo": 0,
  "cuota_trabajador_formacion_profesional": 0,
  "cuota_trabajador_mei": 0,
  "total_cuota_trabajador_ss": 0,
  "retencion_irpf_importe": 0,
  "liquido_a_percibir": 0,
  "notas_extraccion": "cualquier dato que no hayas podido leer con confianza"
}

Si un campo no aparece en la nómina o no lo puedes leer con seguridad, pon null (o 0 solo si el concepto claramente no aplica, nunca inventes cifras). "horas_semana" es el número de horas que el trabajador tiene contratadas/trabaja a la semana (de clase, de conducción, de atención, etc. según su puesto) — extráelo si la nómina o el contrato adjunto lo indican explícitamente o si puede deducirse con seguridad del texto (p. ej. "20 horas semanales", "media jornada de 20h/sem"); si no aparece ninguna cifra de horas semanales, pon null y usa "jornada_porcentaje" en su lugar.

IMPORTANTE sobre categorías: "Monitor/a" o "Monitor-animador/a" pertenece al GRUPO III (personal de servicios), no al Grupo I docente, aunque trabaje dando clases o actividades — es un error habitual clasificarlo como docente. "Profesor/a Titular" sí es Grupo I.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extrae los datos de esta nómina siguiendo exactamente el esquema JSON indicado.' },
        ],
      }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Claude API: ${data.error.message}`)
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim()
  const cleaned = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('No se pudo interpretar la respuesta de Claude como JSON:\n' + text)
  }
}

// ── 2. Buscar la categoría del convenio y su salario tabla ──

function buscarCategoria(grupoId, categoriaId) {
  const grupo = CONVENIO.grupos.find(g => g.id === grupoId)
  if (!grupo) return { grupo: null, categoria: null }
  const categoria = grupo.categorias.find(c => c.id === categoriaId)
  return { grupo, categoria: categoria || null }
}

// Semanas efectivamente trabajadas al año usadas para aproximar una referencia
// semanal cuando el convenio no la fija explícitamente (52 semanas - vacaciones).
const SEMANAS_TRABAJADAS_APROX = 44

function jornadaSemanalReferencia(grupo) {
  if (grupo.jornada_semanal_referencia_horas) {
    return { horas: grupo.jornada_semanal_referencia_horas, aproximada: false }
  }
  if (grupo.jornada_anual_horas) {
    return { horas: grupo.jornada_anual_horas / SEMANAS_TRABAJADAS_APROX, aproximada: true }
  }
  return { horas: null, aproximada: false }
}

function salarioEsperado(grupo, categoria, anio, jornadaPorcentaje, horasSemana) {
  if (!categoria) return { valor: null, motivo: 'Categoría del convenio no identificada para esta nómina.' }
  const tabla = categoria.salario_base_mensual?.[String(anio)]
  if (tabla == null) {
    return { valor: null, motivo: `Falta rellenar el salario base de "${categoria.nombre}" para ${anio} en convenio-x-ensenanza-no-reglada.json.` }
  }
  // Prorratear por horas/semana trabajadas frente a la jornada semanal de referencia del grupo.
  if (horasSemana != null) {
    const ref = jornadaSemanalReferencia(grupo)
    if (ref.horas) {
      const factor = Math.min(horasSemana / ref.horas, 1)
      const aviso = ref.aproximada ? ' [referencia semanal APROXIMADA, no confirmada en fuente oficial — verificar]' : ''
      return { valor: tabla * factor, motivo: `Prorrateado por horas/semana: ${horasSemana}h / ${ref.horas.toFixed(2)}h (jornada completa semanal de referencia, Grupo ${grupo.id}).${aviso}` }
    }
  }
  // Si no hay horas/semana o el grupo no tiene jornada de referencia, prorratear por % de jornada declarado en la nómina.
  const factor = (typeof jornadaPorcentaje === 'number' ? jornadaPorcentaje : 100) / 100
  return { valor: tabla * factor, motivo: `Prorrateado por jornada declarada: ${jornadaPorcentaje ?? 100}% (no se pudo usar horas/semana).` }
}

// ── 3. Cotizaciones SS esperadas sobre la base que declara la propia nómina ──

function cotizacionEsperada(anio, tipoContrato, baseCotizacion) {
  const tipos = COTIZACION.tipos_trabajador[String(anio)]
  if (!tipos || baseCotizacion == null) return null
  const desempleo = tipoContrato === 'temporal' ? tipos.desempleo_temporal : tipos.desempleo_indefinido
  return {
    contingencias_comunes: baseCotizacion * tipos.contingencias_comunes,
    desempleo: baseCotizacion * desempleo,
    formacion_profesional: baseCotizacion * tipos.formacion_profesional,
    mei: baseCotizacion * tipos.mei,
    total: baseCotizacion * (tipos.contingencias_comunes + desempleo + tipos.formacion_profesional + tipos.mei),
  }
}

// ── 4. Informe ──

function verdict(esperado, real, tolerancia = 1) {
  if (esperado == null || real == null) return '⚪ Sin datos suficientes'
  const diff = real - esperado
  if (Math.abs(diff) <= tolerancia) return '✅ Correcto'
  return diff < 0 ? '❌ Nómina paga POR DEBAJO de lo esperado' : '⚠️ Nómina paga por ENCIMA de lo esperado (revisar igualmente)'
}

async function main() {
  const pdfPath = process.argv[2]
  const outArg = process.argv.find(a => a.startsWith('--out='))
  const outPath = outArg ? outArg.split('=')[1] : null

  if (!pdfPath) {
    console.error('Uso: node verificar-nomina.mjs <ruta-a-nomina.pdf> [--out=reporte.json]')
    process.exit(1)
  }
  if (!ANTHROPIC_KEY) {
    console.error('❌ Falta ANTHROPIC_API_KEY en tools/verificador-nomina-convenio/.env')
    process.exit(1)
  }

  log(`📄 Leyendo nómina: ${pdfPath}`)
  const datos = await extraerDatosNomina(resolve(pdfPath))
  log('✅ Datos extraídos:\n' + JSON.stringify(datos, null, 2))

  const { grupo, categoria } = buscarCategoria(datos.grupo_convenio_id, datos.categoria_convenio_id)
  const salEsp = salarioEsperado(grupo, categoria, datos.anio, datos.jornada_porcentaje, datos.horas_semana)
  const cotEsp = cotizacionEsperada(datos.anio, datos.tipo_contrato, datos.base_cotizacion_contingencias_comunes)

  const informe = {
    convenio: CONVENIO.convenio,
    boe: CONVENIO.boe,
    datos_nomina: datos,
    verificacion_salario: {
      categoria_convenio: categoria ? `${grupo.id} · ${categoria.nombre}` : 'No identificada',
      salario_esperado: salEsp.valor,
      motivo: salEsp.motivo,
      salario_nomina: datos.salario_base_nomina,
      diferencia: salEsp.valor != null && datos.salario_base_nomina != null ? datos.salario_base_nomina - salEsp.valor : null,
      veredicto: verdict(salEsp.valor, datos.salario_base_nomina),
    },
    verificacion_cotizacion_ss: cotEsp ? {
      base_cotizacion_usada: datos.base_cotizacion_contingencias_comunes,
      tipo_contrato: datos.tipo_contrato,
      esperado: {
        contingencias_comunes: cotEsp.contingencias_comunes,
        desempleo: cotEsp.desempleo,
        formacion_profesional: cotEsp.formacion_profesional,
        mei: cotEsp.mei,
        total: cotEsp.total,
      },
      real: {
        contingencias_comunes: datos.cuota_trabajador_contingencias_comunes,
        desempleo: datos.cuota_trabajador_desempleo,
        formacion_profesional: datos.cuota_trabajador_formacion_profesional,
        mei: datos.cuota_trabajador_mei,
        total: datos.total_cuota_trabajador_ss,
      },
      veredicto_total: verdict(cotEsp.total, datos.total_cuota_trabajador_ss, 0.5),
    } : { motivo: `No hay tipos de cotización cargados para el año ${datos.anio} en cotizacion-ss.json, o falta la base de cotización en la nómina.` },
  }

  log('\n════════════════════════════════════════')
  log(`📋 INFORME — ${CONVENIO.convenio}`)
  log('════════════════════════════════════════')
  log(`Periodo: ${datos.periodo}   Trabajador: ${datos.trabajador ?? 'n/d'}`)
  log(`Categoría declarada en nómina: ${datos.categoria_declarada_nomina ?? 'n/d'}`)
  log(`Categoría convenio identificada: ${informe.verificacion_salario.categoria_convenio}`)
  log('')
  log('— Salario según convenio —')
  log(`  Esperado: ${money(salEsp.valor)}  (${salEsp.motivo})`)
  log(`  En nómina: ${money(datos.salario_base_nomina)}`)
  log(`  Diferencia: ${informe.verificacion_salario.diferencia != null ? money(informe.verificacion_salario.diferencia) : 'n/d'}`)
  log(`  Veredicto: ${informe.verificacion_salario.veredicto}`)
  log('')
  log('— Cotización SS (cuota trabajador) —')
  if (cotEsp) {
    log(`  Base usada: ${money(datos.base_cotizacion_contingencias_comunes)}  (contrato: ${datos.tipo_contrato ?? 'n/d'})`)
    log(`  Total esperado: ${money(cotEsp.total)}   Total en nómina: ${money(datos.total_cuota_trabajador_ss)}`)
    log(`  Veredicto: ${informe.verificacion_cotizacion_ss.veredicto_total}`)
  } else {
    log(`  ⚪ ${informe.verificacion_cotizacion_ss.motivo}`)
  }
  log('════════════════════════════════════════')
  log('⚠️  Esta comprobación es una ayuda de revisión, no asesoramiento legal. Contrasta cualquier discrepancia con un/a graduado/a social o el sindicato del sector antes de actuar.')

  if (outPath) {
    writeFileSync(resolve(outPath), JSON.stringify(informe, null, 2))
    log(`\n💾 Informe guardado en ${outPath}`)
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
