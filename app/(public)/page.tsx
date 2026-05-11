import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase'
import { getPhoto, CATEGORIES } from '@/lib/constants'
import SearchBar from './_components/SearchBar'

async function getPacks() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('packs').select('*').eq('status','active').order('sort_order').limit(4)
  return data || []
}

async function getFeaturedServices() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('provider_services')
    .select('id, name, price, price_unit, media_url, media_type, providers!inner(id, name, slug, city, category, rating)')
    .eq('status', 'active')
    .eq('providers.status', 'approved')
    .not('price', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8)
  return (data || []).map((s: any) => ({ ...s, provider: s.providers }))
}

const REVIEWS = [
  { name:'Laura & Carlos', city:'Madrid',    stars:5, text:'Reservé el Pack Cumple Premium para mi hija y fue perfecto. Todo coordinado, sin estrés.', event:'Cumpleaños 6 años' },
  { name:'Carlos & Ana',   city:'Barcelona', stars:5, text:'FiestaGo organizó nuestra boda íntima en tiempo récord. Increíble equipo.',                      event:'Boda íntima' },
  { name:'Marcos R.',      city:'Sevilla',   stars:5, text:'El Pack Fiesta en Casa superó todas mis expectativas. Llegaron, montaron y yo disfruté.',         event:'Cumpleaños adulto' },
]

const COLLECTIONS = [
  { id:'bodas',      title:'Tu boda perfecta',         hint:'Espacios, catering y todo lo que necesitas para el gran día.', cat:'planner',   seed:'wedding' },
  { id:'cumple',     title:'Cumpleaños inolvidables',  hint:'Animación, tartas, decoración… que cada año sea el mejor.',     cat:'animacion', seed:'kids' },
  { id:'privado',    title:'Eventos privados',         hint:'Fiestas íntimas, despedidas, comuniones y celebraciones únicas.',cat:'catering',  seed:'party' },
]

const CITIES_FEAT = [
  { name:'Madrid',    seed:'madrid' },
  { name:'Barcelona', seed:'barcelona' },
  { name:'Valencia',  seed:'valencia' },
  { name:'Sevilla',   seed:'sevilla' },
]

