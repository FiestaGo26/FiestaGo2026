// ═══════════════════════════════════════════════════════════════════
// FiestaGo Content Generator — fal.ai (Flux 1.1 Pro + Kling 3.0)
//
// USO:
//   node fiegago-content-gen.mjs              # muestra qué se va a generar
//   node fiegago-content-gen.mjs --confirm    # genera de verdad
//   node fiegago-content-gen.mjs --confirm --videos  # imágenes + vídeos
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ── Cargar .env ───────────────────────────────────────────────────
function loadEnv() {
  try {
    const t = readFileSync(resolve('.env'), 'utf-8')
    t.split('\n').forEach(line => {
      const s = line.trim()
      if (!s || s.startsWith('#')) return
      const [k, ...v] = s.split('=')
      if (k && v.length) process.env[k.trim()] = v.join('=').trim()
    })
  } catch {
    console.error('❌ No se encontró .env. Copia env-template.env a .env y rellena FAL_KEY.')
    process.exit(1)
  }
}
loadEnv()

const FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) { console.error('❌ Falta FAL_KEY en .env'); process.exit(1) }

const ARGS = new Set(process.argv.slice(2))
const CONFIRM = ARGS.has('--confirm')
const DO_VIDEOS = ARGS.has('--videos')

const OUT = resolve('FiestaGo-Contenido', 'headers')
mkdirSync(OUT, { recursive: true })

// ── Combinaciones objetivo ────────────────────────────────────────
const COMBOS = [
  { id:'fotografo_madrid',     label:'Fotógrafo · Madrid',     category:'fotografo',  city:'Madrid' },
  { id:'catering_barcelona',   label:'Catering · Barcelona',   category:'catering',   city:'Barcelona' },
  { id:'dj_sevilla',           label:'DJ · Sevilla',           category:'dj',         city:'Sevilla' },
  { id:'decoracion_valencia',  label:'Decoración · Valencia',  category:'decoracion', city:'Valencia' },
  { id:'videografo_malaga',    label:'Videógrafo · Málaga',    category:'videografo', city:'Málaga' },
]

// ── Prompts por categoría ─────────────────────────────────────────
const CATEGORY_PROMPTS = {
  fotografo:   'A professional wedding photographer composing a tender, intimate moment of a couple holding each other, soft golden hour light, shallow depth of field, romantic editorial style, no faces visible, viewed from behind, premium wedding aesthetic',
  catering:    'An elegantly plated Spanish wedding banquet on a long candlelit wooden table, ceramic plates with seasonal Mediterranean cuisine, low candle flames, scattered floral arrangements, warm ambient editorial lighting, premium gastronomy aesthetic',
  dj:          'Wedding party at twilight with festoon string lights overhead, silhouettes of guests dancing joyfully, DJ booth softly visible in the background, warm golden ambient glow, cinematic editorial style, motion blur, joyful atmosphere',
  decoracion:  'A romantic outdoor wedding ceremony arch covered in cascading pampas grass and ivory roses, candles and lanterns, soft afternoon golden light, dreamy editorial wedding aesthetic, minimal modern Mediterranean style',
  videografo:  'A cinematographer with a professional camera filming a wedding ceremony from afar at golden hour, lens flare, premium editorial cinematic style, soft warm bokeh background, behind the scenes wedding film',
  // Mapeos a las categorías oficiales del marketplace (por si extiendes la lista)
  foto:        'A professional wedding photographer composing a tender, intimate moment of a couple, soft golden hour light, shallow depth of field, romantic editorial style, premium wedding aesthetic',
  espacios:    'An elegant outdoor wedding venue with festoon string lights, long banquet tables under olive trees, candles, golden hour light, cinematic editorial wedding photography',
  musica:      'Wedding party with DJ at twilight, festoon lights, silhouettes of guests dancing, warm golden ambient glow, cinematic editorial style, motion blur',
  flores:      'Lush wedding floral arrangements with ivory roses, eucalyptus and pampas grass, soft natural light, delicate editorial style, premium florist aesthetic',
  pastel:      'A multi-tier elegant wedding cake on a marble table with fresh florals, soft natural window light, premium editorial pastry aesthetic',
  belleza:     'A bride preparing for her wedding, soft natural light through window, vintage vanity with flowers, intimate editorial style, romantic getting-ready moment',
  animacion:   'Joyful wedding guests laughing and celebrating, raised hands, warm festoon lights, motion blur, candid editorial style',
  transporte:  'A vintage classic wedding car with floral arrangements parked outside an old Spanish church or finca, golden hour, cinematic editorial style',
  papeleria:   'Beautifully styled wedding invitation suite on textured paper with wax seals, ribbons and pressed flowers, soft natural light, editorial flat-lay aesthetic',
  planner:     'A wedding planner reviewing details with the couple in a sunlit Mediterranean venue, candid editorial style, warm tones',
  joyeria:     'Two simple gold wedding bands on a textile background with delicate florals, soft natural light, intimate editorial jewelry photography',
}

