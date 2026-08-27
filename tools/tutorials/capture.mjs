#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Capturador automático de tutoriales del panel del proveedor
 * ═══════════════════════════════════════════════════════════════════
 *
 * Usa Playwright para navegar por FiestaGo como si fuera el proveedor
 * MarianoSL (vía bypass admin con ?as=<id>), graba cada flujo, y con
 * ffmpeg convierte los vídeos a GIFs optimizados para la página
 * /proveedor/ayuda.
 *
 * REQUISITOS
 *   - Node 18+
 *   - Playwright (@playwright/test)  → npm i -D @playwright/test
 *   - Chromium (ya viene en el entorno cloud)  → npx playwright install chromium (si local)
 *   - ffmpeg en el PATH
 *   - Variables de entorno:
 *       BASE_URL          = https://fiestago.es (o localhost:3000)
 *       ADMIN_PASSWORD    = la del site
 *       PROVIDER_ID       = uuid del proveedor demo (default MarianoSL)
 *
 * USO
 *   node tools/tutorials/capture.mjs                       # todos
 *   node tools/tutorials/capture.mjs 01-primer-login       # uno concreto
 *   node tools/tutorials/capture.mjs --list                # lista los slugs
 *
 * OUTPUT
 *   public/tutorials/*.gif        (los que consumirá /proveedor/ayuda)
 *   public/tutorials/_raw/*.webm  (fuentes por si quieres reeditar)
 * ═══════════════════════════════════════════════════════════════════
 */

import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { mkdirSync, existsSync, rmSync, readdirSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..', '..')
const OUT_DIR   = join(ROOT, 'public', 'tutorials')
const RAW_DIR   = join(OUT_DIR, '_raw')

const BASE_URL       = process.env.BASE_URL || 'https://fiestago.es'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const PROVIDER_ID    = process.env.PROVIDER_ID || '67ee5f5f-3274-44c0-aa17-5cc81217cd99'

if (!ADMIN_PASSWORD) {
  console.error('❌ Falta ADMIN_PASSWORD. Ponla en el entorno antes de ejecutar.')
  process.exit(1)
}

// ─── Escenas ─────────────────────────────────────────────────────────
// Cada escena describe UN tutorial: ruta a abrir (relative), acciones
// scripted a ejecutar, y duración aproximada. La duración real la
// determina la propia grabación cuando termina.
const SCENES = [
  {
    slug: '01-primer-login',
    tab:  'dashboard',
    caption: 'Este es tu panel · Arriba a la izquierda la navegación',
    steps: async (page) => {
      await sleep(2500)
      await hover(page, 'nav a, nav button', 0)
      await sleep(1500)
    },
  },
  {
    slug: '02-perfil',
    tab:  'profile',
    caption: 'Rellena foto, descripción y activa la videollamada preventa',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 300)
      await sleep(2500)
    },
  },
  {
    slug: '03-servicios',
    tab:  'services',
    caption: 'Nombre, precio, anticipo, fotos · listo para reservas',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 400)
      await sleep(3000)
    },
  },
  {
    slug: '04-datos-fiscales',
    tab:  'fiscal',
    caption: 'NIF + régimen + activar facturación delegada Verifactu',
    steps: async (page) => {
      await sleep(3000)
      await scroll(page, 500)
      await sleep(2500)
    },
  },
  {
    slug: '05-presupuestos-ia',
    tab:  'quotes',
    caption: 'Pega el mensaje del cliente · IA redacta el presupuesto',
    steps: async (page) => {
      await sleep(2000)
      await scroll(page, 200)
      await sleep(2000)
      // Escribir un brief demo
      try {
        const textarea = await page.$('textarea')
        if (textarea) {
          await textarea.click()
          await page.keyboard.type('Hola, quiero reservar reportaje para una boda el 15 de junio en Valencia, 100 invitados', { delay: 15 })
          await sleep(1500)
        }
      } catch {}
    },
  },
  {
    slug: '06-plantillas-whatsapp',
    tab:  'wa-replies',
    caption: '9 plantillas ya listas · edita o crea las tuyas',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 300)
      await sleep(2500)
    },
  },
  {
    slug: '07-cupones',
    tab:  'coupons',
    caption: 'Descuento por servicio o para todos · link con auto-apply',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 200)
      await sleep(2500)
    },
  },
  {
    slug: '08-videollamada',
    tab:  'video-calls',
    caption: 'Aceptar solicitud → genera sala Jitsi automática',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 200)
      await sleep(2000)
    },
  },
  {
    slug: '09-aceptar-reserva',
    tab:  'bookings',
    caption: 'Un clic en Confirmar → facturas Verifactu automáticas',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 200)
      await sleep(2500)
    },
  },
  {
    slug: '10-cobros',
    tab:  'earnings',
    caption: 'Cuánto has cobrado por mes · CSV descargable',
    steps: async (page) => {
      await sleep(3500)
      await scroll(page, 400)
      await sleep(2000)
    },
  },
  {
    slug: '11-mensajes',
    tab:  'messages',
    caption: 'Chat con cliente · adjuntos y videollamada integrada',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 200)
      await sleep(2000)
    },
  },
  {
    slug: '12-disponibilidad',
    tab:  'availability',
    caption: 'Marca días libres y sincroniza con Google Calendar',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 200)
      await sleep(2500)
    },
  },
  {
    slug: '13-google-business',
    tab:  'gmb',
    caption: 'IA escribe posts optimizados para tu ficha de Maps',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 200)
      await sleep(2500)
    },
  },
  {
    slug: '14-widget',
    tab:  'embed',
    caption: 'Copia el HTML y pégalo en tu web · botón o tarjeta',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 300)
      await sleep(2500)
    },
  },
  {
    slug: '15-compartir-servicio',
    tab:  'services',
    caption: 'Cada servicio: copia link o abre WhatsApp con mensaje listo',
    steps: async (page) => {
      await sleep(2500)
      await scroll(page, 600)
      await sleep(3000)
    },
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function hover(page, selector, nth = 0) {
  try {
    const els = await page.$$(selector)
    if (els[nth]) await els[nth].hover()
  } catch {}
}

async function scroll(page, y) {
  try {
    await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), y)
  } catch {}
}

