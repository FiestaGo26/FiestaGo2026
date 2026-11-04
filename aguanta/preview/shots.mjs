// Capturas de la vista previa: node preview/shots.mjs [ruta...]  (servidor en marcha)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const SP = process.env.OUT || 'preview/shots';
import fs from 'node:fs'; fs.mkdirSync(SP, { recursive: true });
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/products/camiseta-aguanta', '/collections/drop-01-aguanta', '/pages/preguntas-frecuentes'];
const b = await chromium.launch();
const errors = [];
for (const [name, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${name} ${e.message}`));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  for (const r of routes) {
    await pg.goto('http://localhost:4545' + r, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(1200);
    // fuerza revelados para la captura de página completa
    await pg.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in'))); await pg.waitForTimeout(900);
    const f = `${SP}/${name}${r.replace(/[/?=]/g, '_') || '_'}.png`;
    await pg.screenshot({ path: f, fullPage: true });
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (ov) errors.push(`${name} ${r}: scroll horizontal`);
  }
  await ctx.close();
}
await b.close();
console.log(errors.length ? errors.join('\n') : 'sin errores');
