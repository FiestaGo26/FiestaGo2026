#!/usr/bin/env node
// AGUANTA — regenera TODO el material gráfico con un comando:
//   node designs/generate.mjs            (todo)
//   node designs/generate.mjs --rapido   (sin láminas grandes de patrón)
//
// Salidas:
//   designs/src/*.svg                    fuentes vectoriales (texto ya en trazados)
//   designs/export/*.png                 másteres 4500×5400 a 300 DPI, transparentes
//   designs/export/patrones/*.png        módulos y láminas de los patrones
//   designs/export/printful/*.png        archivo ya ajustado a la plantilla de cada producto
//   designs/export/hoja-de-contacto.png  vista rápida de todo
//   brand/logo/*.svg + favicon           logotipos
//   theme/assets/*                       logo, isotipo, favicon para el tema
//   preview/img/*                        imágenes de diseño para la vista previa local
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { DESIGNS, extras, tileA, tileB } from './designs.mjs';
import { C, svg, wordmark, isoA } from './lib.mjs';
import { BASES, FICHAS, AJUSTES } from '../catalogo/productos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => path.join(ROOT, ...p);
const rapido = process.argv.includes('--rapido');
const mk = (d) => fs.mkdirSync(d, { recursive: true });
['designs/src', 'designs/export/patrones', 'designs/export/printful', 'brand/logo', 'theme/assets', 'preview/img'].forEach((d) => mk(out(d)));

const FONDOS = ['claro', 'oscuro'];
const t0 = Date.now();
let count = 0;

function render(svgStr, width) {
  const r = new Resvg(svgStr, { fitTo: width ? { mode: 'width', value: width } : { mode: 'original' }, font: { loadSystemFonts: false } });
  return r.render().asPng();
}
async function png(svgStr, file, { width, flatten } = {}) {
  let img = sharp(render(svgStr, width));
  if (flatten) img = img.flatten({ background: flatten });
  await img.png({ compressionLevel: 9, adaptiveFiltering: true }).withMetadata({ density: AJUSTES.dpi }).toFile(file);
  count++;
}
const write = (file, s) => fs.writeFileSync(file, s);
const nn = (n) => String(n).padStart(2, '0');

// ─────────────── 1. Diseños
const masters = {}; // clave `${n}-${fondo}` -> ruta png
for (const d of DESIGNS) {
  for (const fondo of FONDOS) {
    const base = `${nn(d.n)}-${d.slug}-${fondo}`;
    if (d.pattern) {
      const tile = d.make(fondo);
      const tileSvg = svg(tile.w, tile.h, tile.body);
      write(out('designs/src', `${base}-modulo.svg`), tileSvg);
      await png(tileSvg, out('designs/export/patrones', `${base}-modulo.png`));
      // lámina: el módulo repetido con <pattern>, sin costuras
      const S = rapido ? 3000 : 6000;
      const sheet = svg(S, S, `<defs><pattern id="p" width="${tile.w}" height="${tile.h}" patternUnits="userSpaceOnUse">${tile.body}</pattern></defs><rect width="${S}" height="${S}" fill="url(#p)"/>`);
      write(out('designs/src', `${base}-lamina.svg`), sheet);
      const f = out('designs/export/patrones', `${base}-lamina.png`);
      await png(sheet, f);
      masters[`${d.n}-${fondo}`] = f;
      // también en la raíz de export para que estén los 12 juntos
      await png(svg(1500 * 3, 1800 * 3, `<rect width="4500" height="5400" fill="url(#p)"/>`.replace('url(#p)', 'url(#q)').replace('<rect', `<defs><pattern id="q" width="${tile.w}" height="${tile.h}" patternUnits="userSpaceOnUse">${tile.body}</pattern></defs><rect`)), out('designs/export', `${base}.png`));
      continue;
    }
    const r = d.make(fondo);
    const s = svg(r.w, r.h, r.body);
    write(out('designs/src', `${base}.svg`), s);
    const f = out('designs/export', `${base}.png`);
    await png(s, f);
    masters[`${d.n}-${fondo}`] = f;
  }
}

