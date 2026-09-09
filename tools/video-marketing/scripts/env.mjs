/**
 * Carga tools/video-marketing/.env si existe.
 *
 * No usamos process.loadEnvFile() porque solo entiende UTF-8 sin BOM, y en
 * Windows `echo "X=1" > .env` desde PowerShell escribe UTF-16 con BOM: el
 * fichero se ignoraba en silencio y el script decía que faltaba la clave
 * aunque estuviera puesta. Aquí detectamos la codificación por el BOM.
 *
 * Las variables que ya vengan del entorno mandan sobre el fichero.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')

/** Decodifica el buffer mirando el BOM: UTF-16 LE/BE, UTF-8 con BOM, o UTF-8. */
function decode(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le')
  if (buf[0] === 0xfe && buf[1] === 0xff) return buf.subarray(2).swap16().toString('utf16le')
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8')
  return buf.toString('utf8')
}

function parse(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    if (!key) continue
    let value = line.slice(eq + 1).trim()
    // Quitar comillas si las hay: PowerShell y copy-paste las cuelan a menudo.
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

if (existsSync(ENV_PATH)) {
  try {
    for (const [k, v] of Object.entries(parse(decode(readFileSync(ENV_PATH))))) {
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch (e) {
    console.warn(`⚠  No pude leer .env (${e.message}) · uso solo las variables del entorno`)
  }
}
