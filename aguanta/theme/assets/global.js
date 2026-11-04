/* AGUANTA — JS ligero, sin dependencias. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const A = window.AGUANTA || { routes: { cart_add_url: '/cart/add', cart_change_url: '/cart/change', root: '/' }, strings: {} };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = (A.routes.root || '/').replace(/\/?$/, '/');

  /* ── revelado y hero ─────────────────────────────── */
  const hero = $('[data-hero]');
  if (hero) requestAnimationFrame(() => hero.classList.add('is-in'));
  const revealEls = $$('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el); });
  }

  /* ── contador del drop (anima hasta el dato real) ─ */
  $$('[data-countup]').forEach((el) => {
    const end = parseInt(el.dataset.countup, 10);
    if (!end || reduced) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1200;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('es-ES');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
  });

  /* ── foco atrapado en diálogos ─────────────────────── */
  let lastFocus = null;
  const focusables = (el) => $$('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])', el).filter((x) => x.offsetParent !== null);
  function trap(el, e) {
    if (e.key !== 'Tab') return;
    const f = focusables(el);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ── menú móvil ───────────────────────────────────── */
  const menu = $('[data-menu]');
  const burger = $('[data-menu-open]');
  function openMenu() {
    if (!menu) return;
    lastFocus = document.activeElement;
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    burger && burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { const f = focusables(menu)[0]; f && f.focus(); }, 50);
  }
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove('is-open');
    burger && burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    setTimeout(() => { menu.hidden = true; }, reduced ? 0 : 400);
    lastFocus && lastFocus.focus();
  }
  burger && burger.addEventListener('click', openMenu);
  $$('[data-menu-close]').forEach((b) => b.addEventListener('click', closeMenu));
  menu && menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); trap(menu, e); });

  /* ── carrito lateral ──────────────────────────────── */
  let drawer = $('[data-drawer]');
  function bindDrawer() {
    drawer = $('[data-drawer]');
    if (!drawer) return;
    $$('[data-drawer-close]', drawer).forEach((b) => b.addEventListener('click', closeCart));
    drawer.addEventListener('keydown', (e) => trap(drawer, e));
    $$('[data-qty-btn]', drawer).forEach((b) => b.addEventListener('click', () => {
      const input = $(`[data-qty][data-key="${b.dataset.key}"]`, drawer);
      change(b.dataset.key, Math.max(0, parseInt(input.value, 10) + parseInt(b.dataset.qtyBtn, 10)));
    }));
    $$('[data-qty]', drawer).forEach((i) => i.addEventListener('change', () => change(i.dataset.key, Math.max(0, parseInt(i.value, 10) || 0))));
    $$('[data-remove]', drawer).forEach((b) => b.addEventListener('click', () => change(b.dataset.key, 0)));
  }
  function openCart() {
    if (!drawer) return false;
    lastFocus = document.activeElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('.drawer__panel', drawer).focus(), 30);
    return true;
  }
  function closeCart() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lastFocus && lastFocus.focus();
  }
  function renderSections(sections) {
    if (!sections) return;
    if (sections['cart-drawer']) {
      const tmp = document.createElement('div');
      tmp.innerHTML = sections['cart-drawer'];
      const fresh = $('[data-drawer]', tmp);
      const wasOpen = drawer && drawer.classList.contains('is-open');
      if (fresh && drawer) {
        drawer.replaceWith(fresh);
        bindDrawer();
        if (wasOpen) { drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); $('.drawer__panel', drawer).focus(); }
      }
    }
  }
  async function refreshCount() {
    try {
      const c = await (await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } })).json();
      $$('[data-cart-count]').forEach((el) => { el.textContent = c.item_count || ''; el.dataset.count = c.item_count; });
    } catch (_) { /* sin red: no pasa nada */ }
  }
  async function change(key, quantity) {
    const res = await fetch(`${A.routes.cart_change_url}.js`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity, sections: ['cart-drawer'], sections_url: window.location.pathname }),
    });
    const data = await res.json();
    renderSections(data.sections);
    refreshCount();
    if ($('[data-cart-page]')) window.location.reload();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) closeCart(); });
  bindDrawer();
  $$('[data-cart-open]').forEach((a) => a.addEventListener('click', (e) => { if (openCart()) e.preventDefault(); }));

  /* ── ficha de producto ────────────────────────────── */
  $$('[data-product]').forEach((pdp) => {
    const variantsEl = $('[data-variants]', pdp);
    const variants = variantsEl ? JSON.parse(variantsEl.textContent) : [];
    const form = $('form[data-type="add-to-cart-form"]', pdp);
    const idInput = form && $('[data-variant-id]', form);
    const addBtn = form && $('[data-add]', form);
    const addLabel = form && $('[data-add-label]', form);
    const errBox = form && $('[data-form-error]', form);
    const money = (cents) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || 'EUR' });

    // marca combinaciones agotadas para la talla
    function markAvailability(selected) {
      $$('input[data-opt]', pdp).forEach((inp) => {
        const idx = +inp.dataset.opt;
        const test = selected.slice(); test[idx] = inp.value;
        const v = variants.find((x) => x.options.every((o, i) => o === test[i]));
        inp.classList.toggle('is-out', !v || !v.available);
      });
    }
    function current() {
      const n = (variants[0] && variants[0].options.length) || 0;
      return Array.from({ length: n }, (_, i) => { const c = $(`input[data-opt="${i}"]:checked`, pdp); return c ? c.value : variants[0].options[i]; });
    }
    function update() {
      const sel = current();
      sel.forEach((v, i) => { const l = $(`[data-opt-label="${i}"]`, pdp); if (l) l.textContent = v; });
      const v = variants.find((x) => x.options.every((o, i) => o === sel[i]));
      markAvailability(sel);
      if (!v) { addBtn.disabled = true; addLabel.textContent = A.strings.unavailable || 'No disponible'; return; }
      idInput.value = v.id;
      addBtn.disabled = !v.available;
      addLabel.textContent = v.available ? (A.strings.add || 'Añadir') : (A.strings.soldOut || 'Agotado');
      $$('[data-price-now]', pdp).forEach((el) => { el.textContent = money(v.price); });
      const was = $('[data-price-was]', pdp);
      if (was) { was.textContent = v.compare_at_price > v.price ? money(v.compare_at_price) : ''; }
      const url = new URL(window.location.href);
      url.searchParams.set('variant', v.id);
      window.history.replaceState({}, '', url);
      if (v.featured_media) {
        const m = document.getElementById(`media-${v.featured_media.id}`);
        const gal = $('[data-gallery]', pdp);
        if (m && gal && gal.scrollWidth > gal.clientWidth) gal.scrollTo({ left: m.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
      }
    }
    $$('input[data-opt]', pdp).forEach((i) => i.addEventListener('change', update));
    if (variants.length) markAvailability(current());

    form && form.addEventListener('submit', async (e) => {
      if (!drawer) return; // sin carrito lateral: envío normal
      e.preventDefault();
      errBox.hidden = true;
      addBtn.setAttribute('aria-busy', 'true');
      const fd = new FormData(form);
      fd.append('sections', 'cart-drawer');
      fd.append('sections_url', window.location.pathname);
      try {
        const res = await fetch(`${A.routes.cart_add_url}.js`, { method: 'POST', body: fd, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
        const data = await res.json();
        if (data.status) { errBox.textContent = data.description || A.strings.error; errBox.hidden = false; return; }
        renderSections(data.sections);
        await refreshCount();
        openCart();
      } catch (_) {
        errBox.textContent = A.strings.error || 'Algo ha fallado.'; errBox.hidden = false;
      } finally { addBtn.removeAttribute('aria-busy'); }
    });

    // botón "Añadir" fijo en móvil
    if ($('[data-atc-bar]', pdp)) document.body.classList.add('has-sticky-atc');

    // guía de tallas desde el enlace del selector
    $$('[data-open-guide]', pdp).forEach((a) => a.addEventListener('click', (e) => {
      const d = $('[data-guide]', pdp);
      if (!d) return;
      e.preventDefault(); d.open = true; d.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); $('summary', d).focus();
    }));

    // puntos de la galería en móvil
    const gal = $('[data-gallery]', pdp), dots = $$('[data-dots] span', pdp);
    if (gal && dots.length) {
      gal.addEventListener('scroll', () => {
        const i = Math.round(gal.scrollLeft / gal.clientWidth);
        dots.forEach((d, k) => d.classList.toggle('on', k === i));
      }, { passive: true });
    }
  });
})();
