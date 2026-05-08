// ═══════════════════════════════════════════════════════════════════
// FiestaGo · Marketing Agent
// Genera posts (imagen/vídeo + caption + hashtags) para Instagram + TikTok
//
// USO:
//   node fiegago-marketing-agent.mjs                  # dry-run (sin coste)
//   node fiegago-marketing-agent.mjs --confirm        # genera 3 posts (default)
//   node fiegago-marketing-agent.mjs --confirm --n 8  # genera N posts
//   node fiegago-marketing-agent.mjs --confirm --type inspiration_video  # solo un tipo
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ── .env ──────────────────────────────────────────────────────────
function loadEnv() {
  try {
    readFileSync(resolve('.env'), 'utf-8').split('\n').forEach(l => {
      const t = l.trim(); if (!t || t.startsWith('#')) return
      const [k, ...v] = t.split('='); if (k && v.length) process.env[k.trim()] = v.join('=').trim()
    })
  } catch { console.error('❌ Falta .env'); process.exit(1) }
}
loadEnv()
const FAL_KEY        = process.env.FAL_KEY
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY
if (!FAL_KEY)       { console.error('❌ Falta FAL_KEY en .env'); process.exit(1) }
if (!ANTHROPIC_KEY) { console.error('❌ Falta ANTHROPIC_API_KEY en .env'); process.exit(1) }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ENABLE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY)
if (!ENABLE_SUPABASE) console.warn('⚠️  Sin SUPABASE_URL/KEY: solo guardado local, sin cola en admin')

// ── ARGS ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`); return i >= 0 ? (argv[i+1] || true) : fallback
}
const CONFIRM   = argv.includes('--confirm')
const N_POSTS   = Number(arg('n', 3))
const ONLY_TYPE = arg('type', null)

// ── Templates ─────────────────────────────────────────────────────
const TEMPLATES = JSON.parse(readFileSync(resolve('post-templates.json'), 'utf-8')).templates

// ── Output ────────────────────────────────────────────────────────
const OUT_BASE = resolve('FiestaGo-Contenido', 'redes-sociales')
mkdirSync(OUT_BASE, { recursive: true })

// ── Selección por peso ────────────────────────────────────────────
function weightedPick(templates) {
  const total = templates.reduce((s, t) => s + t.weight, 0)
  let r = Math.random() * total
  for (const t of templates) { r -= t.weight; if (r <= 0) return t }
  return templates[0]
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)] }
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

