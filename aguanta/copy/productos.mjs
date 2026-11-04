// Copy de producto. Descripción por producto base (máx. 60 palabras) + una línea por diseño.
// Se usa en la vista previa local, en catalogo/shopify-ejemplo.csv y en copy/productos.md.
//   node copy/productos.mjs   → regenera copy/productos.md

export const DESCRIPCIONES = {
  camiseta:
    'La camiseta que vas a coger del cajón aunque haya otras diez. Algodón peinado, suave desde el primer lavado y con el peso justo: ni sábana ni cartón. Sirve para entrenar, para el vermut de después y para fingir que has entrenado. Se fabrica cuando la pides.',
  oversize:
    'Corte ancho, hombro caído y algodón grueso teñido en prenda, así que cada una sale con su tono, un poco distinto. Queda bien con todo y perdona el día de pierna. Coge tu talla de siempre: lo holgado ya viene de serie.',
  sudadera_capucha:
    'Para los días en los que el calentamiento empieza en el sofá. Felpa perchada por dentro, capucha de verdad y bolsillo canguro para el móvil, las llaves y la excusa. Abriga lo suficiente para salir a correr en enero. Lo de correr ya es cosa tuya.',
  sudadera:
    'Sudadera de cuello redondo, sin capucha y sin dramas. Mezcla de algodón y poliéster que aguanta lavadas, viajes en la mochila y alguna caída en el suelo del vestuario. Ideal para entrar en calor, para el después y para el domingo entero.',
  tirantes:
    'Tirantes de algodón ligero para cuando la camiseta sobra. Sisa amplia, tela fresca y un estampado que se ve desde la otra punta de la sala. Para pesas, para correr con calor y para enseñar el progreso. Si no hay progreso, para enseñar la actitud.',
  leggings:
    'Leggings de cintura alta que se quedan donde los dejas: sin bajarse en la sentadilla ni transparentar en la zancada. Tejido elástico de secado rápido, estampado integral que no se cuartea. Hechos uno a uno, a tu talla, cuando los pides.',
  shorts:
    'Shorts ligeros de secado rápido, con cordón, bolsillos y un largo pensado para correr sin pelearte con ellos. Estampado integral sublimado: no se cuartea, no pesa, no se va con los lavados. Para series, para la playa y para el sprint al autobús.',
  gorra:
    'Gorra de algodón con visera curva y cierre ajustable. El bordado es pequeño, a propósito: quien lo lee, lo entiende. Para correr con sol, para el día después de correr y para disimular el pelo después de nadar. Talla única que vale para casi todos.',
  bolsa:
    'Bolsa de cuerdas para llevar lo justo: toalla, zapatillas y la botella que siempre te dejas. Ligera, plegable y con un estampado que no se confunde con la de nadie en el vestuario. Se cuelga a la espalda y listo. Lo de ir, ya depende de ti.',
  botella:
    'Botella de acero inoxidable de doble pared: el agua fría sigue fría y el café no se entera de que es lunes. Sin sabor a plástico y sin fugas en la mochila. Lleva la frase justa para el último kilómetro. Rellénala, que para eso está.',
};

// Una línea por diseño (va antes de la descripción base en cada ficha).
export const LINEAS_DISENO = {
  1: 'AGUANTA en grande, tan grande que no cabe. Como las ganas de dejarlo en la última serie.',
  2: 'UN RATO MÁS. Y luego otro. El MÁS va en rojo porque es la parte que duele.',
  3: 'KILÓMETRO CERO: el mapa del sitio donde empieza todo. Salida y meta, como cada domingo.',
  4: 'DOMINGO DE SERIES. Marcador final: AGUANTA 03, SOFÁ 00.',
  5: 'SUDOR LOCAL, con denominación de origen. Producto del esfuerzo, cosecha 2026.',
  6: 'MAÑANA, tachado. HOY TOCA, en grande. No hay más que hablar.',
  7: 'FC AGUANTA, el club que no tiene liga pero sí escudo. Fundado un domingo cualquiera.',
  8: 'MAÑANA TAMBIÉN, bordado y pequeño. Para los que repiten.',
  9: 'PATRÓN A: el isotipo de AGUANTA repetido de arriba abajo, en hueso y lima sobre negro.',
  10: 'PATRÓN B: las calles de una pista de atletismo en lima sobre negro. Tú vas por la tuya.',
  11: 'RESPIRA, con letras que se estiran como una inspiración larga. Inhala 4, aguanta 4, exhala 4.',
  12: 'NO ERA TAN DURO*. *Mentira, sí lo era. La broma de la colección.',
};

// Texto alternativo de la imagen principal de cada ficha (la usa la vista previa; en Shopify ponlo en cada mockup).
export const ALT = {
  1: 'Wordmark AGUANTA gigante en hueso y rojo, cortado por los bordes',
  2: 'Texto UN RATO en bloque y MÁS en rojo debajo',
  3: 'Mapa de líneas abstracto con ruta roja, KILÓMETRO CERO y coordenadas',
  4: 'Barras tipo marcador con DOMINGO DE SERIES y marcador AGUANTA 03 SOFÁ 00',
  5: 'Sello circular SUDOR LOCAL denominación de origen con D.O. en rojo',
  6: 'MAÑANA tachado en rojo sobre HOY TOCA en letras enormes',
  7: 'Escudo FC AGUANTA con franjas rojas, la A en el centro y 2026',
  8: 'Bordado pequeño MAÑANA TAMBIÉN con punto rojo',
  9: 'Patrón repetido de la A de AGUANTA en hueso y lima sobre negro',
  10: 'Patrón de calles de pista de atletismo en lima sobre negro con números',
  11: 'RESPIRA con letras que se estiran en vertical, la A final en rojo',
  12: 'Frase pequeña NO ERA TAN DURO con asterisco rojo y nota mentira, sí lo era',
};

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { BASES, FICHAS } = await import('../catalogo/productos.mjs');
  const { calcular } = await import('../catalogo/precios.mjs');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const words = (s) => s.split(/\s+/).filter(Boolean).length;
  let md = '# Descripciones de producto\n\nCada ficha = **línea del diseño** + **descripción del producto base**. Pégalo en la descripción del producto en Shopify después de sincronizar con Printful.\n\n## Productos base (10)\n';
  for (const [k, v] of Object.entries(DESCRIPCIONES)) md += `\n### ${BASES[k].nombre} (${words(v)} palabras)\n${v}\n`;
  md += '\n## Fichas (14)\n';
  for (const f of FICHAS) {
    md += `\n### ${f.titulo} — ${calcular(BASES[f.base]).pvp} €\n**${LINEAS_DISENO[f.diseno]}**\n\n${DESCRIPCIONES[f.base]}\n\n_Alt de la imagen principal:_ ${ALT[f.diseno]}\n`;
  }
  fs.writeFileSync(path.join(here, 'productos.md'), md);
  const max = Math.max(...Object.values(DESCRIPCIONES).map(words));
  console.log('productos.md ✓ — descripción más larga:', max, 'palabras');
}
