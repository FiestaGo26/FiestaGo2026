// AGUANTA — utilidades de diseño vectorial.
// Todo el texto se convierte a trazados (paths) con opentype.js, así los SVG
// no dependen de fuentes instaladas y se ven igual en cualquier sitio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FONT_DIR = path.join(ROOT, 'fonts');

const load = (f) => opentype.parse(fs.readFileSync(path.join(FONT_DIR, f)).buffer);
export const fonts = {
  anton: load('Anton-Regular.ttf'),
  grotesk: load('SpaceGrotesk-500.ttf'),
  groteskBold: load('SpaceGrotesk-700.ttf'),
};

export const C = {
  tinta: '#0B0B0C',
  hueso: '#F4F1EA',
  rojo: '#FF3B1F',
  lima: '#C8FF00',
};

/** Tinta principal y acento según el color de la prenda. */
export const inks = (fondo) =>
  fondo === 'claro'
    ? { ink: C.tinta, acc: C.rojo, alt: C.tinta }
    : { ink: C.hueso, acc: C.rojo, alt: C.lima };

const CAP = { anton: 1760 / 2048 };

/** Path data propio: opentype.js 2.0 a veces escribe "NaN" al formatear números. */
export function pd(path) {
  const f = (n) => (Math.round(n * 100) / 100).toString();
  return path.commands.map((c) => {
    if (c.type === 'Z') return 'Z';
    const pts = c.type === 'C' ? [c.x1, c.y1, c.x2, c.y2, c.x, c.y] : c.type === 'Q' ? [c.x1, c.y1, c.x, c.y] : [c.x, c.y];
    return c.type + pts.map(f).join(' ');
  }).join('');
}

/**
 * Convierte texto a path. Devuelve { d, width, bbox }.
 * x,y = origen en la línea base. tracking en em (0.02 = 2 %).
 */
export function text(str, { font = fonts.anton, size = 100, x = 0, y = 0, tracking = 0, anchor = 'start' } = {}) {
  const glyphs = font.stringToGlyphs(str);
  const scale = size / font.unitsPerEm;
  let adv = 0;
  const pos = [];
  glyphs.forEach((g, i) => {
    pos.push(adv);
    adv += g.advanceWidth * scale;
    if (i < glyphs.length - 1) {
      adv += (font.getKerningValue(g, glyphs[i + 1]) || 0) * scale + tracking * size;
    }
  });
  const width = adv;
  const ox = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  let d = '';
  glyphs.forEach((g, i) => {
    d += pd(g.getPath(ox + pos[i], y, size));
  });
  return { d, width, x: ox, y, size };
}

/** Altura de mayúsculas de Anton para un tamaño. */
export const capH = (size, f = 'anton') => size * (CAP[f] ?? 0.7);

/** Tamaño de Anton para que `str` ocupe exactamente `w` de ancho. */
export function fitSize(str, w, opts = {}) {
  const t = text(str, { ...opts, size: 1000 });
  return (1000 * w) / t.width;
}

/** Ancho de tinta real (sin márgenes laterales del glifo). */
export function inkBox(str, opts) {
  const font = opts.font ?? fonts.anton;
  const p = font.getPath(str, 0, 0, opts.size ?? 100);
  return p.getBoundingBox();
}

/** Texto ajustado a un ancho exacto midiendo la tinta real. */
export function fitText(str, { x, y, w, font = fonts.anton, tracking = 0 }) {
  // primera pasada con advance, corrección con bbox real
  let size = fitSize(str, w, { font, tracking });
  for (let i = 0; i < 3; i++) {
    const t = text(str, { font, size, tracking });
    const bb = boxOf(t.d);
    size *= w / (bb.x2 - bb.x1);
  }
  const t0 = text(str, { font, size, tracking });
  const bb = boxOf(t0.d);
  const t = text(str, { font, size, tracking, x: x - bb.x1, y });
  return { ...t, size, inkW: w };
}

/** Bounding box aproximado de un path data (por puntos de control). */
export function boxOf(d) {
  const nums = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const X = nums[i], Y = nums[i + 1];
    if (X < x1) x1 = X; if (X > x2) x2 = X;
    if (Y < y1) y1 = Y; if (Y > y2) y2 = Y;
  }
  return { x1, y1, x2, y2 };
}

/** Coloca glifos a lo largo de una circunferencia (texto en sello). */
export function circleText(str, { cx, cy, r, size, font = fonts.anton, start = -90, tracking = 0.05, fill }) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(str);
  let out = '';
  let ang = start;
  for (const g of glyphs) {
    const w = g.advanceWidth * scale + tracking * size;
    const a = ang + ((w / 2) / r) * (180 / Math.PI);
    const rad = (a * Math.PI) / 180;
    const px = cx + r * Math.cos(rad);
    const py = cy + r * Math.sin(rad);
    const d = pd(g.getPath(-(g.advanceWidth * scale) / 2, 0, size));
    out += `<path transform="translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${(a + 90).toFixed(3)})" d="${d}" fill="${fill}"/>`;
    ang += (w / r) * (180 / Math.PI);
  }
  return out;
}

