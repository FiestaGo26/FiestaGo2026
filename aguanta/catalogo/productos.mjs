// AGUANTA — catálogo Drop 01. Fuente única de verdad para:
//   designs/generate.mjs (archivos de impresión por producto)
//   catalogo/precios.mjs (precios.csv)
//   catalogo/printful.mjs (verificación con la API de Printful)
//   preview/ (datos de ejemplo del tema)
//
// ⚠️ COSTES Y ÁREAS = ESTIMACIONES. Este entorno no tenía acceso a printful.com,
// así que los costes base, envíos y tamaños de plantilla salen de la guía pública
// de Printful tal y como la conocíamos, no de una consulta en vivo. Antes de
// publicar: `PRINTFUL_TOKEN=... node catalogo/printful.mjs verificar` y, donde
// haya diferencia, manda Printful (actualiza aquí y vuelve a generar).

export const AJUSTES = {
  moneda: 'EUR',
  iva: 0.21, // España, PVP con IVA incluido
  comisionPct: 0.015, // Shopify Payments, tarjetas UE (plan Basic). Verificar en tu plan.
  comisionFija: 0.25,
  margenObjetivo: 0.40, // beneficio neto / ingreso sin IVA, tras coste, envío absorbido y comisión
  envioGratisDesde: 70, // € con IVA
  envioCliente: 4.95, // € con IVA que paga el cliente por debajo del umbral
  dpi: 300,
};

// Tipos de producto base de Printful (10). costeBase en € sin IVA, envío Printful a España (1ª unidad).
export const BASES = {
  camiseta: {
    nombre: 'Camiseta premium unisex',
    printful: { buscar: ['Bella + Canvas 3001', 'Unisex Staple T-Shirt'], tecnica: 'DTG' },
    costeBase: 12.5, envio: 4.49,
    tallas: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    areas: { frontal: [3600, 4800] }, // 12 × 16 in
    tejido: '100 % algodón peinado ring-spun, 142 g/m²',
  },
  oversize: {
    nombre: 'Camiseta oversize',
    printful: { buscar: ['Oversized', 'Shaka Wear', 'Garment-Dyed'], tecnica: 'DTG' },
    costeBase: 18.5, envio: 4.49,
    tallas: ['S', 'M', 'L', 'XL', '2XL'],
    areas: { frontal: [3600, 4800] },
    tejido: '100 % algodón grueso teñido en prenda, corte holgado y hombro caído',
  },
  sudadera_capucha: {
    nombre: 'Sudadera con capucha',
    printful: { buscar: ['Cotton Heritage M2580', 'Unisex Premium Hoodie'], tecnica: 'DTG' },
    costeBase: 26.0, envio: 6.49,
    tallas: ['S', 'M', 'L', 'XL', '2XL'],
    areas: { frontal: [3600, 3600] }, // limitada por el bolsillo canguro
    tejido: '80 % algodón / 20 % poliéster, interior perchado',
  },
  sudadera: {
    nombre: 'Sudadera sin capucha',
    printful: { buscar: ['Gildan 18000', 'Unisex Crew Neck Sweatshirt'], tecnica: 'DTG' },
    costeBase: 20.0, envio: 6.49,
    tallas: ['S', 'M', 'L', 'XL', '2XL'],
    areas: { frontal: [3600, 4800] },
    tejido: '50 % algodón / 50 % poliéster, 271 g/m²',
  },
  tirantes: {
    nombre: 'Camiseta de tirantes',
    printful: { buscar: ['Bella + Canvas 3480', 'Unisex Jersey Tank'], tecnica: 'DTG' },
    costeBase: 12.75, envio: 4.49,
    tallas: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    areas: { frontal: [3000, 3900] },
    tejido: '100 % algodón ring-spun, ligera',
  },
  leggings: {
    nombre: 'Leggings impresión integral',
    printful: { buscar: ['All-Over Print Leggings', 'Leggings'], tecnica: 'Sublimación integral' },
    costeBase: 25.5, envio: 4.99,
    tallas: ['XS', 'S', 'M', 'L', 'XL'],
    areas: { patron: [6000, 6000] }, // se aplica como patrón con la herramienta de Printful
    tejido: '82 % poliéster / 18 % elastano, cintura alta',
    integral: true,
  },
  shorts: {
    nombre: 'Shorts deportivos impresión integral',
    printful: { buscar: ["All-Over Print Men's Athletic Shorts", 'Athletic Shorts'], tecnica: 'Sublimación integral' },
    costeBase: 23.0, envio: 4.99,
    tallas: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    areas: { patron: [6000, 6000] },
    tejido: '100 % poliéster de secado rápido, cordón y bolsillos',
    integral: true,
  },
  gorra: {
    nombre: 'Gorra bordada',
    printful: { buscar: ['Yupoong 6245CM', 'Classic Dad Hat'], tecnica: 'Bordado' },
    costeBase: 14.5, envio: 4.49,
    tallas: ['Única'],
    areas: { bordado_frontal: [1200, 525] }, // 4 × 1,75 in
    tejido: 'Algodón chino, cierre ajustable',
  },
  bolsa: {
    nombre: 'Bolsa de cuerdas para el gimnasio',
    printful: { buscar: ['All-Over Print Drawstring Bag', 'Drawstring'], tecnica: 'Sublimación integral' },
    costeBase: 16.5, envio: 4.99,
    tallas: ['Única'],
    areas: { frontal: [4500, 5100] },
    tejido: '100 % poliéster, cordones dobles',
    integral: true,
  },
  botella: {
    nombre: 'Botella de acero inoxidable',
    printful: { buscar: ['Stainless Steel Water Bottle', 'Water Bottle'], tecnica: 'Impresión directa' },
    costeBase: 17.5, envio: 6.99,
    tallas: ['Única (500 ml aprox.)'],
    areas: { envolvente: [2850, 1200] },
    tejido: 'Acero inoxidable de doble pared',
    nota: 'Printful no tiene shaker de proteína en catálogo (a fecha de este trabajo): se sustituye por botella.',
  },
};