export default async function HomePage() {
  const [packs, featured] = await Promise.all([getPacks(), getFeaturedServices()])

  return (
    <main>

      {/* ─────────── HERO ─────────── */}
      <section className="relative h-[78vh] min-h-[560px] flex items-end overflow-hidden">
        <Image src={getPhoto('party', 0, 1920, 1200)} alt="Celebración FiestaGo"
          fill priority className="object-cover"/>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/55" />

        <div className="relative max-w-6xl mx-auto px-6 pb-24 md:pb-32 w-full text-white">
          <div className="max-w-2xl">
            <p className="text-xs md:text-sm font-medium tracking-[0.25em] uppercase mb-4 opacity-90">
              El marketplace de celebraciones
            </p>
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-5">
              Tu fiesta perfecta,{' '}
              <span className="italic font-light">sin complicarte.</span>
            </h1>
            <p className="text-base md:text-lg text-white/85 max-w-lg leading-relaxed">
              Reserva proveedores y servicios verificados con precio cerrado en toda España.
            </p>
          </div>
        </div>

        {/* Search bar flotante */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[-32px] md:bottom-[-36px] w-[92%] max-w-4xl z-20">
          <div className="bg-white rounded-2xl shadow-2xl p-2 md:p-3">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* ─────────── CATEGORÍAS STRIP (Airbnb style) ─────────── */}
      <section className="mt-20 border-b border-stone-200/70">
        <div className="max-w-6xl mx-auto px-2 md:px-6 py-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-7 md:gap-10 px-3 min-w-fit">
            {CATEGORIES.map((c: any) => (
              <Link key={c.id} href={`/servicios?categoria=${c.id}`}
                className="group flex flex-col items-center gap-2 text-ink/55 hover:text-ink pb-3 border-b-2 border-transparent hover:border-ink whitespace-nowrap transition-colors">
                <span className="text-2xl">{c.icon}</span>
                <span className="text-[11px] font-medium tracking-wide">{c.label.split(' & ')[0]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── INSPIRACIÓN (3 collections) ─────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-20">
        <div className="mb-10">
          <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
            Inspiración <span className="italic font-light">para tu próxima fiesta</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-7">
          {COLLECTIONS.map(c => (
            <Link key={c.id} href={`/servicios?categoria=${c.cat}`}
              className="group block">
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-stone-100">
                <Image src={getPhoto(c.seed, 0, 600, 750)} alt={c.title} fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <h3 className="font-serif text-2xl md:text-3xl leading-tight mb-2">{c.title}</h3>
                  <p className="text-sm text-white/85 leading-snug">{c.hint}</p>
                  <span className="text-xs font-semibold tracking-widest uppercase mt-3 inline-block border-b border-white pb-0.5">
                    Explorar →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─────────── SERVICIOS DESTACADOS ─────────── */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pt-20">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-10">
            <div>
              <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
                Servicios <span className="italic font-light">destacados</span>
              </h2>
              <p className="text-ink/55 text-sm mt-2">Precio cerrado · reserva directa · sin negociar.</p>
            </div>
            <Link href="/servicios" className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-coral transition-colors">
              Ver todos los servicios →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
            {featured.map((s: any) => {
              const cat = CATEGORIES.find((c: any) => c.id === s.provider?.category)
              const providerKey = s.provider?.slug || s.provider?.id
              return (
                <Link key={s.id}
                  href={providerKey ? `/proveedores/${providerKey}?svc=${s.id}` : '#'}
                  className="group block">
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-stone-100 mb-3">
                    {s.media_url && s.media_type === 'video' ? (
                      <video src={s.media_url} muted loop autoPlay playsInline
                        className="w-full h-full object-cover" />
                    ) : (
                      <img src={s.media_url || getPhoto(s.provider?.category || 'party', 0, 600, 600)}
                        alt={s.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                    )}
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <h3 className="font-medium text-ink text-[15px] truncate">{s.name}</h3>
                      {s.provider?.rating > 0 && (
                        <span className="text-xs text-ink/70 whitespace-nowrap">★ {Number(s.provider.rating).toFixed(1)}</span>
                      )}
                    </div>
                    <div className="text-sm text-ink/55 mb-1.5">{cat?.label || ''} · {s.provider?.city}</div>
                    <div className="text-sm text-ink">
                      <span className="font-semibold">{s.price.toLocaleString()}€</span>
                      <span className="text-ink/50"> {s.price_unit}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ─────────── PACKS ─────────── */}
      {packs.length > 0 && (
        <section id="packs" className="max-w-7xl mx-auto px-6 pt-20">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-10">
            <div>
              <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
                Packs <span className="italic font-light">listos para reservar</span>
              </h2>
              <p className="text-ink/55 text-sm mt-2">Todo incluido, todo coordinado, sin sorpresas.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
            {packs.map((pk: any) => (
              <Link key={pk.id} href={`/packs/${pk.slug || pk.id}`}
                className="group block">
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-stone-100 mb-3">
                  <Image src={getPhoto(pk.photo_seed || 'party', 0, 600, 750)} alt={pk.name} fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"/>
                  <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full bg-white/95 text-ink">
                      {pk.emoji} Pack
                    </span>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-ink text-[15px] truncate mb-1">{pk.name}</div>
                  <div className="text-sm text-ink/55 mb-1.5">{pk.duration} · hasta {pk.max_guests} personas</div>
                  <div className="text-sm">
                    <span className="text-ink/50">desde </span>
                    <span className="font-semibold text-ink">{pk.price_base}€</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─────────── CIUDADES ─────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-20">
        <div className="mb-10">
          <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
            Celebra en <span className="italic font-light">tu ciudad</span>
          </h2>
          <p className="text-ink/55 text-sm mt-2">Profesionales locales en toda España.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {CITIES_FEAT.map(c => (
            <Link key={c.name} href={`/servicios?ciudad=${c.name}`}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100">
              <Image src={getPhoto(c.seed, 0, 600, 450)} alt={c.name} fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <div className="font-serif text-2xl leading-tight">{c.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─────────── HOW IT WORKS ─────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-8">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight mb-2">
            Reservar es <span className="italic font-light">así de fácil</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-10 md:gap-14 max-w-5xl mx-auto">
          {[
            { n:'01', title:'Elige', desc:'Explora servicios y packs con precio cerrado. Sin presupuestos a ciegas.' },
            { n:'02', title:'Reserva', desc:'Selecciona fecha, completa tus datos y reserva en menos de 2 minutos.' },
            { n:'03', title:'Celebra', desc:'El proveedor te contacta y coordina los detalles. Tú solo disfruta.' },
          ].map(s => (
            <div key={s.n} className="text-center md:text-left">
              <div className="font-serif text-5xl md:text-6xl text-coral/30 leading-none mb-4">{s.n}</div>
              <h3 className="font-serif text-2xl text-ink mb-2">{s.title}</h3>
              <p className="text-sm text-ink/60 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── REVIEWS ─────────── */}
      <section className="bg-cream py-20 px-6 mt-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
              Fiestas que <span className="italic font-light">no se olvidan</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {REVIEWS.map((r, i) => (
              <div key={i} className="bg-white border border-stone-200/70 rounded-2xl p-7">
                <div className="text-coral mb-4 text-sm">{'★'.repeat(r.stars)}</div>
                <p className="text-ink/80 text-sm leading-relaxed mb-6">"{r.text}"</p>
                <div className="border-t border-stone-100 pt-4">
                  <div className="text-sm font-medium text-ink">{r.name}</div>
                  <div className="text-xs text-ink/45 mt-0.5">{r.city} · {r.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── CTA PROVEEDORES ─────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="relative rounded-3xl overflow-hidden bg-ink text-white p-10 md:p-16 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-coral mb-4">Profesionales</p>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight mb-3">
              ¿Eres profesional? <span className="italic font-light">Únete a FiestaGo.</span>
            </h2>
            <p className="text-white/70 text-sm leading-relaxed max-w-md">
              Llega a miles de clientes en toda España. 1ª transacción sin comisión, sin permanencia, sin cuotas mensuales.
            </p>
          </div>
          <Link href="/registro-proveedor"
            className="inline-flex items-center gap-2 bg-coral text-white font-semibold px-7 py-4 rounded-2xl hover:bg-coral-dark transition-colors whitespace-nowrap">
            Darme de alta gratis →
          </Link>
        </div>
      </section>
    </main>
  )
}
