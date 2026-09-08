/**
 * Cliente mínimo de fal.ai sobre la queue API.
 *
 * Los modelos de vídeo tardan minutos, así que fal.run (síncrono) se queda
 * corto: usamos queue.fal.run + polling, que es lo que aguanta clips largos.
 */
const QUEUE = 'https://queue.fal.run'

function apiKey() {
  const k = process.env.FAL_KEY
  if (!k) {
    console.error('❌ Falta FAL_KEY · cópiala de https://fal.ai/dashboard/keys')
    console.error('   Formato: <UUID>:<hex>. Ponla en tools/video-marketing/.env')
    process.exit(1)
  }
  return k
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * Encola un trabajo y espera al resultado.
 * @param {string} model  p.ej. 'fal-ai/flux-pro/v1.1'
 * @param {object} input  payload del modelo
 * @param {(s:string)=>void} onTick  callback de progreso
 */
export async function falRun(model, input, onTick = () => {}) {
  const auth = { Authorization: `Key ${apiKey()}`, 'Content-Type': 'application/json' }

  const submit = await fetch(`${QUEUE}/${model}`, {
    method: 'POST', headers: auth, body: JSON.stringify(input),
  })
  if (!submit.ok) {
    throw new Error(`fal submit ${submit.status}: ${(await submit.text()).slice(0, 400)}`)
  }
  const { status_url, response_url } = await submit.json()

  // Polling con backoff suave: 3s al principio, hasta 15s.
  let delay = 3000
  for (let i = 0; i < 400; i++) {
    await sleep(delay)
    delay = Math.min(delay * 1.15, 15000)

    const st = await fetch(status_url, { headers: auth })
    if (!st.ok) throw new Error(`fal status ${st.status}: ${(await st.text()).slice(0, 200)}`)
    const s = await st.json()

    onTick(s.status)
    if (s.status === 'COMPLETED') break
    if (s.status === 'FAILED' || s.status === 'ERROR') {
      throw new Error(`fal job falló: ${JSON.stringify(s).slice(0, 400)}`)
    }
  }

  const res = await fetch(response_url, { headers: auth })
  if (!res.ok) throw new Error(`fal result ${res.status}: ${(await res.text()).slice(0, 400)}`)
  const out = await res.json()
  if (out.error) throw new Error(`fal error: ${JSON.stringify(out.error).slice(0, 300)}`)
  return out
}

/** Descarga una URL a disco. */
export async function download(url, destPath) {
  const { writeFileSync } = await import('node:fs')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`descarga ${res.status} de ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(destPath, buf)
  return buf.length
}
