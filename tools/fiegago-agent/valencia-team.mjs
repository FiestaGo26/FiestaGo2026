// ═══════════════════════════════════════════════════════════════════
// FiestaGo · Equipo Valencia
// Lanza el agente de captación (búsqueda web de Claude) sobre las 12
// categorías de Valencia, una tras otra. Reutiliza el endpoint ya
// desplegado /api/admin/agent, así que NO necesita claves de Anthropic
// ni de Supabase en local: solo la URL de la app y la contraseña admin.
//
// USO:
//   APP_URL=https://fiestago.es ADMIN_PASSWORD=xxxx node valencia-team.mjs
//   COUNT=3 CITY=Valencia node valencia-team.mjs        # opcionales
//   node valencia-team.mjs foto,catering,musica         # solo esas cats
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      readFileSync(resolve(f), 'utf-8').split('\n').forEach(line => {
        const t = line.trim()
        if (!t || t.startsWith('#')) return
        const [k, ...v] = t.split('=')
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim()
      })
    } catch { /* ignore */ }
  }
}
loadEnv()

const APP_URL  = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')
const PASSWORD = process.env.ADMIN_PASSWORD
const CITY     = process.env.CITY  || 'Valencia'
const COUNT    = Math.min(Math.max(Number(process.env.COUNT) || 3, 1), 3)
const DELAY_MS = Number(process.env.DELAY_MS || 30_000)   // pausa anti rate-limit

const ALL_CATEGORIES = [
  'foto', 'catering', 'espacios', 'musica', 'flores', 'pastel',
  'belleza', 'animacion', 'transporte', 'papeleria', 'planner', 'joyeria',
]

const argCats = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean)
const CATEGORIES = argCats.length ? argCats.filter(c => ALL_CATEGORIES.includes(c)) : ALL_CATEGORIES

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function runCategory(category) {
  const res = await fetch(`${APP_URL}/api/admin/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': PASSWORD },
    body: JSON.stringify({ category, city: CITY, count: COUNT }),
  })
  const raw = await res.text()
  let data = {}
  try { data = JSON.parse(raw) } catch {
    return { saved: 0, found: 0, error: `Respuesta no-JSON (${res.status})` }
  }
  ;(data.logs || []).forEach(l => console.log('   ' + l))
  return { saved: data.stats?.saved ?? (data.providers?.length || 0), found: data.stats?.found || 0, error: data.error }
}

async function main() {
  if (!PASSWORD) {
    console.error('❌ Falta ADMIN_PASSWORD (en env o .env.local)')
    process.exit(1)
  }
  console.log('═'.repeat(56))
  console.log(`🤖 EQUIPO ${CITY.toUpperCase()} — ${CATEGORIES.length} categorías × ${COUNT} proveedores`)
  console.log(`🌐 ${APP_URL}/api/admin/agent`)
  console.log('═'.repeat(56))

  let totalSaved = 0, totalFound = 0
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i]
    console.log(`\n[${i + 1}/${CATEGORIES.length}] ▶ ${cat} · ${CITY}`)
    try {
      const r = await runCategory(cat)
      if (r.error) console.log(`   ⚠️ ${r.error}`)
      console.log(`   📊 ${r.saved} guardados · ${r.found} candidatos`)
      totalSaved += r.saved
      totalFound += r.found
    } catch (err) {
      console.log(`   ❌ Error de red: ${err.message}`)
    }
    if (i < CATEGORIES.length - 1) {
      console.log(`   ⏸ Esperando ${DELAY_MS / 1000}s (rate limit)...`)
      await sleep(DELAY_MS)
    }
  }

  console.log('\n' + '═'.repeat(56))
  console.log(`🎉 EQUIPO ${CITY.toUpperCase()} COMPLETADO`)
  console.log(`💾 Guardados: ${totalSaved} · Candidatos: ${totalFound}`)
  console.log(`📋 Apruébalos en ${APP_URL}/admin`)
  console.log('═'.repeat(56))
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