// ── Vibe por ciudad ───────────────────────────────────────────────
const CITY_VIBES = {
  'Madrid':    'with sandy ochre Madrid architecture in the soft background, Castilian sunset, warm Mediterranean light',
  'Barcelona': 'with hints of Mediterranean Catalan coastal ambience, golden hour, Modernisme architectural details softly blurred',
  'Sevilla':   'in a traditional Sevillan patio with hand-painted azulejo tiles, orange trees and arched white walls, warm Andalusian afternoon light',
  'Valencia':  'with palm trees and the warm coastal Valencian light, Mediterranean blue sky in the distance, golden hour',
  'Málaga':    'with Costa del Sol turquoise sea distantly visible, palm trees, warm Andalusian golden hour light',
  'Bilbao':    'with northern Spanish Atlantic coastal mist, soft diffused cool light, sophisticated Basque ambience',
  'Zaragoza':  'with elegant aragonese stone architecture in the soft background, warm autumn light',
  'Murcia':    'with Mediterranean Murcian palm trees and warm afternoon light',
  'Alicante':  'with Costa Blanca turquoise sea distantly visible, white buildings, warm Mediterranean light',
  'Granada':   'with hints of Alhambra silhouette in the distance, Sierra Nevada, warm dusk Andalusian light',
}

const NEGATIVE_TAGS = 'no text, no logos, no watermarks, no captions, no people facing camera with visible faces, photorealistic, 4k cinematic, sharp focus, premium editorial wedding magazine quality'

function buildPrompt(category, city) {
  const base = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.fotografo
  const vibe = CITY_VIBES[city] || `with a warm Mediterranean Spanish ambience`
  return `${base}, ${vibe}, ${NEGATIVE_TAGS}`
}

