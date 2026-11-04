#!/usr/bin/env node
// AGUANTA × Printful (API v1). Necesita tu token privado:
//   https://developers.printful.com/tokens  → permisos: "View Printful catalog", "View and manage mockup generator", "View store products"
//
//   PRINTFUL_TOKEN=xxx node catalogo/printful.mjs verificar
//       Busca cada producto base en el catálogo actual, comprueba disponibilidad,
//       coste mínimo, técnicas y tamaño de plantilla de impresión. Escribe
//       catalogo/printful-verificado.json y avisa de cada diferencia con productos.mjs.
//
//   PRINTFUL_TOKEN=xxx node catalogo/printful.mjs envios
//       Pide a Printful la tarifa real de envío a España (Madrid) por producto.
//
//   PRINTFUL_TOKEN=xxx FILES_BASE_URL=https://… node catalogo/printful.mjs mockups
//       Genera los mockups oficiales de Printful con los archivos de designs/export/printful/
//       (Printful necesita los PNG en una URL pública: súbelos a Shopify > Contenido > Archivos
//       y pon aquí la URL base, o usa raw.githubusercontent.com si el repo es público).
//       Los guarda en designs/mockups/.
//
// Por qué no crea los productos sincronizados: la API de Printful no permite crear
// productos en tiendas conectadas a una plataforma (Shopify); solo en tiendas "API".
// En Shopify se crean desde el panel de Printful → ver catalogo/subida-manual.md.
// Si en algún momento cambian eso, el paso sería POST /store/products.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASES, FICHAS } from './productos.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const TOKEN = process.env.PRINTFUL_TOKEN;
const STORE = process.env.PRINTFUL_STORE_ID; // sólo si tu token es de cuenta (no de tienda)
const API = 'https://api.printful.com';
const cmd = process.argv[2];

if (!TOKEN) {
  console.error('Falta PRINTFUL_TOKEN. Ejemplo: PRINTFUL_TOKEN=xxx node catalogo/printful.mjs verificar');
  process.exit(1);
}

async function pf(method, url, body) {
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  if (STORE) headers['X-PF-Store-Id'] = STORE;
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 61000)); return pf(method, url, body); }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(json.error || json.result || json)}`);
  return json.result;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
async function buscarBase(catalogo, base) {
  for (const term of base.printful.buscar) {
    const t = norm(term);
    const hit = catalogo.find((p) => norm(`${p.title} ${p.model} ${p.brand}`).includes(t) && !p.is_discontinued);
    if (hit) return hit;
  }
  return null;
}

async function verificar() {
  const catalogo = await pf('GET', '/products');
  const out = {};
  for (const [key, base] of Object.entries(BASES)) {
    const p = await buscarBase(catalogo, base);
    if (!p) { out[key] = { encontrado: false }; console.log(`✗ ${key}: NO encontrado (${base.printful.buscar.join(' / ')}). Busca un sustituto en el catálogo.`); continue; }
    const det = await pf('GET', `/products/${p.id}`);
    const variants = det.variants.filter((v) => v.in_stock !== false);
    const precios = variants.map((v) => parseFloat(v.price)).filter((n) => !Number.isNaN(n));
    let printfiles = null;
    try { printfiles = await pf('GET', `/mockup-generator/printfiles/${p.id}`); } catch (e) { printfiles = { error: e.message }; }
    const pfiles = (printfiles?.printfiles || []).map((f) => ({ id: f.printfile_id, w: f.width, h: f.height, dpi: f.dpi }));
    out[key] = {
      encontrado: true, id: p.id, titulo: p.title, modelo: p.model, tecnicas: (p.techniques || []).map((t) => t.display_name),
      variantes: variants.length, coste_min: Math.min(...precios), coste_max: Math.max(...precios), moneda: det.product?.currency || p.currency,
      colores: [...new Set(variants.map((v) => v.color).filter(Boolean))].slice(0, 30),
      tallas: [...new Set(variants.map((v) => v.size).filter(Boolean))],
      plantillas: pfiles, placements: printfiles?.available_placements || null,
    };
    const o = out[key];
    const difCoste = Math.abs(o.coste_min - base.costeBase) > 0.5;
    console.log(`${difCoste ? '⚠' : '✓'} ${key}: #${p.id} ${p.title} — coste ${o.coste_min}${o.moneda ? ' ' + o.moneda : ''} (estimado ${base.costeBase} €) · ${o.variantes} variantes · ${o.tecnicas.join(', ')}`);
    const area = Object.values(base.areas)[0];
    if (pfiles.length) {
      const best = pfiles.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
      if (best.w !== area[0] || best.h !== area[1]) console.log(`   ⚠ plantilla Printful ${best.w}×${best.h} @${best.dpi} DPI ≠ productos.mjs ${area.join('×')} → actualiza "areas" y ejecuta node designs/generate.mjs`);
    }
    for (const f of FICHAS.filter((x) => x.base === key)) {
      const faltan = f.colores.filter((c) => c !== 'Integral' && !o.colores.some((x) => norm(x) === norm(c)));
      if (faltan.length) console.log(`   ⚠ ${f.handle}: color(es) no encontrados: ${faltan.join(', ')}`);
    }
  }
  fs.writeFileSync(path.join(here, 'printful-verificado.json'), JSON.stringify(out, null, 2));
  console.log('\n→ catalogo/printful-verificado.json. Copia los costes reales a catalogo/productos.mjs (costeBase, envio, areas), marca verificado: true y ejecuta node catalogo/precios.mjs.');
}