// ── fal.ai: Flux 1.1 Pro ──────────────────────────────────────────
async function falImage(prompt) {
  const res = await fetch('https://fal.run/fal-ai/flux-pro/v1.1', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt, image_size: 'square_hd', num_images: 1, output_format: 'jpeg',
      enable_safety_checker: true, safety_tolerance: '5',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Flux ${res.status}: ${JSON.stringify(data).slice(0,200)}`)
  return data.images?.[0]?.url
}

// ── fal.ai: Kling video ───────────────────────────────────────────
async function falVideo(prompt, duration = 5) {
  const submit = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, duration: String(duration), aspect_ratio: '9:16' }),
  })
  const sub = await submit.json()
  if (!submit.ok) throw new Error(`Kling submit: ${JSON.stringify(sub).slice(0,200)}`)
  const id = sub.request_id
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const status = await fetch(`https://queue.fal.run/fal-ai/kling-video/requests/${id}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } })
    const sd = await status.json()
    process.stdout.write(`\r   → Kling: ${sd.status} (${(i+1)*5}s)         `)
    if (sd.status === 'COMPLETED') {
      const r = await fetch(`https://queue.fal.run/fal-ai/kling-video/requests/${id}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } })
      const rd = await r.json()
      console.log()
      return rd.video?.url || rd.output?.video?.url
    }
    if (sd.status === 'FAILED' || sd.status === 'ERROR') {
      console.log(); throw new Error(`Kling FAILED: ${JSON.stringify(sd).slice(0,200)}`)
    }
  }
  throw new Error('Kling timeout')
}

// ── Claude: caption + hashtags ────────────────────────────────────
async function claudeCaption(template, context) {
  const sysPrompt = `Eres copywriter de redes sociales para FiestaGo (@fiestagospain), marketplace español de proveedores de eventos.
Tono: vibrante, joven, cercano. Audiencia: cualquiera que celebre algo (bodas, cumples, despedidas, comuniones, eventos corporativos).
La marca recalca: TODO en una sola web · sin estrés · sin coordinar con 10 sitios · primera transacción sin comisión.
Devuelves SOLO JSON válido, sin markdown ni explicación.`

  const userPrompt = `Genera contenido para un post en Instagram y TikTok.

Tipo: ${template.label}
Brief: ${template.caption_brief}
Contexto adicional: ${JSON.stringify(context)}
Hashtags base: ${template.hashtags_base.join(', ')}

Devuelve un JSON con esta estructura exacta:
{
  "hook_overlay": "texto MUY corto que se pondrá encima del vídeo/imagen en TikTok e IG (MÁX 40 caracteres, punzante, en MAYÚSCULAS o frase rota tipo: 'Tu boda. Sin estrés.' / 'Plan A: una sola web' / '¿Y si te lo dieran TODO hecho?')",
  "caption_es": "caption completo para Instagram (max 220 caracteres incluido CTA)",
  "caption_short_tiktok": "versión punzante para TikTok (max 100 caracteres)",
  "hashtags": ["hashtag1", "hashtag2", ...]
}

Reglas:
- hook_overlay: ULTRA corto, sin emojis, sin hashtags, máximo 40 chars. Es lo que el operador escribirá ENCIMA del vídeo en TikTok/IG manualmente. Tiene que generar curiosidad o ansia.
- Mete @fiestagospain solo en TikTok caption (no en Instagram, allí va al final como handle)
- Hashtags: 8-12, mezcla de los base + 3-4 específicos del tema
- Sin emojis al inicio del caption. Máximo 2 emojis estratégicos al final
- Castellano de España. Tuteo. Frases cortas
- CTA siempre incluye "fiestago.es" o el handle, no ambos`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: sysPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('Sin JSON en respuesta de Claude')
  return JSON.parse(m[0])
}

async function downloadTo(url, path) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
}

// ── Supabase Storage upload ───────────────────────────────────────
async function supabaseUpload(localPath, storagePath, contentType) {
  if (!ENABLE_SUPABASE) return null
  const buf = readFileSync(localPath)
  const url = `${SUPABASE_URL}/storage/v1/object/social-posts/${storagePath}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buf,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Storage upload ${res.status}: ${err.slice(0, 200)}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/social-posts/${storagePath}`
}

// ── Supabase: insert row en social_posts ──────────────────────────
async function supabaseInsertRow(row) {
  if (!ENABLE_SUPABASE) return null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/social_posts`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DB insert ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data[0] : data
}

// ── Generar UN post ───────────────────────────────────────────────
async function generatePost(template) {
  let context = {}, scene = '', topic = ''

  if (template.scenes) {
    scene = pickRandom(template.scenes)
    context.scene = scene
  }
  if (template.topics) {
    topic = pickRandom(template.topics)
    context.topic = topic
  }
  if (template.packs) {
    const p = pickRandom(template.packs)
    context = { ...context, pack_name: p.name, pack_price: p.price, pack_visual: p.visual }
    scene = p.visual
  }

  // Build media prompt
  let mediaPrompt = template.prompt_template
  Object.entries(context).forEach(([k, v]) => {
    mediaPrompt = mediaPrompt.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
  })
  // Fallback for any unfilled placeholder
  mediaPrompt = mediaPrompt.replace(/\{\w+\}/g, 'a celebration scene')

  const date = new Date().toISOString().slice(0, 10)
  const time = new Date().toISOString().slice(11, 16).replace(':', '')
  const id = `${date}-${time}-${template.id}-${Math.random().toString(36).slice(2, 6)}`
  const dir = join(OUT_BASE, date, id)
  mkdirSync(dir, { recursive: true })

  console.log(`\n▶ ${template.label}`)
  if (scene) console.log(`   📷 Escena: ${scene.slice(0, 80)}...`)
  if (topic) console.log(`   📝 Tema:   ${topic}`)

  // 1. Media
  console.log(`   🎨 Generando ${template.media}...`)
  let mediaUrl, mediaPath
  if (template.media === 'video') {
    mediaUrl = await falVideo(mediaPrompt, template.video_duration || 5)
    mediaPath = join(dir, 'video.mp4')
  } else {
    mediaUrl = await falImage(mediaPrompt)
    mediaPath = join(dir, 'imagen.jpg')
  }
  await downloadTo(mediaUrl, mediaPath)
  console.log(`   ✓ ${template.media} guardado`)

  // 2. Caption + hashtags
  console.log(`   ✍️  Generando caption con Claude...`)
  const caption = await claudeCaption(template, context)

  // 3. Save assets
  writeFileSync(join(dir, 'caption_instagram.txt'),
    `${caption.caption_es}\n\n${(caption.hashtags || []).map(h => '#' + h).join(' ')}`)
  writeFileSync(join(dir, 'caption_tiktok.txt'),
    `${caption.caption_short_tiktok}\n\n${(caption.hashtags || []).map(h => '#' + h).join(' ')}`)
  writeFileSync(join(dir, 'hashtags.txt'), (caption.hashtags || []).map(h => '#' + h).join('\n'))
  writeFileSync(join(dir, 'hook_overlay.txt'), caption.hook_overlay || '')
  writeFileSync(join(dir, 'prompt_usado.txt'), mediaPrompt)
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({
    id, template_id: template.id, label: template.label, media: template.media,
    scene, topic, context, generated_at: new Date().toISOString(),
    source_url: mediaUrl,
    caption: caption,
  }, null, 2))

  console.log(`   ✓ Caption, hashtags y meta guardados`)
  if (caption.hook_overlay) console.log(`   📐 Hook overlay (texto encima): "${caption.hook_overlay}"`)

  // 4. Upload to Supabase Storage + insert into social_posts
  let publicMediaUrl = null
  if (ENABLE_SUPABASE) {
    try {
      const ext = template.media === 'video' ? 'mp4' : 'jpg'
      const ctype = template.media === 'video' ? 'video/mp4' : 'image/jpeg'
      const storagePath = `${date}/${id}.${ext}`
      console.log(`   ☁️  Subiendo a Supabase Storage...`)
      publicMediaUrl = await supabaseUpload(mediaPath, storagePath, ctype)
      console.log(`   ✓ Storage: ${publicMediaUrl.slice(0, 80)}...`)

      console.log(`   📝 Insertando en cola social_posts...`)
      await supabaseInsertRow({
        template_id:       template.id,
        template_label:    template.label,
        media_type:        template.media,
        platform:          'both',
        prompt_used:       mediaPrompt,
        scene:             scene || null,
        topic:             topic || null,
        context:           context,
        media_url:         publicMediaUrl,
        local_path:        dir.replace(OUT_BASE, ''),
        caption_instagram: caption.caption_es || null,
        caption_tiktok:    caption.caption_short_tiktok || null,
        hook_overlay:      caption.hook_overlay || null,
        hashtags:          caption.hashtags || [],
        status:            'pending',
      })
      console.log(`   ✓ Insertado en cola (status=pending)`)
    } catch (err) {
      console.log(`   ⚠️  Supabase falló (post se queda solo en local): ${err.message}`)
    }
  }

  console.log(`   📁 ${dir.replace(OUT_BASE, '...')}`)
  return { id, dir, template: template.id, caption: caption.caption_es, mediaUrl: publicMediaUrl }
}

// ── Update index ──────────────────────────────────────────────────
function updateIndex(post, template) {
  const indexPath = join(OUT_BASE, 'index.json')
  const idx = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf-8')) : { posts: [] }
  idx.posts.unshift({
    id: post.id,
    template: template.id,
    label: template.label,
    media: template.media,
    dir: post.dir.replace(OUT_BASE, ''),
    caption_preview: post.caption.slice(0, 80),
    generated_at: new Date().toISOString(),
  })
  writeFileSync(indexPath, JSON.stringify(idx, null, 2))
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(56))
  console.log('🎯 FiestaGo · Marketing Agent')
  console.log('═'.repeat(56))
  console.log(`Modo:    ${CONFIRM ? 'GENERAR' : 'DRY RUN (sin coste)'}`)
  console.log(`Posts:   ${N_POSTS}`)
  console.log(`Filtro:  ${ONLY_TYPE || 'mezcla por pesos'}`)
  console.log(`Salida:  ${OUT_BASE}`)
  console.log()

  // Plan
  const pool = ONLY_TYPE ? TEMPLATES.filter(t => t.id === ONLY_TYPE) : TEMPLATES
  if (pool.length === 0) { console.error(`❌ Tipo no encontrado: ${ONLY_TYPE}`); process.exit(1) }

  const plan = []
  for (let i = 0; i < N_POSTS; i++) {
    plan.push(ONLY_TYPE ? pool[0] : weightedPick(pool))
  }

  console.log('📋 Plan de generación:')
  plan.forEach((t, i) => console.log(`  ${i + 1}. ${t.label.padEnd(35)} ${t.media}`))
  console.log()
  console.log(`💸 Coste estimado: ~$${plan.reduce((s, t) => s + (t.media === 'video' ? 0.5 : 0.04), 0).toFixed(2)}`)
  console.log()

  if (!CONFIRM) {
    console.log('Para generar de verdad:')
    console.log('  node fiegago-marketing-agent.mjs --confirm')
    console.log('  node fiegago-marketing-agent.mjs --confirm --n 8')
    console.log('  node fiegago-marketing-agent.mjs --confirm --type inspiration_video')
    process.exit(0)
  }

  // Generate
  let ok = 0, fail = 0
  for (const template of plan) {
    try {
      const post = await generatePost(template)
      updateIndex(post, template)
      ok++
    } catch (err) {
      console.log(`   ✗ Error: ${err.message}`)
      fail++
    }
  }

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`🎉 Hecho · ${ok} generados · ${fail} fallidos`)
  console.log(`📁 ${OUT_BASE}`)
  console.log(`📋 Index: ${join(OUT_BASE, 'index.json').replace(OUT_BASE, '')}`)
  console.log('═'.repeat(56) + '\n')
}

main().catch(err => { console.error(`❌ Fatal: ${err.message}`); process.exit(1) })
