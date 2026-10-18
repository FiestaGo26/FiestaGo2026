import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase'
import { getPhoto, CATEGORIES, CITIES } from '@/lib/constants'
import { precioCliente, formatEuro } from '@/lib/pricing'
import { Motion, HeroPhotos, ProviderWall, GuaranteeTabs, MomentsRow, type HomeProvider } from './_components/home/HomeClient'
import './home.css'

export const revalidate = 300

const LABEL_OVERRIDES: Record<string, string> = { planner: 'Organización de eventos' }
const catLabel = (id: string) => LABEL_OVERRIDES[id] || (CATEGORIES.find((c: any) => c.id === id)?.label || 'Celebraciones').split(' & ')[0]

async function getProviders(): Promise<HomeProvider[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('providers')
    .select('id, name, slug, category, city, price_base, photo_url, verified, featured, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  return (data || [])
    .map((p: any) => ({
      id: p.id,
      name: String(p.name || '').trim(),
      slug: p.slug,
      category: p.category,
      categoryLabel: catLabel(p.category),
      city: String(p.city || '').trim(),
      photo: p.photo_url || getPhoto(p.category || 'party', 0, 800, 1000),
      price: p.price_base ? formatEuro(precioCliente(Number(p.price_base)), { showCents: 'never' }) : null,
      verified: !!p.verified,
      _rank: (p.featured ? 4 : 0) + (p.photo_url ? 2 : 0) + (p.verified ? 1 : 0) + (p.price_base ? 1 : 0),
    }))
    .sort((a: any, b: any) => b._rank - a._rank)
    .map(({ _rank, ...p }: any) => p)
}

async function getPacks() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('packs').select('id, name, slug, price_base, duration, max_guests')
    .eq('status', 'active').order('sort_order')
  return data || []
}

// Guirnalda de banderines sobre la tarjeta: el cordel es una curva
// cuadrática y cada banderín cuelga del punto de la curva que le toca.
const FLAGS = 15
function Bunting() {
  return (
    <div className="fg-bunting" aria-hidden="true">
      <svg viewBox="0 0 100 76" preserveAspectRatio="none">
        <path d="M0 4 Q50 76 100 4" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: FLAGS }, (_, n) => {
        const t = (n + 1) / (FLAGS + 1)
        const y = (4 + 144 * t * (1 - t)) / 108 * 100
        return (
          <span key={n} style={{ left: `${t * 100}%`, top: `${y}%`, ['--n' as any]: n }}>
            <i />
          </span>
        )
      })}
    </div>
  )
}

function packGroup(name: string) {
  if (/boda|comuni/i.test(name)) return 'Bodas y comuniones'
  if (/cumple|casa|fiesta/i.test(name)) return 'Cumpleaños y fiestas'
  return 'Empresa'
}

