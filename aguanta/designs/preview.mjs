// Vista rápida a baja resolución: node designs/preview.mjs 3 4 5 → designs/export/_preview.png
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { DESIGNS } from './designs.mjs';
import { svg, C } from './lib.mjs';
const ids = process.argv.slice(2).map(Number);
const list = DESIGNS.filter((d) => !ids.length || ids.includes(d.n));
const tiles = [];
for (const d of list) for (const fo of ['claro', 'oscuro']) {
  const r = d.make(fo);
  const s = svg(r.w, r.h, r.body, { bg: fo === 'claro' ? C.hueso : C.tinta });
  tiles.push(new Resvg(s, { fitTo: { mode: 'width', value: 500 } }).render().asPng());
}
const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
const h = Math.max(...metas.map((m) => m.height));
await sharp({ create: { width: 510 * tiles.length, height: h, channels: 4, background: '#888' } })
  .composite(tiles.map((t, i) => ({ input: t, left: i * 510, top: 0 }))).png().toFile('designs/export/_preview.png');
