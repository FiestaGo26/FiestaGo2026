'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export type HomeProvider = {
  id: string
  name: string
  slug: string | null
  category: string
  categoryLabel: string
  city: string
  photo: string
  price: string | null
  verified: boolean
}

const providerHref = (p: HomeProvider) => `/proveedores/${p.slug || p.id}`

/* Entrada escalonada de cada sección. Sin JS todo queda visible:
   la clase fg-motion solo se añade una vez montado. */
export function Motion() {
  useEffect(() => {
    const root = document.querySelector('.fg')
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    root.classList.add('fg-motion')
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
      })
    }, { rootMargin: '0px 0px -8% 0px' })
    root.querySelectorAll('[data-reveal]').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  return null
}

/* Foto principal del hero: fundido lento entre proveedores reales. */
export function HeroPhotos({ providers }: { providers: HomeProvider[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (providers.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => { if (!document.hidden) setI(n => (n + 1) % providers.length) }, 5600)
    return () => clearInterval(t)
  }, [providers.length])
  const cur = providers[i]
  if (!cur) return <div className="fg-photos" />
  return (
    <div className="fg-photos">
      {providers.map((p, n) => (
        <img key={p.id} src={p.photo} alt={`${p.name}, ${p.categoryLabel.toLowerCase()} en ${p.city}`}
          className={n === i ? 'is-on' : ''} loading={n === 0 ? 'eager' : 'lazy'} />
      ))}
      <Link href={providerHref(cur)} className="fg-photos__caption" aria-live="polite">
        <strong>{cur.name}</strong>
        <span>{cur.categoryLabel} · {cur.city}{cur.price ? ` · desde ${cur.price}` : ''}</span>
      </Link>
    </div>
  )
}

/* Muro de proveedores con filtro por categoría (lo "vivo" de la página). */
export function ProviderWall({ providers, total }: { providers: HomeProvider[]; total: number }) {
  const cats = Array.from(
    providers.reduce((m, p) => m.set(p.category, { label: p.categoryLabel, n: (m.get(p.category)?.n || 0) + 1 }),
      new Map<string, { label: string; n: number }>())
  ).sort((a, b) => b[1].n - a[1].n)
  const [cat, setCat] = useState('')
  const shown = (cat ? providers.filter(p => p.category === cat) : providers).slice(0, 13)

  return (
    <>
      <div className="fg-filters" role="group" aria-label="Filtrar por categoría">
        <button type="button" className="fg-filter" aria-pressed={cat === ''} onClick={() => setCat('')}>
          Todos<span className="num">{providers.length}</span>
        </button>
        {cats.map(([id, c]) => (
          <button key={id} type="button" className="fg-filter" aria-pressed={cat === id} onClick={() => setCat(id)}>
            {c.label}<span className="num">{c.n}</span>
          </button>
        ))}
      </div>
      <div className="fg-grid">
        {shown.map((p, n) => (
          <Link key={p.id} href={providerHref(p)} className={`fg-prov${n === 0 ? ' fg-prov--lead' : ''}`}>
            <div className="fg-prov__img">
              <img src={p.photo} alt={`${p.name}, ${p.categoryLabel.toLowerCase()} en ${p.city}`} loading={n < 4 ? 'eager' : 'lazy'} />
            </div>
            <div className="fg-prov__meta">
              <span className="fg-prov__name">{p.name}</span>
              <span className="fg-prov__sub">{p.categoryLabel} · {p.city}{p.verified ? ' · verificado' : ''}</span>
              <span className="fg-prov__price">{p.price ? <>desde <b className="num">{p.price}</b></> : 'Precio a consultar'}</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="fg-wall__more">
        <Link href={cat ? `/proveedores?categoria=${cat}` : '/proveedores'} className="fg-btn fg-btn--ink">
          Ver los {cat ? cats.find(c => c[0] === cat)?.[1].n : total} proveedores
        </Link>
        <Link href="/servicios" className="fg-link">Buscar por servicio y fecha</Link>
      </div>
    </>
  )
}

const GUARANTEE = [
  { id: 'cancela', tab: '110 %', title: 'Si cancela, el 110 %',
    desc: 'Si tu proveedor cancela y no encontramos sustituto en 48 horas, te devolvemos el 110 % de lo que pagaste.' },
  { id: 'falta', tab: '100 % + 3.000 €', title: 'Si no viene, aún más',
    desc: 'Si el día del evento tu proveedor no se presenta, recuperas el 100 % y una compensación de hasta 3.000 €.' },
  { id: 'retenido', tab: 'Pago retenido', title: 'Tu dinero espera',
    desc: 'El pago queda en FiestaGo, no en el proveedor, hasta que termina tu celebración. Así podemos actuar si algo falla.' },
]

export function GuaranteeTabs() {
  const [g, setG] = useState(GUARANTEE[0])
  return (
    <>
      <div className="fg-tabs" role="tablist" aria-label="Garantía de Éxito" data-reveal>
        {GUARANTEE.map(x => (
          <button key={x.id} type="button" role="tab" id={`tab-${x.id}`} aria-controls="garantia-panel"
            aria-selected={g.id === x.id} className="fg-tab" onClick={() => setG(x)}>
            {x.tab}
          </button>
        ))}
      </div>
      <div id="garantia-panel" role="tabpanel" aria-labelledby={`tab-${g.id}`} data-reveal style={{ ['--i' as any]: 1 }}>
        <h2>{g.title}</h2>
        <p className="fg-guarantee__desc">{g.desc}</p>
        <p className="fg-guarantee__note">Aplica a reservas realizadas y pagadas íntegramente dentro de FiestaGo.</p>
      </div>
    </>
  )
}

/* Fila de momentos con arrastre, flechas y barra de progreso. */
export function MomentsRow({ items }: { items: { title: string; body: string; photo: string; alt: string }[] }) {
  const row = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(20)
  useEffect(() => {
    const el = row.current
    if (!el) return
    const on = () => {
      const max = el.scrollWidth - el.clientWidth
      const vis = el.clientWidth / el.scrollWidth
      setPct(Math.min(100, (vis + (max > 0 ? (el.scrollLeft / max) * (1 - vis) : 1 - vis)) * 100))
    }
    on()
    el.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { el.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  const move = (d: number) => row.current?.scrollBy({ left: d * 332, behavior: 'smooth' })
  const gaps = [96, 140, 80, 120, 104, 136]

  return (
    <section className="fg-moments" aria-labelledby="como-h">
      <div className="fg-moments__top">
        <h2 id="como-h" data-reveal>Así se reserva</h2>
        <div className="fg-arrows">
          <button type="button" className="fg-arrow" aria-label="Anterior" onClick={() => move(-1)}>
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><path d="M8 1 2 7l6 6M2 7h16" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
          </button>
          <button type="button" className="fg-arrow" aria-label="Siguiente" onClick={() => move(1)}>
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><path d="m10 1 6 6-6 6M16 7H0" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
          </button>
        </div>
      </div>
      <div className="fg-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <div className="fg-row" ref={row} tabIndex={0} aria-label="Pasos para reservar">
        {items.map((m, n) => (
          <article key={m.title} className="fg-moment" data-reveal style={{ ['--i' as any]: n }}>
            <h3>{m.title}</h3>
            <p>{m.body}</p>
            <div style={{ ['--g' as any]: `${gaps[n % gaps.length]}px` }} className="fg-moment__gap" />
            <img src={m.photo} alt={m.alt} loading="lazy" />
          </article>
        ))}
      </div>
    </section>
  )
}
