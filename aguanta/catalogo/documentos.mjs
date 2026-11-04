#!/usr/bin/env node
// Genera, a partir de productos.mjs:
//   catalogo/subida-manual.md    checklist por ficha para crear los productos en Printful
//   catalogo/shopify-ejemplo.csv productos de EJEMPLO para la tienda de desarrollo (no para producción)
//
//   node catalogo/documentos.mjs
//   IMG_BASE=https://tu-cdn/... node catalogo/documentos.mjs   (URL pública de preview/img)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASES, FICHAS, AJUSTES } from './productos.mjs';
import { calcular } from './precios.mjs';
import { DESCRIPCIONES, LINEAS_DISENO, ALT } from '../copy/productos.mjs';
import { DESIGNS } from '../designs/designs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const IMG = (process.env.IMG_BASE || 'https://raw.githubusercontent.com/fiestago26/fiestago2026/claude/aguanta-tienda/aguanta/preview/img').replace(/\/$/, '');
const nn = (n) => String(n).padStart(2, '0');
const placementPF = { frontal: 'Frontal (Front)', patron: 'Impresión integral — patrón (All-over / Pattern)', bordado_frontal: 'Bordado frontal (Embroidery front)', envolvente: 'Envolvente (Wrap / Default)' };

let md = `# Subida manual a Printful → Shopify (14 fichas)

> La API de Printful **no permite crear productos sincronizados en una tienda Shopify** (solo en tiendas tipo "API"), así que se crean desde el panel de Printful. Este documento lo genera \`node catalogo/documentos.mjs\` a partir de \`catalogo/productos.mjs\`: si cambias algo allí, vuelve a generarlo.

**Antes de empezar**
1. \`PRINTFUL_TOKEN=… node catalogo/printful.mjs verificar\` → confirma que cada producto sigue en catálogo y sus costes. Donde haya diferencia, manda Printful.
2. \`node designs/generate.mjs\` si has cambiado áreas o diseños.
3. En Shopify, crea la colección **Drop 01 — Aguanta** (handle \`drop-01-aguanta\`, plantilla \`collection.drop\`).

**Pasos por ficha (Printful → Stores → tu tienda Shopify → Add product)**
1. Elige el producto base indicado.
2. Sube el archivo indicado en la posición indicada. Comprueba en el editor que no sale ningún aviso de baja resolución y que el diseño queda centrado arriba.
3. Selecciona solo los colores y tallas de la lista.
4. En "Product details": título, descripción (copia de \`copy/productos.md\`) y precio (PVP de la tabla, igual para todas las tallas salvo que Printful cobre más por 2XL; en ese caso súbelo 2 €).
5. Mockups: elige frontal + uno de detalle/modelo. Pon el texto alternativo indicado.
6. Envía a la tienda. Después, en Shopify: añade la ficha a la colección **Drop 01 — Aguanta**, pon la etiqueta \`nuevo\` (opcional) y el tipo de producto indicado (lo usa la guía de tallas).

| Ficha | Producto base Printful | PVP | Archivo |
|---|---|---|---|
`;
for (const f of FICHAS) {
  const b = BASES[f.base];
  md += `| ${f.titulo} | ${b.printful.buscar[0]} | ${calcular(b).pvp} € | \`designs/export/printful/${f.handle}-${Object.keys(b.areas)[0]}.png\` |\n`;
}
const tipoShopify = { camiseta: 'Camiseta', oversize: 'Camiseta oversize', sudadera_capucha: 'Sudadera', sudadera: 'Sudadera', tirantes: 'Tirantes', leggings: 'Leggings', shorts: 'Shorts', gorra: 'Gorra', bolsa: 'Bolsa', botella: 'Botella' };
for (const f of FICHAS) {
  const b = BASES[f.base];
  const [area, dims] = Object.entries(b.areas)[0];
  const d = DESIGNS.find((x) => x.n === f.diseno);
  const c = calcular(b);
  md += `\n## ${f.titulo}\n\n`;
  md += `- [ ] **Producto Printful:** ${b.printful.buscar.join(' — o, si no está, — ')} (${b.printful.tecnica})\n`;
  if (b.nota) md += `- [ ] **Nota:** ${b.nota}\n`;
  md += `- [ ] **Diseño:** ${nn(d.n)} ${d.name} — versión para fondo **${f.fondo}**\n`;
  if (area === 'patron') {
    md += `- [ ] **Archivo:** \`designs/export/printful/${f.handle}-patron.png\` (lámina ${dims.join('×')} px). En el editor de Printful usa la herramienta de patrón/fondo con el módulo \`designs/export/patrones/${nn(d.n)}-${d.slug}-${f.fondo}-modulo.png\` si prefieres que lo repita él; empalma sin costuras.\n`;
    md += `- [ ] **Posición:** ${placementPF[area]}. Cubre todas las piezas (delantero, trasero, cinturilla).\n`;
  } else {
    md += `- [ ] **Archivo:** \`designs/export/printful/${f.handle}-${area}.png\` (${dims.join('×')} px, 300 DPI, PNG transparente${f.fondoSolido ? ', con fondo negro porque es impresión integral' : ''})\n`;
    md += `- [ ] **Posición:** ${placementPF[area]}${area === 'frontal' ? ', centrado, pegado arriba del área' : ''}\n`;
  }
  if (area === 'bordado_frontal') md += `- [ ] **Hilos:** ${f.fondo === 'oscuro' ? 'blanco/hueso (#F4F1EA → elige el blanco de Printful más cercano)' : 'negro'}. Printful convierte el PNG a puntadas: revisa la vista previa del bordado.\n`;
  md += `- [ ] **Colores:** ${f.colores.join(', ')}\n`;
  md += `- [ ] **Tallas:** ${b.tallas.join(', ')}\n`;
  md += `- [ ] **Precio:** ${c.pvp},00 € (coste estimado ${b.costeBase.toFixed(2)} € + envío ${b.envio.toFixed(2)} € → margen neto ${(c.pct * 100).toFixed(1)} %)\n`;
  md += `- [ ] **Tipo de producto en Shopify:** ${tipoShopify[f.base]}\n`;
  md += `- [ ] **Texto alternativo:** ${ALT[f.diseno]}\n`;
  md += `- [ ] **Handle en Shopify:** \`${f.handle}\`\n`;
}
md += `\n## Después de subirlo todo\n\n- [ ] En Shopify > Ajustes > Envíos: tarifa España ${AJUSTES.envioCliente.toFixed(2).replace('.', ',')} € y gratis desde ${AJUSTES.envioGratisDesde} € (que coincida con la configuración del tema).\n- [ ] Haz un pedido de prueba con un código de descuento del 100 % y cancélalo en Printful antes de que entre en producción, para comprobar que el pedido llega a Printful.\n`;
fs.writeFileSync(path.join(here, 'subida-manual.md'), md);

