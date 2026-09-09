/**
 * Carga tools/video-marketing/.env si existe.
 *
 * Node 22 trae process.loadEnvFile() nativo, así que no hace falta dotenv.
 * Las variables que ya vengan del entorno mandan sobre el fichero.
 */
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')

if (existsSync(ENV_PATH)) {
  try {
    process.loadEnvFile(ENV_PATH)
  } catch (e) {
    console.warn(`⚠  No pude leer .env (${e.message}) · uso solo las variables del entorno`)
  }
}
