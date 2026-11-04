// AGUANTA — los 12 diseños de la colección Drop 01.
// Cada diseño es una función (fondo) => { w, h, body, bg? }.
// fondo = 'claro' (prenda clara, tinta oscura) | 'oscuro' (prenda oscura, tinta clara).
import {
  C, inks, fonts, text, fitText, boxOf, capH, circleText, circleSpan, rng, wordmark, isoA,
} from './lib.mjs';

const W = 4500, H = 5400; // 15 × 18 in a 300 DPI

const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;

/** Escala y coloca un grupo para que quepa en (x,y,w,h). */
function place(body, bb, { x, y, w, h, align = 'center', valign = 'middle' }) {
  const bw = bb.x2 - bb.x1, bh = bb.y2 - bb.y1;
  const s = Math.min(w / bw, h / bh);
  const ox = align === 'start' ? x : align === 'end' ? x + w - bw * s : x + (w - bw * s) / 2;
  const oy = valign === 'top' ? y : valign === 'bottom' ? y + h - bh * s : y + (h - bh * s) / 2;
  return `<g transform="translate(${(ox - bb.x1 * s).toFixed(2)} ${(oy - bb.y1 * s).toFixed(2)}) scale(${s.toFixed(5)})">${body}</g>`;
}

/** Línea de texto pequeña en Space Grotesk. */
const small = (str, o) => text(str, { font: fonts.groteskBold, tracking: 0.12, ...o });

// ───────────────────────────────────────── 1. AGUANTA (apilado, se sale)
function d01(fondo) {
  const { ink, acc } = inks(fondo);
  const rowW = W * 1.42; // más ancho que el lienzo: las letras se cortan
  const probe = wordmark({ h: 100 });
  const h = (100 * rowW) / probe.width;
  const gap = 70;
  const offsets = [-W * 0.30, -W * 0.06, -W * 0.36];
  let body = `<defs><clipPath id="c1"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#c1)">`;
  const top = 90;
  offsets.forEach((ox, i) => {
    const wm = wordmark({ x: ox, y: top + i * (h + gap), h, fill: i === 1 ? acc : ink, id: `d01m${i}${fondo}` });
    body += wm.markup;
  });
  body += '</g>';
  const yF = top + 3 * h + 2 * gap + 300;
  body += p(small('AGUANTA UN RATO MÁS', { size: 150, x: 120, y: yF }).d, ink);
  body += p(small('DROP 01 / 2026', { size: 150, x: W - 120, y: yF, anchor: 'end' }).d, ink);
  body += `<rect x="120" y="${yF + 90}" width="${W - 240}" height="34" fill="${ink}"/>`;
  return { w: W, h: H, body };
}

// ───────────────────────────────────────── 2. UN RATO MÁS
function d02(fondo, { w = W, h = H, layout = 'bloque' } = {}) {
  const { ink, acc } = inks(fondo);
  if (layout === 'linea') {
    // versión envolvente para botella: una sola línea
    const a = fitText('UN RATO', { x: 0, y: 1000, w: 2000 });
    const gap = 160;
    const b = text('MÁS', { size: a.size, x: 0, y: 1000 });
    const bbB = boxOf(b.d);
    const bb2 = text('MÁS', { size: a.size, x: 2000 + gap - bbB.x1, y: 1000 });
    const body = p(a.d, ink) + p(bb2.d, acc);
    const bb = { x1: 0, y1: 1000 - capH(a.size) * 1.29, x2: 2000 + gap + (bbB.x2 - bbB.x1), y2: 1000 };
    return { w, h, body: place(body, bb, { x: w * 0.06, y: h * 0.12, w: w * 0.88, h: h * 0.76 }) };
  }
  const bw = 4000;
  const l1 = fitText('UN RATO', { x: 0, y: 0, w: bw });
  const c1 = capH(l1.size);
  const l2size = fitText('MÁS', { x: 0, y: 0, w: bw }).size;
  const accent = capH(l2size) * 0.285; // espacio de la tilde
  const y2 = c1 + 110 + accent + capH(l2size);
  const l2 = fitText('MÁS', { x: 0, y: y2, w: bw });
  const l1y = text('UN RATO', { size: l1.size, x: l1.x, y: c1 });
  const tag = small('(Y LUEGO OTRO.)', { size: 170, x: bw, y: y2 + 330, anchor: 'end' });
  const body = p(l1y.d, ink) + p(l2.d, acc) + p(tag.d, ink);
  const bb = { x1: 0, y1: 0, x2: bw, y2: y2 + 330 };
  return { w, h, body: place(body, bb, { x: 250, y: 250, w: W - 500, h: H - 500 }) };
}

