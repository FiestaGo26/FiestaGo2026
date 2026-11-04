#!/usr/bin/env node
// Calcula el PVP recomendado de cada ficha y escribe catalogo/precios.csv
//   node catalogo/precios.mjs
//
// Margen neto = (ingreso sin IVA − coste Printful − envío absorbido − comisión de pago) / ingreso sin IVA
// Regla de envío: si el PVP queda por debajo del umbral de envío gratis, el cliente paga el envío
// (lo que cobra cubre el envío de Printful) y no se absorbe. Si el PVP supera el umbral, el envío
// lo pagamos nosotros y se mete en el cálculo. Se redondea hacia arriba a euros enteros con final 5 o 9.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AJUSTES as A, BASES, FICHAS } from './productos.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => r2(n).toFixed(2);

const redondeo = (x) => {
  let n = Math.ceil(x);
  while (![5, 9].includes(n % 10)) n++;
  return n;
};

function margen(pvp, coste, envio, absorbe) {
  const neto = pvp / (1 + A.iva);
  const cobradoCliente = absorbe ? 0 : A.envioCliente;
  const comision = (pvp + cobradoCliente) * A.comisionPct + A.comisionFija;
  const envioNeto = absorbe ? envio : Math.max(0, envio - A.envioCliente / (1 + A.iva));
  const beneficio = neto - coste - envioNeto - comision;
  return { neto, comision, beneficio, pct: beneficio / neto, envioNeto };
}

export function calcular(base) {
  const { costeBase: coste, envio } = base;
  // precio mínimo sin absorber envío
  const k = 1 - A.margenObjetivo - A.comisionPct * (1 + A.iva);
  let pvp = redondeo(((coste + A.comisionFija + A.envioCliente * A.comisionPct) / k) * (1 + A.iva));
  let absorbe = pvp >= A.envioGratisDesde;
  if (absorbe) pvp = redondeo(((coste + envio + A.comisionFija) / k) * (1 + A.iva));
  while (margen(pvp, coste, envio, absorbe).pct < A.margenObjetivo) pvp = redondeo(pvp + 1);
  const m = margen(pvp, coste, envio, absorbe);
  // peor caso: pedido de 1 unidad que, junto a otra cosa, llega al envío gratis (envío absorbido)
  const peor = margen(pvp, coste, envio, true);
  return { pvp, absorbe, ...m, peorPct: peor.pct };
}

const rows = [[
  'handle', 'producto', 'diseno', 'producto_printful', 'tecnica', 'coste_printful_sin_iva', 'envio_printful_es',
  'pvp_con_iva', 'ingreso_sin_iva', 'comision_pago', 'envio_absorbido', 'beneficio_neto', 'margen_neto_pct',
  'margen_si_envio_gratis_pct', 'estado_datos',
]];
for (const f of FICHAS) {
  const b = BASES[f.base];
  const c = calcular(b);
  rows.push([
    f.handle, f.titulo, f.diseno, b.printful.buscar[0], b.printful.tecnica, fmt(b.costeBase), fmt(b.envio),
    fmt(c.pvp), fmt(c.neto), fmt(c.comision), c.absorbe ? 'si' : 'no (lo paga el cliente)', fmt(c.beneficio),
    (c.pct * 100).toFixed(1), (c.peorPct * 100).toFixed(1), b.verificado ? 'verificado' : 'ESTIMADO - verificar con Printful',
  ]);
}
const csv = rows.map((r) => r.map((v) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n') + '\n';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.writeFileSync(path.join(here, 'precios.csv'), csv);
  console.table(rows.slice(1).map((r) => ({ ficha: r[0], coste: r[5], pvp: r[7], margen: r[12] + ' %', envioGratis: r[13] + ' %' })));
}