async function envios() {
  const catalogo = await pf('GET', '/products');
  for (const [key, base] of Object.entries(BASES)) {
    const p = await buscarBase(catalogo, base);
    if (!p) continue;
    const det = await pf('GET', `/products/${p.id}`);
    const v = det.variants.find((x) => /^(M|One size|Única)$/i.test(x.size || '')) || det.variants[0];
    const rates = await pf('POST', '/shipping/rates', {
      recipient: { country_code: 'ES', zip: '28013', city: 'Madrid' },
      items: [{ variant_id: v.id, quantity: 1 }], currency: 'EUR', locale: 'es_ES',
    });
    const r2 = await pf('POST', '/shipping/rates', { recipient: { country_code: 'ES', zip: '28013', city: 'Madrid' }, items: [{ variant_id: v.id, quantity: 2 }], currency: 'EUR' });
    const std = rates.find((r) => /standard|estándar/i.test(r.name)) || rates[0];
    const std2 = r2.find((r) => r.id === std.id) || r2[0];
    console.log(`${key}: 1 ud. ${std.rate} ${std.currency} · 2 uds. ${std2.rate} (${std.name}, ${std.minDeliveryDays}–${std.maxDeliveryDays} días) [estimado: ${base.envio}]`);
  }
}

async function mockups() {
  const BASE = process.env.FILES_BASE_URL;
  if (!BASE) throw new Error('Falta FILES_BASE_URL (URL pública donde están los PNG de designs/export/printful/).');
  const catalogo = await pf('GET', '/products');
  const outDir = path.join(ROOT, 'designs/mockups');
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of FICHAS) {
    const base = BASES[f.base];
    const p = await buscarBase(catalogo, base);
    if (!p) { console.log(`✗ ${f.handle}: producto no encontrado`); continue; }
    const det = await pf('GET', `/products/${p.id}`);
    const vids = det.variants.filter((v) => f.colores.includes('Integral') || f.colores.some((c) => norm(c) === norm(v.color))).slice(0, 3).map((v) => v.id);
    const pfiles = await pf('GET', `/mockup-generator/printfiles/${p.id}`);
    const placement = Object.keys(pfiles.available_placements || { front: 1 }).find((k) => /front|embroidery_front|default/.test(k)) || 'front';
    const [area] = Object.keys(base.areas);
    const url = `${BASE.replace(/\/$/, '')}/${f.handle}-${area}.png`;
    const task = await pf('POST', `/mockup-generator/create-task/${p.id}`, { variant_ids: vids, format: 'jpg', files: [{ placement, image_url: url }] });
    let res;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      res = await pf('GET', `/mockup-generator/task?task_key=${task.task_key}`);
      if (res.status !== 'pending') break;
    }
    if (res.status !== 'completed') { console.log(`✗ ${f.handle}: ${res.status} ${res.error || ''}`); continue; }
    let n = 0;
    for (const m of res.mockups) {
      for (const u of [m.mockup_url, ...(m.extra || []).map((e) => e.url)]) {
        const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
        fs.writeFileSync(path.join(outDir, `${f.handle}-${++n}.jpg`), buf);
      }
    }
    console.log(`✓ ${f.handle}: ${n} mockups`);
  }
}

const cmds = { verificar, envios, mockups };
if (!cmds[cmd]) { console.log('Uso: node catalogo/printful.mjs verificar | envios | mockups'); process.exit(1); }
cmds[cmd]().catch((e) => { console.error('✗', e.message); process.exit(1); });