// ───────────────────────────────────────── 3. KILÓMETRO CERO
function d03(fondo) {
  const { ink, acc } = inks(fondo);
  const R = rng(4041);
  const mx = 200, my = 200, mw = W - 400, mh = 2500;
  const cx = mx + mw * 0.46, cy = my + mh * 0.52;
  let lines = '';
  // calles radiales (como las que salen de la Puerta del Sol)
  const radials = 11;
  for (let i = 0; i < radials; i++) {
    const a0 = (i / radials) * Math.PI * 2 + R() * 0.3;
    let d = `M${cx.toFixed(1)} ${cy.toFixed(1)}`;
    let a = a0, x = cx, y = cy;
    for (let s = 0; s < 9; s++) {
      a += (R() - 0.5) * 0.35;
      const step = 220 + R() * 160;
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    lines += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${i % 3 ? 16 : 30}" stroke-linejoin="round"/>`;
  }
  // anillos irregulares (rondas)
  for (let k = 1; k <= 5; k++) {
    const r0 = k * 330;
    let d = '';
    const n = 48;
    const ph = R() * 6;
    for (let j = 0; j <= n; j++) {
      const t = (j / n) * Math.PI * 2;
      const r = r0 * (1 + 0.08 * Math.sin(3 * t + ph) + 0.05 * Math.sin(5 * t + k));
      d += `${j ? 'L' : 'M'}${(cx + Math.cos(t) * r * 1.15).toFixed(1)} ${(cy + Math.sin(t) * r * 0.9).toFixed(1)} `;
    }
    lines += `<path d="${d}Z" fill="none" stroke="${ink}" stroke-width="${k === 3 ? 30 : 14}" ${k % 2 ? '' : 'stroke-dasharray="60 40"'}/>`;
  }
  // ruta de 5 km en rojo
  let route = `M${cx} ${cy}`;
  const rp = [[0.62, 0.38], [0.80, 0.30], [0.88, 0.55], [0.70, 0.78], [0.42, 0.86], [0.20, 0.66], [0.26, 0.40], [0.40, 0.28]];
  rp.forEach(([a, b]) => { route += ` L${(mx + a * mw).toFixed(0)} ${(my + b * mh).toFixed(0)}`; });
  route += ` L${cx} ${cy}`;
  const map =
    `<defs><clipPath id="c3${fondo}"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}"/></clipPath></defs>` +
    `<g clip-path="url(#c3${fondo})">${lines}<path d="${route}" fill="none" stroke="${acc}" stroke-width="54" stroke-linejoin="miter"/></g>` +
    `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="none" stroke="${ink}" stroke-width="40"/>` +
    `<circle cx="${cx}" cy="${cy}" r="90" fill="${acc}"/><circle cx="${cx}" cy="${cy}" r="170" fill="none" stroke="${acc}" stroke-width="30"/>`;
  const lab = small('KM 0', { size: 120, x: cx + 220, y: cy - 60 });
  const t1 = fitText('KILÓMETRO', { x: mx, y: my + mh + 250 + capH(fitText('KILÓMETRO', { x: 0, y: 0, w: mw }).size) * 1.18, w: mw });
  const t1y = my + mh + 250 + capH(t1.size) * 1.18;
  const t2 = fitText('CERO', { x: mx, y: 0, w: mw * 0.40 });
  const t2y = t1y + 80 + capH(t2.size);
  const t2b = text('CERO', { size: t2.size, x: t2.x, y: t2y });
  const coords = [
    small('40.4168° N', { size: 150, x: mx + mw, y: t1y + 260, anchor: 'end' }),
    small('3.7038° O', { size: 150, x: mx + mw, y: t1y + 470, anchor: 'end' }),
    small('SALIDA Y META.', { size: 150, x: mx + mw, y: t1y + 680, anchor: 'end' }),
  ];
  const body = map + p(lab.d, ink) + p(t1.d, ink) + p(t2b.d, ink) + coords.map((c, i) => p(c.d, i === 2 ? acc : ink)).join('');
  return { w: W, h: H, body };
}

// ───────────────────────────────────────── 4. DOMINGO DE SERIES (marcador)
function d04(fondo) {
  const { ink, acc } = inks(fondo);
  const x = 200;
  let y = 260;
  let defs = '', body = '';
  const capT = 760, bh = 1000, padX = 110;
  const sz = capT / (1760 / 2048);
  const bars = [['DOMINGO', ink, 'full'], ['DE', acc, 'right'], ['SERIES', ink, 'left']];
  bars.forEach(([word, col, mode], i) => {
    const probe = text(word, { size: sz });
    const pb = boxOf(probe.d);
    const tw = pb.x2 - pb.x1;
    const bw = mode === 'full' ? W - 400 : tw + padX * 2;
    const bx = mode === 'right' ? W - 200 - bw - 300 : x; // ritmo irregular
    const tt = text(word, { size: sz, x: bx + padX - pb.x1, y: y + (bh + capT) / 2 });
    const id = `d04b${i}${fondo}`;
    defs += `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${tt.d}" fill="#000"/></mask>`;
    body += `<rect x="${bx}" y="${y}" width="${bw}" height="${bh}" fill="${col}" mask="url(#${id})"/>`;
    y += bh + 70;
  });
  // marcador: AGUANTA 03 — SOFÁ 00
  y += 140;
  const cellW = (W - 400 - 80) / 2;
  const cells = [['AGUANTA', '03', acc], ['SOFÁ', '00', ink]];
  cells.forEach(([lbl, num, col], i) => {
    const cx = x + i * (cellW + 80);
    body += `<rect x="${cx}" y="${y}" width="${cellW}" height="1350" fill="none" stroke="${ink}" stroke-width="40"/>`;
    body += p(small(lbl, { size: 140, x: cx + 80, y: y + 220 }).d, ink);
    const nsz = 880 / (1760 / 2048);
    const nb = boxOf(text(num, { size: nsz }).d);
    const n = text(num, { size: nsz, x: cx + cellW / 2 - (nb.x2 + nb.x1) / 2, y: y + 1240 });
    // dígitos tipo marcador: rejilla de líneas encima
    const id = `d04n${i}${fondo}`;
    let grid = '';
    for (let gy = y + 300; gy < y + 1300; gy += 70) grid += `<rect x="${cx}" y="${gy}" width="${cellW}" height="18" fill="#000"/>`;
    defs += `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${grid}</mask>`;
    body += `<path d="${n.d}" fill="${col}" mask="url(#${id})"/>`;
  });
  y += 1350 + 200;
  body += p(small('SERIE 4 × 12 · DESCANSO 1:30 · CAFÉ DESPUÉS', { size: 132, x, y }).d, ink);
  return { w: W, h: H, body: `<defs>${defs}</defs>` + body };
}

// ───────────────────────────────────────── 5. SUDOR LOCAL (sello D.O.)
function d05(fondo) {
  const { ink, acc } = inks(fondo);
  const cx = W / 2, cy = 2500, R = 2050;
  let body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="70"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${R - 520}" fill="none" stroke="${ink}" stroke-width="30"/>`;
  const ring = 'SUDOR LOCAL · DENOMINACIÓN DE ORIGEN · ';
  const size = 300, rText = R - 400;
  // ajusta el tracking para cerrar el círculo exacto
  let tr = 0.05;
  for (let i = 0; i < 20; i++) {
    const span = circleSpan(ring, { r: rText, size, tracking: tr });
    tr += ((360 - span) / 360) * ((2 * Math.PI * rText) / size) / ring.length;
  }
  body += circleText(ring, { cx, cy, r: rText, size, tracking: tr, fill: ink, start: -90 - 1 });
  // centro
  const doT = fitText('D.O.', { x: 0, y: 0, w: 2000 });
  const doY = cy + capH(doT.size) / 2 - 150;
  const doF = fitText('D.O.', { x: cx - 1000, y: doY, w: 2000 });
  body += p(doF.d, acc);
  body += p(small('AGUANTA', { size: 190, x: cx, y: doY - capH(doT.size) - 140, anchor: 'middle', tracking: 0.4 }).d, ink);
  body += `<rect x="${cx - 1000}" y="${doY + 120}" width="2000" height="26" fill="${ink}"/>`;
  body += p(small('PRODUCTO DEL ESFUERZO', { size: 135, x: cx, y: doY + 360, anchor: 'middle' }).d, ink);
  body += p(small('COSECHA 2026', { size: 135, x: cx, y: doY + 560, anchor: 'middle' }).d, ink);
  // etiqueta inferior tipo contraetiqueta
  const tagY = cy + R + 260;
  body += `<rect x="${cx - 1650}" y="${tagY}" width="3300" height="380" fill="${ink}"/>`;
  const lab = small('Nº 0001 · CONSUMIR TRAS LA DUCHA', { size: 120, x: cx, y: tagY + 235, anchor: 'middle' });
  body += `<defs><mask id="d05m${fondo}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${lab.d}" fill="#000"/></mask></defs>`;
  body = body.replace(`<rect x="${cx - 1650}" y="${tagY}" width="3300" height="380" fill="${ink}"/>`,
    `<rect x="${cx - 1650}" y="${tagY}" width="3300" height="380" fill="${ink}" mask="url(#d05m${fondo})"/>`);
  return { w: W, h: H, body };
}

// ───────────────────────────────────────── 6. HOY TOCA (tachado en mañana)
function d06(fondo) {
  const { ink, acc } = inks(fondo);
  const bw = 4000;
  const m = fitText('MAÑANA', { x: 1700, y: 0, w: 2300 });
  const mc = capH(m.size);
  const my = mc * 1.22; // espacio para la virgulilla
  const mm = fitText('MAÑANA', { x: 1700, y: my, w: 2300 });
  const strike = `<rect x="1620" y="${(my - mc * 0.52).toFixed(0)}" width="2460" height="${(mc * 0.16).toFixed(0)}" fill="${acc}" transform="rotate(-4 2850 ${my - mc / 2})"/>`;
  const hoy = fitText('HOY', { x: 0, y: 0, w: bw });
  const hy = my + 140 + capH(hoy.size);
  const hoyT = fitText('HOY', { x: 0, y: hy, w: bw });
  const toca = fitText('TOCA', { x: 0, y: 0, w: bw });
  const ty = hy + 110 + capH(toca.size);
  const tocaT = fitText('TOCA', { x: 0, y: ty, w: bw });
  const body = p(mm.d, ink, ' opacity="1"') + strike + p(hoyT.d, ink) + p(tocaT.d, ink);
  return { w: W, h: H, body: place(body, { x1: 0, y1: 0, x2: bw, y2: ty }, { x: 220, y: 220, w: W - 440, h: H - 440 }) };
}

// ───────────────────────────────────────── 7. FC AGUANTA (escudo)
function d07(fondo) {
  const { ink, acc } = inks(fondo);
  const cx = W / 2;
  const top = 500, sw = 3200, sh = 3900;
  const l = cx - sw / 2, r = cx + sw / 2;
  // escudo: borde superior con muescas, laterales que bajan a punta
  const shield = `M${l} ${top} L${cx - 400} ${top} L${cx - 300} ${top + 160} L${cx + 300} ${top + 160} L${cx + 400} ${top} L${r} ${top}
    L${r} ${top + sh * 0.55} C${r} ${top + sh * 0.82} ${cx + 700} ${top + sh * 0.93} ${cx} ${top + sh}
    C${cx - 700} ${top + sh * 0.93} ${l} ${top + sh * 0.82} ${l} ${top + sh * 0.55} Z`;
  const id = `d07${fondo}`;
  let stripes = '';
  const n = 7, stW = sw / n;
  for (let i = 0; i < n; i += 2) stripes += `<rect x="${l + i * stW}" y="${top}" width="${stW}" height="${sh}" fill="${acc}"/>`;
  // banda superior
  const bandY = top + 420, bandH = 900;
  const fc = fitText('FC AGUANTA', { x: l + 220, y: bandY + 250 + 400, w: sw - 440 });
  const fcY = bandY + bandH / 2 + capH(fc.size) / 2;
  const fcT = fitText('FC AGUANTA', { x: l + 220, y: fcY, w: sw - 440 });
  let body = `<defs><clipPath id="${id}c"><path d="${shield}"/></clipPath>` +
    `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${fcT.d}" fill="#000"/></mask></defs>`;
  body += `<g clip-path="url(#${id}c)">${stripes}<rect x="${l}" y="${bandY}" width="${sw}" height="${bandH}" fill="${ink}"/><path d="${fcT.d}" fill="${fondo === 'claro' ? C.hueso : C.tinta}"/></g>`;
  body += `<path d="${shield}" fill="none" stroke="${ink}" stroke-width="90" stroke-linejoin="miter"/>`;
  // medallón central con la A
  const my = bandY + bandH + 1050;
  body += `<circle cx="${cx}" cy="${my}" r="760" fill="${fondo === 'claro' ? C.hueso : C.tinta}" stroke="${ink}" stroke-width="60"/>`;
  body += `<g transform="translate(${cx - 620} ${my - 620})">${isoA({ size: 1240, fg: ink, bg: null, id: id + 'a', pad: 0.12 })}</g>`;
  // año
  const yr = small('— 2026 —', { size: 220, x: cx, y: top + sh + 420, anchor: 'middle', tracking: 0.3 });
  const lema = small('FUNDADO UN DOMINGO CUALQUIERA', { size: 140, x: cx, y: top + sh + 700, anchor: 'middle' });
  body += p(yr.d, ink) + p(lema.d, ink);
  return { w: W, h: H, body };
}

// ───────────────────────────────────────── 8. MAÑANA TAMBIÉN (pecho / gorra)
function d08(fondo, { w = 1500, h = 1500, bordado = false } = {}) {
  const { ink, acc } = inks(fondo);
  const bw = 1000;
  const a = fitText('MAÑANA', { x: 0, y: 0, w: bw });
  const ca = capH(a.size);
  const ay = ca * 1.2;
  const aT = fitText('MAÑANA', { x: 0, y: ay, w: bw });
  const b = fitText('TAMBIÉN', { x: 0, y: 0, w: bw * 0.86 });
  const by = ay + 40 + capH(b.size) * 1.28;
  const bT = fitText('TAMBIÉN', { x: 0, y: by, w: bw * 0.86 });
  const dot = `<rect x="${bw * 0.9}" y="${by - capH(b.size) * 0.3}" width="${bw * 0.1}" height="${capH(b.size) * 0.3}" fill="${bordado ? ink : acc}"/>`;
  const body = p(aT.d, ink) + p(bT.d, ink) + dot;
  const pad = bordado ? 0.04 : 0.1;
  return { w, h, body: place(body, { x1: 0, y1: 0, x2: bw, y2: by }, { x: w * pad, y: h * pad, w: w * (1 - 2 * pad), h: h * (1 - 2 * pad) }) };
}

// ───────────────────────────────────────── 9. PATRÓN A (isotipo repetido)
export function tileA(fondo, T = 1500) {
  const bg = fondo === 'claro' ? C.hueso : C.tinta;
  const fg = fondo === 'claro' ? C.tinta : C.hueso;
  const acc = fondo === 'claro' ? C.rojo : C.lima;
  const n = 4, cell = T / n;
  let body = `<rect width="${T}" height="${T}" fill="${bg}"/>`;
  let k = 0;
  for (let row = 0; row < n; row++) {
    for (let col = -1; col <= n; col++) {
      const ox = col * cell + (row % 2 ? cell / 2 : 0);
      const oy = row * cell;
      if (ox + cell < 0 || ox > T) continue;
      const c = ((col % n) + n) % n;
      const colr = (row * 3 + c) % 7 === 2 ? acc : fg;
      const rot = (row + c) % 2 ? 180 : 0;
      body += `<g transform="translate(${ox} ${oy}) rotate(${rot} ${cell / 2} ${cell / 2})">${isoA({ size: cell, fg: colr, bg: null, id: `tA${fondo}${k++}`, pad: 0.17 })}</g>`;
    }
  }
  return { w: T, h: T, body };
}

// ───────────────────────────────────────── 10. PATRÓN B (pista de atletismo)
export function tileB(fondo, T = 1800) {
  const bg = fondo === 'oscuro' ? C.tinta : C.hueso;
  const fg = fondo === 'oscuro' ? C.lima : C.tinta;
  const acc = fondo === 'oscuro' ? C.lima : C.rojo;
  const lanes = 8, lw = T / lanes;
  let body = `<rect width="${T}" height="${T}" fill="${bg}"/>`;
  // líneas de calle: onda con periodo = T para que el módulo empalme
  for (let i = 0; i <= lanes; i++) {
    let d = '';
    for (let s = 0; s <= 60; s++) {
      const y = (s / 60) * T;
      const x = i * lw + 110 * Math.sin((y / T) * Math.PI * 2);
      d += `${s ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    body += `<path d="${d}" fill="none" stroke="${fg}" stroke-width="16"/>`;
    // copia desplazada para que empalme horizontal
    if (i === 0) body += `<path d="${d}" transform="translate(${T} 0)" fill="none" stroke="${fg}" stroke-width="16"/>`;
  }
  // números de calle y marcas de salida escalonadas
  for (let i = 0; i < lanes; i++) {
    const y = ((i * 0.13 + 0.08) % 1) * T;
    const x = i * lw + lw / 2 + 110 * Math.sin((y / T) * Math.PI * 2);
    const num = text(String(i + 1), { size: 230, x, y: y + 95, anchor: 'middle' });
    body += `<path d="${num.d}" fill="${acc}"/>`;
    body += `<rect x="${(x - lw * 0.42).toFixed(1)}" y="${(y + 170).toFixed(1)}" width="${(lw * 0.84).toFixed(1)}" height="14" fill="${fg}"/>`;
  }
  return { w: T, h: T, body };
}

// ───────────────────────────────────────── 11. RESPIRA (estirado en vertical)
function d11(fondo) {
  const { ink, acc } = inks(fondo);
  const letters = 'RESPIRA'.split('');
  const totalW = 4100, gap = 40;
  const base = text('R', { size: 1000 });
  const widths = letters.map((ch) => { const bb = boxOf(text(ch, { size: 1000 }).d); return bb.x2 - bb.x1; });
  const sumW = widths.reduce((a, b) => a + b, 0);
  const sx = (totalW - gap * (letters.length - 1)) / sumW;
  const bottom = 5000;
  let x = 200, body = '';
  letters.forEach((ch, i) => {
    const t = text(ch, { size: 1000 });
    const bb = boxOf(t.d);
    const targetH = 1700 + (i / (letters.length - 1)) * 2900; // inhala: cada letra más alta
    const sy = targetH / (bb.y2 - bb.y1);
    body += `<path d="${t.d}" fill="${i === letters.length - 1 ? acc : ink}" transform="translate(${(x - bb.x1 * sx).toFixed(1)} ${(bottom - bb.y2 * sy).toFixed(1)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})"/>`;
    x += widths[i] * sx + gap;
  });
  void base;
  const lines = ['INHALA 4', 'AGUANTA 4', 'EXHALA 4', 'REPITE'];
  lines.forEach((l, i) => { body += p(small(l, { size: 140, x: 200, y: 400 + i * 210 }).d, i === 1 ? acc : ink); });
  body += `<rect x="200" y="${bottom + 140}" width="${totalW}" height="40" fill="${ink}"/>`;
  return { w: W, h: H, body };
}

// ───────────────────────────────────────── 12. NO ERA TAN DURO (la broma)
function d12(fondo) {
  const { ink, acc } = inks(fondo);
  const bw = 2600;
  const a = fitText('NO ERA', { x: 0, y: 0, w: bw * 0.62 });
  const ay = capH(a.size);
  const aT = fitText('NO ERA', { x: 0, y: ay, w: bw * 0.62 });
  const b = fitText('TAN DURO.', { x: 0, y: 0, w: bw });
  const by = ay + 70 + capH(b.size);
  const bT = fitText('TAN DURO.', { x: 0, y: by, w: bw });
  const foot = text('*mentira, sí lo era.', { font: fonts.grotesk, size: 150, x: bw, y: by + 260, anchor: 'end' });
  const ast = text('*', { font: fonts.groteskBold, size: 420, x: bw * 0.64, y: ay + 120 });
  const body = p(aT.d, ink) + p(ast.d, acc) + p(bT.d, ink) + p(foot.d, acc);
  // arriba, centrado: posición de espalda bajo el cuello / pecho
  return { w: W, h: H, body: place(body, { x1: 0, y1: 0, x2: bw, y2: by + 300 }, { x: (W - bw) / 2, y: 300, w: bw, h: 2000, valign: 'top' }) };
}

export const DESIGNS = [
  { n: 1, slug: 'aguanta', name: 'AGUANTA', make: d01 },
  { n: 2, slug: 'un-rato-mas', name: 'UN RATO MÁS', make: d02 },
  { n: 3, slug: 'kilometro-cero', name: 'KILÓMETRO CERO', make: d03 },
  { n: 4, slug: 'domingo-de-series', name: 'DOMINGO DE SERIES', make: d04 },
  { n: 5, slug: 'sudor-local', name: 'SUDOR LOCAL', make: d05 },
  { n: 6, slug: 'hoy-toca', name: 'HOY TOCA', make: d06 },
  { n: 7, slug: 'fc-aguanta', name: 'FC AGUANTA', make: d07 },
  { n: 8, slug: 'manana-tambien', name: 'MAÑANA TAMBIÉN', make: d08 },
  { n: 9, slug: 'patron-a', name: 'PATRÓN A', make: tileA, pattern: true },
  { n: 10, slug: 'patron-b', name: 'PATRÓN B', make: tileB, pattern: true },
  { n: 11, slug: 'respira', name: 'RESPIRA', make: d11 },
  { n: 12, slug: 'no-era-tan-duro', name: 'NO ERA TAN DURO', make: d12 },
];

export const extras = { d02, d08 };