async function injectCaption(page, text) {
  await page.evaluate((text) => {
    const existing = document.getElementById('__tutorial_caption')
    if (existing) existing.remove()
    const el = document.createElement('div')
    el.id = '__tutorial_caption'
    el.textContent = text
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(26,22,18,0.94)',
      color: '#fff',
      padding: '12px 22px',
      borderRadius: '12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '15px',
      fontWeight: '600',
      letterSpacing: '0.01em',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      zIndex: '999999',
      maxWidth: '80vw',
      textAlign: 'center',
      lineHeight: '1.4',
    })
    document.body.appendChild(el)
  }, text)
}

function toGif(webmPath, gifPath) {
  // Paleta primero para colores decentes; sino sale un GIF con dither feo.
  const palette = webmPath.replace('.webm', '_palette.png')
  execSync(`ffmpeg -y -i "${webmPath}" -vf "fps=12,scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff" "${palette}"`, { stdio: 'ignore' })
  execSync(`ffmpeg -y -i "${webmPath}" -i "${palette}" -filter_complex "fps=12,scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" "${gifPath}"`, { stdio: 'ignore' })
  rmSync(palette, { force: true })
}

// ─── Runner ──────────────────────────────────────────────────────────
async function captureScene(scene) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: RAW_DIR, size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()

  // Inyecta la contraseña admin en localStorage antes de que arranque la app
  await page.addInitScript(([pwd]) => {
    localStorage.setItem('fg_admin_pass', pwd)
  }, [ADMIN_PASSWORD])

  const url = `${BASE_URL}/proveedor/panel?as=${PROVIDER_ID}&tab=${scene.tab}`
  console.log(`  📍 ${url}`)

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  // Esperamos a que aparezca el sidebar (indica que la app hidrató)
  try {
    await page.waitForSelector('nav button, nav a', { timeout: 30_000 })
  } catch (e) {
    console.error(`  ⚠  Sidebar no apareció en 30s`)
  }
  await sleep(3000) // que se cargue el panel completo (provider fetch, etc.)

  // Aseguramos que estamos en el tab correcto haciendo clic explícito
  // sobre el botón del sidebar (por si el URL param falla). Busca el
  // botón cuyo texto contenga el label del tab.
  const LABELS = {
    dashboard: 'Resumen', stats: 'Estadísticas', profile: 'Mi perfil',
    services: 'Mis servicios', quotes: 'Presupuestos IA',
    'wa-replies': 'Plantillas WhatsApp', gmb: 'Google Business',
    availability: 'Disponibilidad', bookings: 'Reservas', earnings: 'Cobros',
    messages: 'Mensajes', 'video-calls': 'Videollamadas',
    embed: 'Widget para mi web', coupons: 'Cupones', reviews: 'Reseñas',
    fiscal: 'Datos fiscales', invoices: 'Facturas', security: 'Seguridad',
  }
  const clickResult = await page.evaluate(({ tabId, labels }) => {
    const label = labels[tabId] || tabId
    const btn = Array.from(document.querySelectorAll('nav button, nav a')).find(
      (b) => b.textContent && b.textContent.includes(label)
    )
    if (btn) { btn.click(); return `clicked "${label}"` }
    // Lista lo que sí ve para diagnóstico
    const visible = Array.from(document.querySelectorAll('nav button, nav a'))
      .map(b => b.textContent?.trim().slice(0, 30)).slice(0, 20)
    return `NOT FOUND "${label}" · sidebar sees: ${JSON.stringify(visible)}`
  }, { tabId: scene.tab, labels: LABELS })
  console.log(`  🎯 tab click: ${clickResult}`)
  await sleep(1500) // deja que el tab renderice

  // Debug: guardamos screenshot del estado justo antes de grabar
  const debugPath = join(RAW_DIR, '_debug', `${scene.slug}.png`)
  mkdirSync(dirname(debugPath), { recursive: true })
  await page.screenshot({ path: debugPath, fullPage: false })
  const currentUrl = page.url()
  console.log(`  📸 debug: ${debugPath.replace(ROOT + '/', '')}`)
  console.log(`  🌐 currentUrl: ${currentUrl}`)

  await injectCaption(page, scene.caption)
  await sleep(500)

  await scene.steps(page)

  await sleep(1000)
  await context.close()
  await browser.close()

  // Playwright deja un webm con nombre random en RAW_DIR. Lo renombramos.
  const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.webm') && !f.startsWith(scene.slug))
  if (!files.length) throw new Error(`No se generó vídeo para ${scene.slug}`)
  const raw = files.sort((a, b) => a > b ? -1 : 1)[0] // el más reciente
  const webmPath = join(RAW_DIR, `${scene.slug}.webm`)
  renameSync(join(RAW_DIR, raw), webmPath)

  const gifPath = join(OUT_DIR, `${scene.slug}.gif`)
  console.log(`  🎞  Convirtiendo a GIF…`)
  toGif(webmPath, gifPath)
  console.log(`  ✓ ${gifPath.replace(ROOT + '/', '')}`)
}

async function main() {
  const arg = process.argv[2]
  if (arg === '--list') {
    console.log('Slugs disponibles:')
    SCENES.forEach(s => console.log(`  ${s.slug}`))
    return
  }

  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(RAW_DIR, { recursive: true })

  const scenes = arg ? SCENES.filter(s => s.slug === arg) : SCENES
  if (!scenes.length) {
    console.error(`❌ No hay escena con slug "${arg}". Usa --list para verlas.`)
    process.exit(1)
  }

  console.log(`\n🎬 Capturando ${scenes.length} tutorial${scenes.length !== 1 ? 'es' : ''}\n`)

  for (const scene of scenes) {
    console.log(`▶ ${scene.slug}`)
    try {
      await captureScene(scene)
    } catch (err) {
      console.error(`  ✗ Falló: ${err.message}`)
    }
    console.log('')
  }

  console.log(`✅ Terminado. Revisa ${OUT_DIR}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