// ── CSV de ejemplo para la tienda de desarrollo
const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const cols = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published', 'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Inventory Policy', 'Variant Fulfillment Service', 'Variant Price', 'Variant Requires Shipping', 'Variant Taxable', 'Image Src', 'Image Position', 'Image Alt Text', 'Status'];
const rows = [cols];
for (const f of FICHAS) {
  const b = BASES[f.base];
  const pvp = calcular(b).pvp.toFixed(2);
  const body = `<p><strong>${LINEAS_DISENO[f.diseno]}</strong></p><p>${DESCRIPCIONES[f.base]}</p><p>${b.tejido}.</p>`;
  b.tallas.forEach((t, i) => {
    const first = i === 0;
    rows.push([f.handle, first ? f.titulo : '', first ? body : '', first ? 'AGUANTA' : '', first ? tipoShopify[f.base] : '', first ? 'drop-01, ejemplo' : '', first ? 'TRUE' : '',
      'Talla', t, `AG-${nn(f.diseno)}-${f.base}-${t}`.toUpperCase(), 'continue', 'manual', pvp, 'TRUE', 'TRUE',
      i < 2 ? `${IMG}/${f.handle}-${i + 1}.webp` : '', i < 2 ? i + 1 : '', i < 2 ? (i === 0 ? ALT[f.diseno] : `${f.titulo}, detalle`) : '', first ? 'draft' : '']);
  });
}
fs.writeFileSync(path.join(here, 'shopify-ejemplo.csv'), rows.map((r) => r.map(esc).join(',')).join('\n') + '\n');
console.log('subida-manual.md ✓  shopify-ejemplo.csv ✓ (' + (rows.length - 1) + ' filas)');
