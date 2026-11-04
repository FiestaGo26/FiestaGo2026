#!/usr/bin/env node
// Vista previa local del tema AGUANTA con datos de ejemplo, SIN tienda Shopify.
//   node preview/server.mjs        → http://localhost:4545
//
// Renderiza los mismos archivos Liquid de /theme con LiquidJS y simula lo mínimo
// de Shopify (objetos, filtros, formularios, carrito AJAX). Sirve para revisar
// diseño y comportamiento. La referencia final es `shopify theme dev` en tu tienda.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid, Tag, Hash } from 'liquidjs';
import { BASES, FICHAS, AJUSTES } from '../catalogo/productos.mjs';
import { calcular } from '../catalogo/precios.mjs';
import { DESCRIPCIONES, LINEAS_DISENO, ALT } from '../copy/productos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEME = path.join(ROOT, 'theme');
const PORT = +process.env.PORT || 4545;
const read = (p) => fs.readFileSync(path.join(THEME, p), 'utf8');
const locale = JSON.parse(read('locales/es.default.json'));

// ───────────────────────── datos de ejemplo
const img = (src, alt = '', w = 1200, h = 1500) => ({ src, url: src, alt, width: w, height: h, aspect_ratio: w / h, preview_image: null });
const tipo = { camiseta: 'Camiseta', oversize: 'Camiseta oversize', sudadera_capucha: 'Sudadera', sudadera: 'Sudadera', tirantes: 'Tirantes', leggings: 'Leggings', shorts: 'Shorts', gorra: 'Gorra', bolsa: 'Bolsa', botella: 'Botella' };
const products = FICHAS.map((f, i) => {
  const b = BASES[f.base];
  const pvp = calcular(b).pvp * 100;
  const m1 = img(`/preview/img/${f.handle}-1.webp`, `${f.titulo}: ${ALT[f.diseno]}`);
  const m2 = img(`/preview/img/${f.handle}-2.webp`, `${f.titulo}, detalle del estampado`);
  [m1, m2].forEach((m, k) => { Object.defineProperty(m, 'preview_image', { value: m, enumerable: false }); m.id = i * 10 + k + 1; });
  const tallas = b.tallas;
  const variants = tallas.map((t, k) => ({
    id: 1000 + i * 20 + k, title: t, options: [t], option1: t, available: true, price: pvp, compare_at_price: null,
    sku: `AG-${f.diseno}-${f.base}-${t}`.toUpperCase(), url: `/products/${f.handle}?variant=${1000 + i * 20 + k}`, featured_media: null,
  }));
  const single = tallas.length === 1;
  return {
    id: i + 1, handle: f.handle, title: f.titulo, url: `/products/${f.handle}`, type: tipo[f.base],
    description: `<p><strong>${LINEAS_DISENO[f.diseno]}</strong></p><p>${DESCRIPCIONES[f.base]}</p><p>${b.tejido}.</p>`,
    price: pvp, price_varies: false, compare_at_price: null, available: true, tags: i < 4 ? ['nuevo'] : [],
    media: [m1, m2], featured_media: m1, featured_image: m1, images: [m1, m2],
    variants, selected_or_first_available_variant: variants[0], has_only_default_variant: single,
    options: single ? ['Title'] : ['Talla'],
    options_with_values: single ? [] : [{ name: 'Talla', values: tallas, selected_value: tallas[0], position: 1 }],
    metafields: { custom: {} }, collections: [],
  };
});
const drop = { id: 1, handle: 'drop-01-aguanta', title: 'Drop 01 — Aguanta', url: '/collections/drop-01-aguanta', template_suffix: 'drop', description: '<p>Doce diseños para gente que entrena entre semana y lo cuenta el domingo. Se fabrican cuando los pides.</p>', products, products_count: products.length, all_products_count: products.length, sort_options: [{ value: 'manual', name: 'Destacados' }, { value: 'price-ascending', name: 'Precio: de menor a mayor' }, { value: 'price-descending', name: 'Precio: de mayor a menor' }], sort_by: 'manual', featured_image: products[0].media[0], metafields: { custom: {} } };
// ⚠️ Contador del drop: sin datos reales en la vista previa. Para verlo con datos, arranca con
//   DROP_VENDIDAS=37 DROP_OBJETIVO=200 node preview/server.mjs   (sólo para revisar el diseño)
if (process.env.DROP_VENDIDAS) {
  drop.metafields.custom.unidades_vendidas = { value: +process.env.DROP_VENDIDAS };
  if (process.env.DROP_OBJETIVO) drop.metafields.custom.unidades_objetivo = { value: +process.env.DROP_OBJETIVO };
}
const all = { ...drop, handle: 'all', title: 'Todo', url: '/collections/all', template_suffix: null, description: '' };
products.forEach((p) => { p.collections = [drop]; });
const collections = { 'drop-01-aguanta': drop, all };
const pageCopy = (h) => { try { return fs.readFileSync(path.join(ROOT, 'copy/paginas', `${h}.html`), 'utf8'); } catch { return ''; } };
const pages = {
  'sobre-aguanta': { title: 'Sobre AGUANTA', suffix: 'sobre' },
  'envios-y-devoluciones': { title: 'Envíos y devoluciones', suffix: 'envios' },
  'guia-de-tallas': { title: 'Guía de tallas', suffix: 'tallas' },
  contacto: { title: 'Contacto', suffix: 'contacto' },
  'preguntas-frecuentes': { title: 'Preguntas frecuentes', suffix: 'faq' },
};
const link = (title, url) => ({ title, url, active: false, links: [] });
const linklists = {
  'main-menu': { title: 'Tienda', links: [link('Drop 01', '/collections/drop-01-aguanta'), link('Todo', '/collections/all'), link('Sobre AGUANTA', '/pages/sobre-aguanta'), link('FAQ', '/pages/preguntas-frecuentes')] },
  footer: { title: 'Ayuda', links: [link('Envíos y devoluciones', '/pages/envios-y-devoluciones'), link('Guía de tallas', '/pages/guia-de-tallas'), link('Preguntas frecuentes', '/pages/preguntas-frecuentes'), link('Contacto', '/pages/contacto')] },
};