// variantes de formato específico
const especiales = {};
for (const fondo of FONDOS) {
  const b = extras.d02(fondo, { w: 2850, h: 1200, layout: 'linea' });
  const sb = svg(b.w, b.h, b.body);
  write(out('designs/src', `02-un-rato-mas-botella-${fondo}.svg`), sb);
  await png(sb, (especiales[`botella-${fondo}`] = out('designs/export', `02-un-rato-mas-botella-${fondo}.png`)));
  const g = extras.d08(fondo, { w: 1200, h: 525, bordado: true });
  const sg = svg(g.w, g.h, g.body);
  write(out('designs/src', `08-manana-tambien-gorra-${fondo}.svg`), sg);
  await png(sg, (especiales[`gorra-${fondo}`] = out('designs/export', `08-manana-tambien-gorra-${fondo}.png`)));
}

// ─────────────── 2. Archivos por producto ajustados a la plantilla de Printful
const fichasInfo = [];
for (const f of FICHAS) {
  const base = BASES[f.base];
  const [area, [aw, ah]] = Object.entries(base.areas)[0];
  const d = DESIGNS.find((x) => x.n === f.diseno);
  const name = `${f.handle}-${area}.png`;
  const dest = out('designs/export/printful', name);
  if (area === 'patron') {
    fs.copyFileSync(masters[`${f.diseno}-${f.fondo}`], dest);
  } else {
    const src = f.archivo ? especiales[`${f.archivo}-${f.fondo}`] : masters[`${f.diseno}-${f.fondo}`];
    // encaja el máster dentro del área sin deformar, centrado arriba (como Printful)
    const img = sharp(src).resize(aw, ah, { fit: 'contain', position: 'north', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    let pipeline = img;
    if (f.fondoSolido) pipeline = sharp(await img.png().toBuffer()).flatten({ background: f.fondo === 'oscuro' ? C.tinta : C.hueso });
    await pipeline.png({ compressionLevel: 9 }).withMetadata({ density: AJUSTES.dpi }).toFile(dest);
    count++;
  }
  fichasInfo.push({ ...f, area, archivo: `designs/export/printful/${name}`, px: area === 'patron' ? '6000×6000 (lámina) + módulo' : `${aw}×${ah}`, disenoNombre: d.name });
}
write(out('designs/export/printful/indice.json'), JSON.stringify(fichasInfo, null, 2));

// ─────────────── 3. Logotipos
const logoSet = [
  ['positivo', C.tinta, null],
  ['negativo', C.hueso, C.tinta],
  ['monocromo-negro', '#000000', null],
  ['monocromo-blanco', '#FFFFFF', null],
  ['rojo', C.rojo, null],
];
for (const [nm, fill, bg] of logoSet) {
  const pad = 60;
  const wm = wordmark({ x: pad, y: pad, h: 300, fill, id: `logo-${nm}` });
  const W = Math.ceil(wm.x2 + pad), H = 300 + pad * 2;
  const shift = pad - wm.x1;
  const body = `<g transform="translate(${shift.toFixed(2)} 0)">${wm.markup}</g>`;
  write(out('brand/logo', `aguanta-wordmark-${nm}.svg`), svg(W, H, body, { bg }));
}
const isoSet = [
  ['tinta', C.lima, C.tinta],
  ['lima', C.tinta, C.lima],
  ['rojo', C.tinta, C.rojo],
  ['hueso', C.tinta, C.hueso],
  ['monocromo', '#000000', null],
];
for (const [nm, fg, bg] of isoSet) write(out('brand/logo', `aguanta-isotipo-${nm}.svg`), svg(1000, 1000, isoA({ size: 1000, fg, bg, id: `iso-${nm}` })));
// favicon
const favSvg = svg(512, 512, isoA({ size: 512, fg: C.lima, bg: C.tinta, id: 'fav' }));
await png(favSvg, out('brand/logo', 'favicon-512.png'));
await png(favSvg, out('theme/assets', 'favicon.png'), { width: 96 });
// logo para el tema (SVG inline-friendly, currentColor)
{
  const wm = wordmark({ x: 0, y: 0, h: 100, fill: 'currentColor', id: 'tlogo' });
  const W = Math.ceil(wm.x2 - wm.x1);
  write(out('theme/snippets', 'logo-svg.liquid'),
    `{%- comment -%} Generado por designs/generate.mjs. No editar a mano. {%- endcomment -%}\n` +
    `<svg class="logo-svg" viewBox="0 0 ${W} 100" role="img" aria-label="AGUANTA" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${(-wm.x1).toFixed(2)} 0)">${wm.markup.replace(/id="tlogo"/, 'id="tlogo{{ id | default: 1 }}"').replace(/url\(#tlogo\)/, 'url(#tlogo{{ id | default: 1 }})')}</g></svg>\n`);
  write(out('theme/snippets', 'iso-svg.liquid'),
    `{%- comment -%} Generado por designs/generate.mjs. {%- endcomment -%}\n` +
    `<svg class="iso-svg" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${isoA({ size: 100, fg: 'currentColor', bg: null, id: 'tiso{{ id | default: 1 }}' })}</svg>\n`);
}

// ─────────────── 4. Imágenes para la vista previa local / ficha (no son mockups)
// Diseño sobre el color de la prenda. Los mockups reales salen del generador de Printful.
const COLOR_PRENDA = { claro: C.hueso, oscuro: C.tinta };
for (const f of fichasInfo) {
  const src = out(f.archivo);
  const bg = BASES[f.base].integral ? null : COLOR_PRENDA[f.fondo];
  const buf = await sharp(src).resize(1100, 1100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const canvas = sharp({ create: { width: 1200, height: 1500, channels: 4, background: bg ?? C.tinta } })
    .composite([{ input: buf, gravity: 'center' }]);
  await canvas.webp({ quality: 82 }).toFile(out('preview/img', `${f.handle}-1.webp`));
  // segunda imagen (hover): detalle recortado al 160 %
  const big = await sharp(src).resize(1900, 1900, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 1500, channels: 4, background: bg ?? C.tinta } })
    .composite([{ input: await sharp(big).extract({ left: 350, top: 200, width: 1200, height: 1500 }).png().toBuffer(), gravity: 'center' }])
    .webp({ quality: 82 }).toFile(out('preview/img', `${f.handle}-2.webp`));
  count += 2;
}

// ─────────────── 5. Hoja de contacto
{
  const cell = 420, cols = 6;
  const items = DESIGNS.flatMap((d) => FONDOS.map((fo) => ({ f: masters[`${d.n}-${fo}`], fo, d })));
  const rows = Math.ceil(items.length / cols);
  const comps = [];
  for (let i = 0; i < items.length; i++) {
    const { f, fo } = items[i];
    const b = await sharp(f).resize(cell - 20, Math.round((cell - 20) * 1.2), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const tile = await sharp({ create: { width: cell, height: Math.round(cell * 1.2), channels: 4, background: fo === 'claro' ? C.hueso : C.tinta } })
      .composite([{ input: b, gravity: 'center' }]).png().toBuffer();
    comps.push({ input: tile, left: (i % cols) * cell, top: Math.floor(i / cols) * Math.round(cell * 1.2) });
  }
  await sharp({ create: { width: cols * cell, height: rows * Math.round(cell * 1.2), channels: 4, background: '#777777' } })
    .composite(comps).png().toFile(out('designs/export', 'hoja-de-contacto.png'));
}

console.log(`AGUANTA ✓ ${count} archivos generados en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