export default async function HomePage() {
  const [providers, packs] = await Promise.all([getProviders(), getPacks()])
  const withPhoto = providers.filter(p => !p.photo.includes('picsum.photos'))
  const heroSet = withPhoto.slice(0, 4)
  const cities = Array.from(providers.reduce((m, p) => m.set(p.city, (m.get(p.city) || 0) + 1), new Map<string, number>()))
    .sort((a, b) => b[1] - a[1]).map(([c]) => c).filter(Boolean)
  const catsLive = Array.from(new Set(providers.map(p => p.category)))
  const total = providers.length

  const groups = packs.reduce((m: Record<string, any[]>, pk: any) => {
    (m[packGroup(pk.name)] ||= []).push(pk); return m
  }, {})
  const groupOrder = ['Cumpleaños y fiestas', 'Bodas y comuniones', 'Empresa'].filter(g => groups[g])

  const pick = (n: number) => withPhoto[n % Math.max(withPhoto.length, 1)]
  const moments = [
    { title: 'Primero, qué celebras', body: 'Boda, cumpleaños, comunión o cena de empresa. Con fecha y ciudad te enseñamos quién está libre.' },
    { title: 'Luego, precios a la vista', body: 'Cada servicio tiene su precio cerrado. Nada de pedir diez presupuestos y esperar dos semanas.' },
    { title: 'Después, tu lista corta', body: 'Guarda favoritos y compártelos con tu pareja o tu familia antes de decidir.' },
    { title: 'Reservas en dos minutos', body: 'Eliges fecha, completas tus datos y pagas de forma segura, sin transferencias a desconocidos.' },
    { title: 'El dinero espera', body: 'Lo retenemos hasta que termina el evento. El proveedor cobra cuando ha cumplido.' },
    { title: 'Y tú, a celebrar', body: 'Si algo falla el día del evento, respondemos con nuestro dinero, no con un formulario.' },
  ].map((m, n) => {
    const p = pick(n + 4)
    return { ...m, photo: p ? p.photo : getPhoto('party', n, 600, 750), alt: p ? `${p.name}, ${p.categoryLabel.toLowerCase()} en ${p.city}` : 'Celebración' }
  })
  const plate = pick(2)
  const tipped = pick(7)

  return (
    <main className="fg">
      <Motion />

      {/* ─────────── La invitación ─────────── */}
      <section className="fg-hero" aria-labelledby="hero-h">
        <div className="fg-card">
          <Bunting />
          <div className="fg-card__body">
            <span className="fg-wordmark">FiestaGo</span>
            <h1 id="hero-h">Tu celebración, sin sustos.</h1>
            <p className="fg-card__lede">
              Fotografía, catering, música y animación con precio cerrado. Si tu proveedor falla, te devolvemos el 110 %.
            </p>
            <form action="/buscar" method="get" className="fg-search">
              <input type="hidden" name="tipo" value="servicios" />
              <label>
                <span className="small">Qué necesitas</span>
                <select name="categoria" defaultValue="">
                  <option value="">Cualquier servicio</option>
                  {CATEGORIES.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label>
                <span className="small">Dónde</span>
                <select name="ciudad" defaultValue="">
                  <option value="">Toda España</option>
                  {CITIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <button type="submit" className="fg-btn">Buscar proveedores</button>
            </form>
          </div>
          <nav className="fg-card__links" aria-label="Accesos rápidos">
            <Link href="/garantia" className="fg-link">Garantía de Éxito</Link>
            <Link href="/quiz" className="fg-link">Quiz de 2 minutos</Link>
            <Link href="/profesionales" className="fg-link">Soy profesional</Link>
          </nav>
        </div>
        <HeroPhotos providers={heroSet} />
      </section>

      {/* ─────────── Proveedores ─────────── */}
      <section id="proveedores" className="fg-wall" aria-labelledby="prov-h">
        <div className="fg-wall__top">
          <h2 id="prov-h" data-reveal>Ya están aquí.</h2>
          <p data-reveal style={{ ['--i' as any]: 1 }}>
            {total} profesionales en {cities.length} ciudades, con su precio a la vista y la Garantía de Éxito incluida. Elige una categoría y mira quién hay.
          </p>
        </div>
        <ProviderWall providers={providers} total={total} />
      </section>

      {/* ─────────── Garantía ─────────── */}
      <section className="fg-guarantee" aria-label="Garantía de Éxito">
        <div className="fg-guarantee__plate" data-reveal>
          {plate && <img src={plate.photo} alt={`${plate.name}, ${plate.categoryLabel.toLowerCase()} en ${plate.city}`} loading="lazy" />}
        </div>
        <div className="fg-guarantee__text">
          <GuaranteeTabs />
          <div className="fg-cells" data-reveal style={{ ['--i' as any]: 2 }}>
            <Link href="/garantia" className="fg-cell fg-cell--ink">Leer la garantía <span aria-hidden="true">→</span></Link>
            <Link href="/quiz" className="fg-cell">Hacer el quiz <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      {/* ─────────── La carta de packs ─────────── */}
      {packs.length > 0 && (
        <section id="packs" className="fg-menu" aria-labelledby="packs-h">
          <img className="fg-menu__bg" src="https://picsum.photos/id/122/2000/1400" alt="" aria-hidden="true" loading="lazy" />
          <div className="fg-sheet" data-reveal>
            <h2 id="packs-h">Packs con todo dentro</h2>
            <p className="fg-sheet__note">Un precio, un pago y una sola persona que lo coordina.</p>
            {groupOrder.map(g => (
              <div key={g} className="fg-sheet__group">
                <h3>{g}</h3>
                <ul>
                  {groups[g].map((pk: any) => (
                    <li key={pk.id}>
                      <Link href={`/packs/${pk.slug || pk.id}`}>
                        <span className="fg-sheet__item">{pk.name.replace(/^Pack\s+/i, '')}</span>
                        <span className="fg-sheet__price num">{formatEuro(precioCliente(Number(pk.price_base)), { showCents: 'never' })}</span>
                        <span className="fg-sheet__desc">{pk.duration} · hasta {pk.max_guests} personas</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="fg-sheet__foot">Garantía de Éxito incluida en cada precio.<br />Reserva en menos de dos minutos.</p>
          </div>
          <span className="fg-credit">Foto: Vadim Sherbakov · Unsplash</span>
        </section>
      )}

      {/* ─────────── Cómo se reserva ─────────── */}
      <MomentsRow items={moments} />

      {/* ─────────── Dónde estamos ─────────── */}
      <section className="fg-guests" aria-labelledby="ciudades-h">
        <div className="fg-guests__card" data-reveal>
          <h2 id="ciudades-h">Ya celebramos en</h2>
          {tipped && <img src={tipped.photo} alt={`${tipped.name}, ${tipped.categoryLabel.toLowerCase()} en ${tipped.city}`} loading="lazy" />}
          <p className="fg-guests__names">
            {cities.map((c, n) => (
              <span key={c}>
                <Link href={`/servicios?ciudad=${encodeURIComponent(c)}`}>{c}</Link>
                {n < cities.length - 1 && <>&nbsp;·&nbsp; </>}
              </span>
            ))}
          </p>
          <p className="fg-guests__names">
            {catsLive.map((c, n) => (
              <span key={c}>
                <Link href={`/proveedores?categoria=${c}`}>{catLabel(c)}</Link>
                {n < catsLive.length - 1 && <>&nbsp;·&nbsp; </>}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ─────────── Profesionales ─────────── */}
      <section className="fg-reply" aria-labelledby="pro-h">
        <p className="fg-reply__lede" data-reveal>
          Cobras el 100 % de tu precio: la comisión la paga el cliente. Sin permanencia y sin cuotas mensuales.
        </p>
        <div className="fg-reply__card" data-reveal style={{ ['--i' as any]: 1 }}>
          <h2 id="pro-h">¿Eres profesional?</h2>
          <p>Únete a los {total} proveedores que ya reciben reservas con precio cerrado en FiestaGo.</p>
          <Link href="/registro-proveedor" className="fg-btn fg-btn--ink">Inscribirme gratis</Link>
          <Link href="/profesionales" className="fg-link">Cómo funciona para profesionales</Link>
        </div>
      </section>
    </main>
  )
}