let cartItems = []; // { key, variant, product, quantity }
function cartObj() {
  const items = cartItems.map((c) => ({
    key: c.key, quantity: c.quantity, url: c.product.url, image: c.product.featured_media, product: c.product, variant: c.variant,
    final_line_price: c.variant.price * c.quantity, title: c.product.title,
  }));
  const total = items.reduce((s, x) => s + x.final_line_price, 0);
  return { items, item_count: items.reduce((s, x) => s + x.quantity, 0), total_price: total, note: '', currency: { iso_code: 'EUR' } };
}

// ───────────────────────── motor Liquid
const engine = new Liquid({ root: [path.join(THEME, 'snippets')], extname: '.liquid', dynamicPartials: true, strictFilters: false, jsTruthy: false, cache: false });

const money = (c) => (Number(c || 0) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const tr = (key, args = {}) => {
  let v = key.split('.').reduce((o, k) => (o ? o[k] : undefined), locale);
  if (v && typeof v === 'object') v = args.count === 1 ? v.one : v.other;
  if (typeof v !== 'string') return key;
  return v.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (args[k] ?? ''));
};
const kw = (args) => { const o = {}; for (let i = 0; i < args.length; i++) { const a = args[i]; if (Array.isArray(a)) o[a[0]] = a[1]; } return o; };
engine.registerFilter('t', function (k, ...a) { return tr(k, kw(a)); });
engine.registerFilter('asset_url', (f) => `/assets/${f}`);
engine.registerFilter('stylesheet_tag', (u) => `<link rel="stylesheet" href="${u}">`);
engine.registerFilter('preload_tag', function (u, ...a) { const o = kw(a); return `<link rel="preload" href="${u}" as="${o.as}" type="${o.type}" crossorigin>`; });
engine.registerFilter('image_url', (i) => (i && (i.src || i)) || '');
engine.registerFilter('image_tag', function (u, ...a) {
  const o = kw(a);
  const ws = String(o.widths || '').split(',').map((s) => s.trim()).filter(Boolean);
  const srcset = ws.length ? ` srcset="${ws.map((w) => `${u}?width=${w} ${w}w`).join(', ')}"` : '';
  return `<img src="${u}"${srcset}${o.sizes ? ` sizes="${o.sizes}"` : ''} alt="${(o.alt || '').replace(/"/g, '&quot;')}"${o.class ? ` class="${o.class}"` : ''} loading="${o.loading || 'lazy'}"${o.fetchpriority ? ` fetchpriority="${o.fetchpriority}"` : ''} width="1200" height="1500">`;
});
engine.registerFilter('money', money);
engine.registerFilter('money_without_currency', (c) => (Number(c || 0) / 100).toFixed(2));
engine.registerFilter('placeholder_svg_tag', (n, cls) => `<svg class="${cls || ''}" viewBox="0 0 400 500"><rect width="400" height="500"/></svg>`);
engine.registerFilter('payment_type_svg_tag', () => '');
engine.registerFilter('metafield_tag', (m) => (m && m.value) || '');
engine.registerFilter('default_errors', () => '');
engine.registerFilter('default_pagination', () => '');
engine.registerFilter('format_code', (c) => c);
engine.registerFilter('json', (v) => JSON.stringify(v));
engine.registerFilter('handle', (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('escape', (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));

// {% form 'tipo', obj, id: x, class: y %}…{% endform %}
engine.registerTag('form', {
  parse(token, remain) {
    const m = token.args.match(/^\s*'([^']+)'\s*(?:,\s*([a-z_.]+)(?=\s*,|\s*$))?\s*,?\s*(.*)$/s);
    this.kind = m[1]; this.hash = new Hash(m[3] || '');
    this.tpls = [];
    const stream = this.liquid.parser.parseStream(remain).on('tag:endform', () => stream.stop()).on('template', (t) => this.tpls.push(t)).on('end', () => { throw new Error('form sin endform'); });
    stream.start();
  },
  *render(ctx, emitter) {
    const h = yield this.hash.render(ctx);
    const actions = { product: '/cart/add', contact: '/contact', customer: '/contact' };
    const attrs = Object.entries(h).map(([k, v]) => `${k}="${v}"`).join(' ');
    emitter.write(`<form method="post" action="${actions[this.kind] || '#'}" ${attrs}>`);
    ctx.push({ form: { posted_successfully: false, errors: null } });
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    ctx.pop();
    emitter.write('</form>');
  },
});
// {% paginate x by n %}…{% endpaginate %}
engine.registerTag('paginate', {
  parse(token, remain) {
    this.tpls = [];
    const stream = this.liquid.parser.parseStream(remain).on('tag:endpaginate', () => stream.stop()).on('template', (t) => this.tpls.push(t));
    stream.start();
  },
  *render(ctx, emitter) {
    ctx.push({ paginate: { pages: 1, current_page: 1, parts: [] } });
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    ctx.pop();
  },
});
// {% schema %} → nada
engine.registerTag('schema', {
  parse(token, remain) { const s = this.liquid.parser.parseStream(remain).on('tag:endschema', () => s.stop()); s.on('template', () => {}); s.start(); },
  render() { return ''; },
});
engine.registerTag('section', {
  parse(token) { this.name = token.args.trim().replace(/['"]/g, ''); },
  *render(ctx, emitter) { emitter.write(yield renderSection(this.name, 'static-' + this.name, {}, ctx.getAll())); },
});
engine.registerTag('sections', {
  parse(token) { this.name = token.args.trim().replace(/['"]/g, ''); },
  *render(ctx, emitter) {
    const g = JSON.parse(read(`sections/${this.name}.json`));
    for (const id of g.order) emitter.write(yield renderSection(g.sections[id].type, `${this.name}-${id}`, g.sections[id], ctx.getAll()));
  },
});

function schemaOf(type) {
  const src = read(`sections/${type}.liquid`);
  const m = src.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  return m ? JSON.parse(m[1]) : { settings: [] };
}
function resolveSetting(def, val) {
  if (val === undefined || val === null || val === '') val = def.default;
  if (val === undefined) return def.type === 'checkbox' ? false : '';
  switch (def.type) {
    case 'product': return products.find((p) => p.handle === val) || '';
    case 'collection': return collections[val] || '';
    case 'link_list': return linklists[val] || '';
    case 'url': return typeof val === 'string' ? val.replace('shopify://collections/', '/collections/').replace('shopify://pages/', '/pages/').replace('shopify://products/', '/products/') : val;
    default: return val;
  }
}
const settingsFrom = (defs = [], given = {}) => Object.fromEntries(defs.filter((d) => d.id).map((d) => [d.id, resolveSetting(d, given[d.id])]));

async function renderSection(type, id, data, scope) {
  const schema = schemaOf(type);
  const section = { id, settings: settingsFrom(schema.settings, data.settings || {}), blocks: [] };
  let order = data.block_order || [];
  let blocks = data.blocks || {};
  if (!order.length && schema.presets?.[0]?.blocks && !data.type) { // estática con preset
    blocks = Object.fromEntries(schema.presets[0].blocks.map((b, i) => [`b${i}`, b])); order = Object.keys(blocks);
  }
  section.blocks = order.map((bid) => {
    const b = blocks[bid];
    const def = (schema.blocks || []).find((x) => x.type === b.type) || { settings: [] };
    return { id: bid, type: b.type, settings: settingsFrom(def.settings, b.settings || {}), shopify_attributes: '' };
  });
  const html = await engine.parseAndRender(read(`sections/${type}.liquid`), { ...scope, section }, { globals: globalsOf(scope) });
  const tag = schema.tag || 'div';
  return `<${tag} id="shopify-section-${id}" class="shopify-section ${schema.class || ''}">${html}</${tag}>`;
}

async function renderTemplate(name, scope) {
  const tpl = JSON.parse(read(`templates/${name}.json`));
  let out = '';
  for (const id of tpl.order) out += await renderSection(tpl.sections[id].type, `template--${id}`, tpl.sections[id], scope);
  const layout = tpl.layout || 'theme';
  return engine.parseAndRender(read(`layout/${layout}.liquid`), { ...scope, content_for_layout: out }, { globals: globalsOf(scope) });
}

const themeSettings = (() => {
  const defs = JSON.parse(read('config/settings_schema.json')).flatMap((g) => g.settings || []);
  const cur = JSON.parse(read('config/settings_data.json')).current;
  return settingsFrom(defs, cur);
})();

// objetos que Shopify expone a todos los snippets (render no hereda variables locales)
const GLOBAL_KEYS = ['shop', 'settings', 'cart', 'linklists', 'collections', 'routes', 'request', 'product', 'collection', 'page', 'template', 'canonical_url', 'search'];
const globalsOf = (sc) => Object.fromEntries(GLOBAL_KEYS.filter((k) => k in sc).map((k) => [k, sc[k]]));

function baseScope(req, extra = {}) {
  return {
    shop: { name: 'AGUANTA', url: `http://localhost:${PORT}`, description: themeSettings.meta_fallback, customer_accounts_enabled: false, enabled_payment_types: [] },
    settings: themeSettings, cart: cartObj(), linklists, collections,
    routes: { root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change', search_url: '/search', account_url: '/account', all_products_collection_url: '/collections/all' },
    request: { locale: { iso_code: 'es' }, origin: `http://localhost:${PORT}`, page_type: 'index' },
    content_for_header: '<!-- content_for_header -->', canonical_url: `http://localhost:${PORT}${req.url}`,
    page_title: 'AGUANTA', page_description: '', current_page: 1,
    template: { name: 'index', suffix: null },
    ...extra,
  };
}

// ───────────────────────── servidor
const mime = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function serveFile(res, file) {
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}
async function body(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if ((req.headers['content-type'] || '').includes('json')) return JSON.parse(raw || '{}');
  if ((req.headers['content-type'] || '').includes('multipart')) {
    const o = {}; for (const m of raw.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)) o[m[1]] = m[2]; return o;
  }
  return Object.fromEntries(new URLSearchParams(raw));
}
async function sectionsPayload(req, list) {
  const out = {};
  for (const s of String(list || '').split(',').filter(Boolean)) out[s] = await renderSection(s, s, {}, baseScope(req));
  return out;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = decodeURIComponent(url.pathname);
    if (p.startsWith('/assets/')) return serveFile(res, path.join(THEME, 'assets', path.basename(p)));
    if (p.startsWith('/preview/img/')) return serveFile(res, path.join(ROOT, 'preview/img', path.basename(p)));
    const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };

    if (p === '/cart.js') return json({ item_count: cartObj().item_count, total_price: cartObj().total_price });
    if (p === '/cart/add.js' || p === '/cart/add') {
      const b = await body(req);
      const id = +b.id;
      const product = products.find((x) => x.variants.some((v) => v.id === id));
      if (!product) return json({ status: 422, description: 'Variante no encontrada' });
      const variant = product.variants.find((v) => v.id === id);
      const ex = cartItems.find((c) => c.variant.id === id);
      if (ex) ex.quantity += +(b.quantity || 1); else cartItems.push({ key: `${id}:x`, variant, product, quantity: +(b.quantity || 1) });
      if (p === '/cart/add') { res.writeHead(302, { Location: '/cart' }); return res.end(); }
      return json({ id, sections: await sectionsPayload(req, b.sections) });
    }
    if (p === '/cart/change.js') {
      const b = await body(req);
      const it = cartItems.find((c) => c.key === b.id);
      if (it) it.quantity = +b.quantity;
      cartItems = cartItems.filter((c) => c.quantity > 0);
      { const c = cartObj(); return json({ item_count: c.item_count, total_price: c.total_price, sections: await sectionsPayload(req, (b.sections || []).join(',')) }); }
    }

    let html;
    if (p === '/') {
      html = await renderTemplate('index', baseScope(req, { page_description: themeSettings.meta_fallback }));
    } else if (p.startsWith('/products/')) {
      const product = products.find((x) => x.handle === p.split('/')[2]);
      if (!product) throw Object.assign(new Error('404'), { code: 404 });
      html = await renderTemplate('product', baseScope(req, { product, page_title: product.title, page_description: DESCRIPCIONES[FICHAS.find((f) => f.handle === product.handle).base].slice(0, 155), page_image: product.featured_media, template: { name: 'product' }, request: { locale: { iso_code: 'es' }, origin: `http://localhost:${PORT}`, page_type: 'product' } }));
    } else if (p.startsWith('/collections/')) {
      const collection = collections[p.split('/')[2]];
      if (!collection) throw Object.assign(new Error('404'), { code: 404 });
      const name = collection.template_suffix ? `collection.${collection.template_suffix}` : 'collection';
      html = await renderTemplate(name, baseScope(req, { collection, page_title: collection.title, template: { name: 'collection', suffix: collection.template_suffix } }));
    } else if (p.startsWith('/pages/')) {
      const h = p.split('/')[2]; const pg = pages[h];
      if (!pg) throw Object.assign(new Error('404'), { code: 404 });
      html = await renderTemplate(`page.${pg.suffix}`, baseScope(req, { page: { title: pg.title, content: pageCopy(h), handle: h }, page_title: pg.title, template: { name: 'page', suffix: pg.suffix } }));
    } else if (p === '/cart') {
      html = await renderTemplate('cart', baseScope(req, { page_title: 'Carrito', template: { name: 'cart' } }));
    } else if (p === '/search') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const results = q ? products.filter((x) => x.title.toLowerCase().includes(q)).map((x) => ({ ...x, object_type: 'product' })) : [];
      html = await renderTemplate('search', baseScope(req, { search: { performed: !!q, terms: q, results, results_count: results.length }, template: { name: 'search' } }));
    } else {
      throw Object.assign(new Error('404'), { code: 404 });
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (e) {
    if (e.code === 404) {
      const html = await renderTemplate('404', baseScope(req, { template: { name: '404' } }));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html);
    }
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(String(e.stack || e));
  }
}).listen(PORT, () => console.log(`AGUANTA · vista previa en http://localhost:${PORT}  (envío gratis desde ${AJUSTES.envioGratisDesde} €)`));
