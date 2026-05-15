// ═══════════════════════════════════════════════════════════════════
// FiestaGo · Order Posts
// Asigna scheduled_for + ajusta created_at de los posts pending para
// que el panel admin los muestre en el orden de publicación deseado.
//
// USO:
//   node order-posts.mjs                       # dry-run, muestra el plan
//   node order-posts.mjs --apply               # aplica los cambios en Supabase
//   node order-posts.mjs --apply --start 2026-05-19   # cambiar fecha de inicio
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs'
import { resolve } from 'path'

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Falta SUPABASE_URL/KEY'); process.exit(1) }

// ── ARGS ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const startIdx = argv.indexOf('--start')
const START_DATE = startIdx >= 0 ? argv[startIdx + 1] : '2026-05-19'  // martes próximo

// ── Calendario sugerido ──────────────────────────────────────────
// Orden de publicación + offset de días desde la fecha de inicio (martes S1)
// Cadencia: Mar/Vie semana 1, Mar/Jue semana 2, Mar/Vie semana 3, Mié semana 4
const CALENDAR = [
  { order: 1, template_id: 'provider_anti_subscription_video',      day_offset: 0,  label: 'S1 Mar · Anti-suscripción' },
  { order: 2, template_id: 'provider_not_only_weddings_carousel',   day_offset: 3,  label: 'S1 Vie · No es solo bodas' },
  { order: 3, template_id: 'provider_zero_commission_video',        day_offset: 7,  label: 'S2 Mar · 0% primera venta' },
  { order: 4, template_id: 'provider_demo_signup_video',            day_offset: 9,  label: 'S2 Jue · Alta en 60s' },
  { order: 5, template_id: 'provider_low_season_video',             day_offset: 14, label: 'S3 Mar · Temporada baja' },
  { order: 6, template_id: 'provider_comparison_carousel',          day_offset: 17, label: 'S3 Vie · Comparativa coste' },
  { order: 7, template_id: 'provider_hot_take_video',               day_offset: 22, label: 'S4 Mié · Hot take' },
]

// ── Supabase REST helpers ─────────────────────────────────────────
async function supaGET(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function supaPATCH(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// ── Fechas ────────────────────────────────────────────────────────
// Construye fechas en hora local Madrid (UTC+2 en mayo: CEST).
// scheduled_for: a las 13:00 hora local del día indicado.
function buildScheduledFor(offsetDays) {
  const base = new Date(`${START_DATE}T13:00:00+02:00`)  // CEST en mayo/junio
  base.setUTCDate(base.getUTCDate() + offsetDays)
  return base.toISOString()
}

// created_at: hoy con segundos ascendentes inversos.
// El #1 se queda con el created_at más alto (más reciente) → aparece primero
// en el order_by created_at DESC del admin.
function buildCreatedAt(order) {
  const now = new Date()
  // El #1 tiene 0 segundos restados, el #7 tiene 60 segundos restados.
  // Espacio de 10 segundos entre cada uno para que no se confundan en ordenación.
  const offsetSeconds = (order - 1) * 10
  const d = new Date(now.getTime() - offsetSeconds * 1000)
  return d.toISOString()
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('🗓️  FiestaGo · Order Posts (admin)')
  console.log('═'.repeat(60))
  console.log(`Modo:        ${APPLY ? 'APLICAR (escribe en Supabase)' : 'DRY-RUN'}`)
  console.log(`Fecha inicio: ${START_DATE} (martes asumido)`)
  console.log()

  // 1. Traer posts pending de audiencia provider
  console.log('🔎 Buscando posts pending de campaña proveedores...')
  const posts = await supaGET(
    `social_posts?status=eq.pending&template_id=in.(${CALENDAR.map(c => c.template_id).join(',')})&select=id,template_id,template_label,created_at,scheduled_for&order=created_at.desc`
  )
  console.log(`   Encontrados: ${posts.length}`)
  console.log()

  // 2. Mapear template_id → post id (último creado si hubiera duplicados)
  const byTpl = new Map()
  for (const p of posts) {
    if (!byTpl.has(p.template_id)) byTpl.set(p.template_id, p)
  }

  // 3. Plan
  console.log('📋 Plan:')
  console.log(' #  Día           ScheduledFor          Template                                 ID')
  const ops = []
  for (const c of CALENDAR) {
    const post = byTpl.get(c.template_id)
    if (!post) {
      console.log(`  ${c.order}. ⚠️  Sin post pending para ${c.template_id}  (skip)`)
      continue
    }
    const scheduled = buildScheduledFor(c.day_offset)
    const createdAt = buildCreatedAt(c.order)
    const dayLabel = scheduled.slice(0, 10)
    console.log(`  ${c.order}. ${dayLabel}    ${scheduled.slice(11, 19)} UTC       ${c.template_id.padEnd(40)} ${post.id.slice(0, 8)}…`)
    ops.push({ id: post.id, c, scheduled, createdAt })
  }
  console.log()

  if (!APPLY) {
    console.log('Para aplicar de verdad:')
    console.log('  node order-posts.mjs --apply')
    console.log('  node order-posts.mjs --apply --start 2026-05-20    # otra fecha de inicio')
    return
  }

  // 4. Aplicar PATCH
  console.log('✍️  Aplicando cambios...')
  let ok = 0, fail = 0
  for (const op of ops) {
    try {
      await supaPATCH(`social_posts?id=eq.${op.id}`, {
        scheduled_for: op.scheduled,
        created_at: op.createdAt,
      })
      console.log(`   ✓ #${op.c.order} ${op.c.template_id}`)
      ok++
    } catch (err) {
      console.log(`   ✗ #${op.c.order} ${op.c.template_id} → ${err.message}`)
      fail++
    }
  }
  console.log()
  console.log(`🎉 ${ok} actualizados · ${fail} con error`)
  console.log()
  console.log('En el panel admin verás los 7 cards en orden de publicación,')
  console.log('con el #1 arriba a la izquierda. scheduled_for asignado en BD.')
}

main().catch(err => { console.error(`❌ ${err.message}`); process.exit(1) })