/** Longitud angular total que ocupa un texto en un círculo (grados). */
export function circleSpan(str, { r, size, font = fonts.anton, tracking = 0.05 }) {
  const scale = size / font.unitsPerEm;
  const w = font.stringToGlyphs(str).reduce((s, g) => s + g.advanceWidth * scale + tracking * size, 0);
  return (w / r) * (180 / Math.PI);
}

/** PRNG determinista (mulberry32) para que los diseños sean reproducibles. */
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const svg = (w, h, body, { bg } = {}) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  (bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : '') +
  body +
  `</svg>\n`;

/**
 * Isotipo: la "A" de Anton con un corte diagonal que atraviesa la pata
 * izquierda. Devuelve markup dentro de un cuadro `size` x `size`.
 */
export function isoA({ size = 1000, fg = C.hueso, bg = C.tinta, id = 'isoA', pad = 0.14, cut = true }) {
  const inner = size * (1 - pad * 2);
  // la A ocupa la altura interior
  const fs = inner / CAP.anton;
  const t = text('A', { size: fs });
  const bb = boxOf(t.d);
  const gw = bb.x2 - bb.x1;
  const ox = (size - gw) / 2 - bb.x1;
  const oy = size * pad + inner; // línea base
  const a = text('A', { size: fs, x: ox, y: oy });
  const cutMarkup = cut ? aCut({ id, x: ox + bb.x1, y: oy - inner, w: gw, h: inner }) : '';
  return (
    (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '') +
    cutMarkup +
    `<path d="${a.d}" fill="${fg}"${cut ? ` mask="url(#${id})"` : ''}/>`
  );
}

/**
 * Máscara del corte diagonal de la A: chaflán que elimina el pie izquierdo
 * (del 66 % de la altura al 30 % del ancho). Coordenadas de la caja de la A.
 */
export function aCut({ id, x, y, w, h, from = 0.66, to = 0.3 }) {
  // Chaflán recto sobre la esquina inferior izquierda.
  const big = 100000;
  const p1 = [x - w * 0.02, y + h * from];
  const p2 = [x + w * to, y + h * 1.002];
  // prolonga la línea para que el corte sea limpio
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const A = [p1[0] - dx, p1[1] - dy], B = [p2[0] + dx, p2[1] + dy];
  const pts = [A, B, [B[0], y + h * 4], [x - w * 4, y + h * 4]]
    .map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' ');
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-${big}" y="-${big}" width="${big * 2}" height="${big * 2}"><rect x="-${big}" y="-${big}" width="${big * 2}" height="${big * 2}" fill="#fff"/><polygon points="${pts}" fill="#000"/></mask></defs>`;
}

/**
 * LOGO: solo la letra A recortada, ajustada a su caja (sin cuadro ni márgenes).
 * Devuelve { markup, w, h } con origen en (0,0) y altura de mayúscula `h`.
 */
export function aMark({ h = 100, fill = C.tinta, id = 'am' } = {}) {
  const size = h / CAP.anton;
  const probe = text('A', { size, y: h });
  const bb = boxOf(probe.d);
  const a = text('A', { size, x: -bb.x1, y: h });
  const w = bb.x2 - bb.x1;
  return { markup: aCut({ id, x: 0, y: 0, w, h }) + `<path d="${a.d}" fill="${fill}" mask="url(#${id})"/>`, w, h };
}

/**
 * Wordmark AGUANTA con la A inicial cortada. Devuelve { markup, width, height }
 * con origen arriba-izquierda en (x,y) y altura de mayúscula `h`.
 */
export function wordmark({ x = 0, y = 0, h = 200, fill = C.tinta, id = 'wm', tracking = 0.02 }) {
  const size = h / CAP.anton;
  const base = y + h;
  const first = text('A', { size, x, y: base });
  const bbA = boxOf(first.d);
  const rest = text('GUANTA', { size, x: 0, y: base, tracking });
  // posición de "GUANTA" tras la A con kerning/tracking
  const font = fonts.anton;
  const gA = font.charToGlyph('A'), gG = font.charToGlyph('G');
  const scale = size / font.unitsPerEm;
  const advA = gA.advanceWidth * scale + font.getKerningValue(gA, gG) * scale + tracking * size;
  const restT = text('GUANTA', { size, x: x + advA, y: base, tracking });
  const bbR = boxOf(restT.d);
  const markup =
    aCut({ id, x: bbA.x1, y, w: bbA.x2 - bbA.x1, h }) +
    `<path d="${first.d}" fill="${fill}" mask="url(#${id})"/>` +
    `<path d="${restT.d}" fill="${fill}"/>`;
  return { markup, width: bbR.x2 - bbA.x1, x1: bbA.x1, x2: bbR.x2, height: h, size };
}
