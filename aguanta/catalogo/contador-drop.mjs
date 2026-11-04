#!/usr/bin/env node
// Actualiza el contador del drop con unidades REALES vendidas.
// Suma las unidades de pedidos pagados (no cancelados ni reembolsadas) de los productos
// de la colección y guarda el total en el metacampo custom.unidades_vendidas de la colección.
//
//   SHOPIFY_STORE=tu-tienda.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_… node catalogo/contador-drop.mjs [handle]
//
// Token: Shopify > Ajustes > Apps > Desarrollar apps > crear app > permisos
//   read_orders, read_products, write_products (los metacampos de colección van con products).
//   Sin read_all_orders, Shopify solo deja leer los últimos 60 días: para un drop recién
//   lanzado es suficiente; si dura más, pide read_all_orders o ejecuta el script cada semana
//   y no bajará (el script nunca resta: guarda el máximo entre lo que había y lo que cuenta).
// Ejecútalo a mano, con un cron o desde una GitHub Action programada.
const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const HANDLE = process.argv[2] || 'drop-01-aguanta';
const VERSION = process.env.SHOPIFY_API_VERSION || '2025-10';
if (!STORE || !TOKEN) { console.error('Faltan SHOPIFY_STORE y SHOPIFY_ADMIN_TOKEN.'); process.exit(1); }

async function gql(query, variables = {}) {
  const res = await fetch(`https://${STORE}/admin/api/${VERSION}/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const j = await res.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

// 1. definición del metacampo (si ya existe, Shopify devuelve un error que ignoramos)
for (const [key, name] of [['unidades_vendidas', 'Unidades vendidas'], ['unidades_objetivo', 'Unidades objetivo']]) {
  await gql(`mutation($d: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $d) { userErrors { message } } }`, {
    d: { name, namespace: 'custom', key, type: 'number_integer', ownerType: 'COLLECTION', access: { storefront: 'PUBLIC_READ' } },
  }).catch(() => {});
}

// 2. colección y sus productos
const c = (await gql(`query($h: String!) { collectionByHandle(handle: $h) { id title
  metafield(namespace: "custom", key: "unidades_vendidas") { value }
  products(first: 250) { nodes { id } } } }`, { h: HANDLE })).collectionByHandle;
if (!c) { console.error(`No existe la colección "${HANDLE}".`); process.exit(1); }
const ids = new Set(c.products.nodes.map((p) => p.id));

// 3. pedidos pagados
let total = 0, after = null, pedidos = 0;
do {
  const d = await gql(`query($a: String) { orders(first: 100, after: $a, query: "financial_status:paid OR financial_status:partially_refunded") {
    pageInfo { hasNextPage endCursor }
    nodes { cancelledAt lineItems(first: 100) { nodes { currentQuantity product { id } } } } } }`, { a: after });
  for (const o of d.orders.nodes) {
    if (o.cancelledAt) continue;
    pedidos++;
    for (const li of o.lineItems.nodes) if (li.product && ids.has(li.product.id)) total += li.currentQuantity;
  }
  after = d.orders.pageInfo.hasNextPage ? d.orders.pageInfo.endCursor : null;
} while (after);

const previo = parseInt(c.metafield?.value || '0', 10);
const valor = Math.max(previo, total);
// 4. guardar (si es 0, no se guarda: el tema oculta el contador)
if (valor > 0) {
  const r = await gql(`mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { message } } }`, {
    m: [{ ownerId: c.id, namespace: 'custom', key: 'unidades_vendidas', type: 'number_integer', value: String(valor) }],
  });
  if (r.metafieldsSet.userErrors.length) throw new Error(JSON.stringify(r.metafieldsSet.userErrors));
}
console.log(`${c.title}: ${total} unidades en ${pedidos} pedidos pagados → guardado ${valor}${valor === 0 ? ' (no se muestra)' : ''}.`);