// 14 fichas = 10 productos base × diseños asignados.
// fondo: versión del diseño ('claro' = prenda clara, tinta oscura).
export const FICHAS = [
  { handle: 'camiseta-aguanta', base: 'camiseta', diseno: 1, fondo: 'oscuro', colores: ['Black'], titulo: 'Camiseta AGUANTA' },
  { handle: 'camiseta-un-rato-mas', base: 'camiseta', diseno: 2, fondo: 'claro', colores: ['White', 'Heather Dust'], titulo: 'Camiseta UN RATO MÁS' },
  { handle: 'camiseta-domingo-de-series', base: 'camiseta', diseno: 4, fondo: 'oscuro', colores: ['Black', 'Dark Grey Heather'], titulo: 'Camiseta DOMINGO DE SERIES' },
  { handle: 'oversize-hoy-toca', base: 'oversize', diseno: 6, fondo: 'oscuro', colores: ['Black'], titulo: 'Oversize HOY TOCA' },
  { handle: 'oversize-no-era-tan-duro', base: 'oversize', diseno: 12, fondo: 'claro', colores: ['Ivory'], titulo: 'Oversize NO ERA TAN DURO' },
  { handle: 'sudadera-capucha-aguanta', base: 'sudadera_capucha', diseno: 1, fondo: 'oscuro', colores: ['Black'], titulo: 'Sudadera con capucha AGUANTA' },
  { handle: 'sudadera-capucha-fc-aguanta', base: 'sudadera_capucha', diseno: 7, fondo: 'claro', colores: ['Bone'], titulo: 'Sudadera con capucha FC AGUANTA' },
  { handle: 'sudadera-kilometro-cero', base: 'sudadera', diseno: 3, fondo: 'claro', colores: ['Sport Grey', 'White'], titulo: 'Sudadera KILÓMETRO CERO' },
  { handle: 'tirantes-sudor-local', base: 'tirantes', diseno: 5, fondo: 'claro', colores: ['White', 'Athletic Heather'], titulo: 'Tirantes SUDOR LOCAL' },
  { handle: 'leggings-patron-a', base: 'leggings', diseno: 9, fondo: 'oscuro', colores: ['Integral'], titulo: 'Leggings PATRÓN A' },
  { handle: 'shorts-patron-b', base: 'shorts', diseno: 10, fondo: 'oscuro', colores: ['Integral'], titulo: 'Shorts PATRÓN B' },
  { handle: 'gorra-manana-tambien', base: 'gorra', diseno: 8, fondo: 'oscuro', colores: ['Black'], titulo: 'Gorra MAÑANA TAMBIÉN', archivo: 'gorra' },
  { handle: 'bolsa-respira', base: 'bolsa', diseno: 11, fondo: 'oscuro', colores: ['Integral'], titulo: 'Bolsa RESPIRA', fondoSolido: true },
  { handle: 'botella-un-rato-mas', base: 'botella', diseno: 2, fondo: 'claro', colores: ['White'], titulo: 'Botella UN RATO MÁS', archivo: 'botella' },
];