// ── fal.ai: Flux 1.1 Pro (sync, 1-3s típico) ──────────────────────
async function generateImage(prompt) {
  const res = await fetch('https://fal.run/fal-ai/flux-pro/v1.1', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_16_9',
      num_images: 1,
      enable_safety_checker: true,
      output_format: 'jpeg',
      safety_tolerance: '5',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`fal.ai ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
  const url = data.images?.[0]?.url
  if (!url) throw new Error('Sin URL de imagen en respuesta')
  return { url, raw: data }
}

// ── fal.ai: Kling 3.0 (queue, 30-90s) ─────────────────────────────
async function generateVideo(prompt) {
  const submit = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration: '5',
      aspect_ratio: '16:9',
    }),
  })
  const sub = await submit.json()
  if (!submit.ok) throw new Error(`Kling submit: ${JSON.stringify(sub).slice(0, 300)}`)
  const requestId = sub.request_id

  // poll
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const status = await fetch(`https://queue.fal.run/fal-ai/kling-video/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${FAL_KEY}` },
    })
    const sd = await status.json()
    process.stdout.write(`\r   → Kling: ${sd.status} (${(i+1)*5}s)         `)
    if (sd.status === 'COMPLETED') {
      console.log()
      const result = await fetch(`https://queue.fal.run/fal-ai/kling-video/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      })
      const rd = await result.json()
      const videoUrl = rd.video?.url || rd.output?.video?.url
      if (!videoUrl) throw new Error(`Kling sin URL: ${JSON.stringify(rd).slice(0, 300)}`)
      return { url: videoUrl, raw: rd }
    }
    if (sd.status === 'FAILED' || sd.status === 'ERROR') {
      console.log()
      throw new Error(`Kling falló: ${JSON.stringify(sd)}`)
    }
  }
  throw new Error('Kling timeout (5 min)')
}

async function downloadTo(url, path) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(path, buf)
}

function loadIndex() {
  const p = join(OUT, 'index.json')
  if (!existsSync(p)) return {}
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return {} }
}
function saveIndex(idx) {
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(idx, null, 2))
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(56))
  console.log('🎨 FiestaGo Content Generator')
  console.log('═'.repeat(56))
  console.log(`Modo: ${CONFIRM ? 'GENERAR' : 'DRY RUN (preview)'}${DO_VIDEOS ? ' + vídeos' : ''}`)
  console.log()
  console.log('Combinaciones:')

  for (const c of COMBOS) {
    const dir = join(OUT, c.id)
    const hasImg = existsSync(join(dir, 'imagen.jpg'))
    const hasVid = existsSync(join(dir, 'video.mp4'))
    const status = hasImg && (!DO_VIDEOS || hasVid) ? '✓ ya generado' : '○ pendiente'
    console.log(`  ${status.padEnd(15)} ${c.label}`)
  }
  console.log()

  if (!CONFIRM) {
    console.log('Para ejecutar de verdad:')
    console.log('  node fiegago-content-gen.mjs --confirm')
    if (!DO_VIDEOS) console.log('  node fiegago-content-gen.mjs --confirm --videos   (también genera vídeos)')
    process.exit(0)
  }

  const idx = loadIndex()
  let imgGenerated = 0, vidGenerated = 0

  for (const c of COMBOS) {
    const dir = join(OUT, c.id)
    mkdirSync(dir, { recursive: true })
    const imgPath = join(dir, 'imagen.jpg')
    const vidPath = join(dir, 'video.mp4')
    const prompt = buildPrompt(c.category, c.city)

    console.log(`\n▶ ${c.label}`)
    writeFileSync(join(dir, 'prompt_usado.txt'), prompt)

    // Imagen
    if (existsSync(imgPath)) {
      console.log(`   ⏭  Imagen ya existe`)
    } else {
      try {
        console.log(`   🎨 Generando imagen (Flux 1.1 Pro)...`)
        const t0 = Date.now()
        const { url } = await generateImage(prompt)
        await downloadTo(url, imgPath)
        const dt = Math.round((Date.now() - t0) / 100) / 10
        console.log(`   ✓ Imagen guardada (${dt}s)`)
        imgGenerated++
        idx[c.id] = {
          ...idx[c.id],
          category: c.category, city: c.city, label: c.label,
          prompt,
          image: { sourceUrl: url, localPath: `headers/${c.id}/imagen.jpg`, generatedAt: new Date().toISOString() },
        }
        saveIndex(idx)
      } catch (err) {
        console.log(`   ✗ Imagen falló: ${err.message}`)
        continue
      }
    }

    // Vídeo (opcional)
    if (DO_VIDEOS) {
      if (existsSync(vidPath)) {
        console.log(`   ⏭  Vídeo ya existe`)
      } else {
        try {
          console.log(`   🎬 Generando vídeo (Kling 3.0, 5s)...`)
          const t0 = Date.now()
          const { url } = await generateVideo(prompt)
          await downloadTo(url, vidPath)
          const dt = Math.round((Date.now() - t0) / 1000)
          console.log(`   ✓ Vídeo guardado (${dt}s)`)
          vidGenerated++
          idx[c.id] = {
            ...idx[c.id],
            video: { sourceUrl: url, localPath: `headers/${c.id}/video.mp4`, generatedAt: new Date().toISOString() },
          }
          saveIndex(idx)
        } catch (err) {
          console.log(`   ✗ Vídeo falló: ${err.message}`)
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`🎉 Hecho · ${imgGenerated} imágenes · ${vidGenerated} vídeos`)
  console.log(`📁 ${OUT}`)
  console.log('═'.repeat(56) + '\n')
}

main().catch(err => {
  console.error(`\n❌ Error fatal: ${err.message}`)
  process.exit(1)
})
