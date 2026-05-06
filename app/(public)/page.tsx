import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'

const HERO_VIDEO_PRIMARY  = 'https://videos.pexels.com/video-files/3196238/3196238-hd_1920_1080_25fps.mp4'
const HERO_VIDEO_FALLBACK = 'https://videos.pexels.com/video-files/4754029/4754029-hd_1920_1080_25fps.mp4'
const HERO_POSTER         = 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1920&q=80&auto=format&fit=crop'

const PHOTO = {
  toast:    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1400&q=80&auto=format&fit=crop',
  cake:     'https://images.unsplash.com/photo-1530023367847-a683933f4172?w=1400&q=80&auto=format&fit=crop',
  table:    'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1400&q=80&auto=format&fit=crop',
  couple:   'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1400&q=80&auto=format&fit=crop',
  flowers:  'https://images.unsplash.com/photo-1465495976277-4387d4b0b4af?w=1400&q=80&auto=format&fit=crop',
  birthday: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=1400&q=80&auto=format&fit=crop',
  party:    'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=1400&q=80&auto=format&fit=crop',
  weddings: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1400&q=80&auto=format&fit=crop',
  cta:      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=1920&q=80&auto=format&fit=crop',
}

const CATEGORY_PHOTOS: Record<string, string> = {
  foto:       'https://images.unsplash.com/photo-1519741497674-611481863552?w=1000&q=80&auto=format&fit=crop',
  catering:   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1000&q=80&auto=format&fit=crop',
  espacios:   'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1000&q=80&auto=format&fit=crop',
  musica:     'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=1000&q=80&auto=format&fit=crop',
  flores:     'https://images.unsplash.com/photo-1465495976277-4387d4b0b4af?w=1000&q=80&auto=format&fit=crop',
  pastel:     'https://images.unsplash.com/photo-1530023367847-a683933f4172?w=1000&q=80&auto=format&fit=crop',
  belleza:    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1000&q=80&auto=format&fit=crop',
  animacion:  'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1000&q=80&auto=format&fit=crop',
  transporte: 'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=1000&q=80&auto=format&fit=crop',
  papeleria:  'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1000&q=80&auto=format&fit=crop',
  planner:    'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1000&q=80&auto=format&fit=crop',
  joyeria:    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1000&q=80&auto=format&fit=crop',
}

async function getPacks() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('packs').select('*').eq('status', 'active').order('sort_order')
  return data || []
}

async function getFeaturedProviders() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('providers').select('*').eq('status', 'approved').order('rating', { ascending: false }).limit(6)
  return data || []
}

const REVIEWS = [
  { name: 'Laura & Carlos', city: 'Madrid',   text: 'Reservamos el pack íntimo y todo coordinado al detalle. El equipo de FiestaGo nos quitó toda la presión.', event: 'Boda íntima · 40 invitados', photo: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80&auto=format&fit=crop' },
  { name: 'Marcos R.',      city: 'Sevilla',  text: 'Mi cumpleaños 40, el pack premium en una finca preciosa. Solo aparecí. Llegó todo, montaron, sirvieron, recogieron.', event: 'Cumpleaños 40', photo: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=600&q=80&auto=format&fit=crop' },
  { name: 'Sara T.',        city: 'Valencia', text: 'La despedida de mi hermana en una villa con catering, DJ y fotografía. Un pinchazo y FiestaGo lo solucionó esa misma tarde.', event: 'Despedida de soltera', photo: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=600&q=80&auto=format&fit=crop' },
]

const STEPS = [
  { n: '01', title: 'Elige tu fecha', text: 'Cuéntanos qué celebras, dónde y para cuántos. En 2 minutos.' },
  { n: '02', title: 'Personaliza',    text: 'Selecciona un pack curado o combina los proveedores que prefieras.' },
  { n: '03', title: 'Disfruta',       text: 'Lo coordinamos todo. Tú solo apareces y celebras.' },
]

export default async function HomePage() {
  const [packs, featured] = await Promise.all([getPacks(), getFeaturedProviders()])

  return (
    <main className="-mt-px">
      {/* ── HERO VIDEO ── */}
      <section className="relative h-screen min-h-[640px] overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_POSTER}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={HERO_VIDEO_PRIMARY}  type="video/mp4" />
          <source src={HERO_VIDEO_FALLBACK} type="video/mp4" />
        </video>
        <div className="absolute inset-0 hero-overlay" />

        <div className="relative h-full flex flex-col items-center justify-center px-6 text-center z-10">
          <p className="eyebrow-light fade-up" style={{ letterSpacing: '0.32em' }}>Tu fiesta empieza aquí</p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-white leading-[1.02] mt-6 mb-6 tracking-tight font-normal fade-up-2">
            Hazla{' '}
            <span className="italic" style={{ color: '#FFD166' }}>inolvidable</span>.
          </h1>
          <p className="text-base md:text-lg text-white/85 max-w-md mx-auto leading-relaxed mb-10 fade-up-3">
            Bodas, cumples, despedidas, aniversarios. Los mejores proveedores de tu ciudad, en una sola reserva.
          </p>

          <form action="/proveedores" method="GET" className="w-full max-w-lg fade-up-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-full p-1.5 pl-6 flex gap-3 items-center shadow-2xl">
              <span className="text-[10px] tracking-[0.18em] uppercase text-ink-muted font-medium hidden sm:block">Ciudad</span>
              <select
                name="ciudad"
                defaultValue=""
                className="flex-1 border-0 outline-none bg-transparent font-serif italic text-base text-ink py-3"
              >
                <option value="">¿Dónde celebras?</option>
                {['Valencia','Madrid','Barcelona','Sevilla','Bilbao','Málaga','Zaragoza','Murcia','Alicante','Granada'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-ink text-white text-[11px] tracking-[0.18em] uppercase font-medium px-6 py-3 rounded-full hover:bg-ink-soft transition-colors"
              >
                Empezar →
              </button>
            </div>
          </form>
        </div>

        <div className="absolute bottom-8 left-6 md:left-10 right-6 md:right-10 flex items-end justify-between text-white/85 z-10">
          <div className="flex gap-6 md:gap-10">
            {[['1.200+','Eventos'],['4,9/5','Reseñas'],['10','Ciudades']].map(([n,l])=>(
              <div key={l}>
                <div className="font-serif text-2xl md:text-3xl text-white">
                  {n.includes('+') || n.includes('/') ? <>{n.split(/[+/]/)[0]}<span className="text-gold-light">{n.match(/[+/].*/)?.[0]}</span></> : n}
                </div>
                <div className="text-[10px] tracking-[0.18em] uppercase mt-1">{l}</div>
              </div>
            ))}
          </div>
          <div className="hidden md:flex flex-col items-center gap-2 text-white/65">
            <div className="text-[10px] tracking-[0.18em] uppercase">Descubre packs</div>
            <div className="w-px h-8 bg-gradient-to-b from-white/60 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="py-24 md:py-32 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="eyebrow mb-4">Cómo funciona</p>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight">
              Tres pasos. <span className="serif-italic">Sin estrés.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12 md:gap-20">
            {STEPS.map(s => (
              <div key={s.n} className="relative">
                <div className="font-serif text-7xl text-gold/20 absolute -top-4 -left-2 select-none">{s.n}</div>
                <div className="relative pt-8">
                  <h3 className="font-serif text-2xl mb-3 font-normal">{s.title}</h3>
                  <p className="text-ink-soft leading-relaxed text-[15px]">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-rule max-w-7xl mx-auto" />

      {/* ── PACKS ── */}
      <section id="packs" className="py-24 md:py-32 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div>
              <p className="eyebrow mb-4">Selección curada</p>
              <h2 className="font-serif text-4xl md:text-5xl leading-tight">
                Packs <span className="serif-italic">listos</span> para reservar.
              </h2>
            </div>
            <Link
              href="/proveedores"
              className="text-[11px] tracking-[0.18em] uppercase font-medium pb-1 border-b border-ink hover:border-gold hover:text-gold transition-colors self-start md:self-end"
            >
              Ver catálogo completo →
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {(packs.length ? packs : Array.from({length:3}).map((_,i)=>({id:i,name:'',slug:'',emoji:'',description:'',highlight:'',price_base:0,duration:'',color:''}))).slice(0,6).map((p:any, i:number) => {
              const photo = [PHOTO.couple, PHOTO.birthday, PHOTO.cake, PHOTO.flowers, PHOTO.toast, PHOTO.weddings][i % 6]
              return (
                <Link key={p.id || i} href={`/packs/${p.slug || ''}`} className="group lift bg-white border border-bone-dark rounded-none overflow-hidden block">
                  <div className="zoom-parent aspect-[4/3] bg-bone">
                    <img src={photo} alt={p.name || 'Pack'} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6 md:p-7">
                    <div className="eyebrow mb-2" style={{fontSize:'10px'}}>{p.highlight || 'Pack'}</div>
                    <h3 className="font-serif italic text-xl mb-3 font-normal">{p.name || 'Celebración íntima'}</h3>
                    <p className="text-[13px] text-ink-soft leading-relaxed mb-5 line-clamp-2 min-h-[40px]">{p.description || 'Catering · Música · Floral · Fotografía. Todo coordinado.'}</p>
                    <div className="flex justify-between items-center pt-4 border-t border-bone-dark">
                      <div className="font-serif text-2xl">{(p.price_base || 1200).toLocaleString('es-ES')}<span className="text-gold">€</span></div>
                      <span className="text-[10px] tracking-[0.15em] uppercase font-medium group-hover:text-gold transition-colors">Reservar →</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CATEGORÍAS MOSAICO ── */}
      <section id="categorias" className="py-24 md:py-32 px-6 md:px-10 bg-bone">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-4">Categorías</p>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight">
              Todos los profesionales <span className="serif-italic">en un solo sitio.</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {CATEGORIES.slice(0,12).map(cat => (
              <Link
                key={cat.id}
                href={`/proveedores?categoria=${cat.id}`}
                className="group relative aspect-[4/5] zoom-parent block overflow-hidden"
              >
                <img src={CATEGORY_PHOTOS[cat.id] || PHOTO.weddings} alt={cat.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-end text-white">
                  <div className="eyebrow-light mb-1" style={{fontSize:'10px',color:'rgba(255,255,255,0.75)'}}>Categoría</div>
                  <div className="font-serif italic text-lg md:text-xl leading-tight">{cat.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section className="py-24 md:py-32 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-4">Quienes ya celebraron</p>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight">
              Sus historias, <span className="serif-italic">su mejor reseña.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-10">
            {REVIEWS.map(r => (
              <article key={r.name} className="bg-ivory">
                <div className="aspect-[4/3] mb-6 overflow-hidden">
                  <img src={r.photo} alt={r.name} className="w-full h-full object-cover" />
                </div>
                <div className="px-1">
                  <div className="font-serif text-5xl text-gold/40 leading-none mb-2 select-none">"</div>
                  <p className="font-serif text-lg italic leading-snug mb-5">{r.text}</p>
                  <div className="border-t border-bone-dark pt-4">
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-[11px] tracking-[0.15em] uppercase text-ink-muted mt-1">{r.event} · {r.city}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROVEEDORES DESTACADOS ── */}
      {featured.length > 0 && (
        <section className="py-24 md:py-32 px-6 md:px-10 bg-bone">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
              <div>
                <p className="eyebrow mb-4">Profesionales destacados</p>
                <h2 className="font-serif text-4xl md:text-5xl leading-tight">
                  Los que <span className="serif-italic">nuestras parejas</span> recomiendan.
                </h2>
              </div>
              <Link href="/proveedores" className="text-[11px] tracking-[0.18em] uppercase font-medium pb-1 border-b border-ink hover:border-gold hover:text-gold transition-colors self-start md:self-end">
                Ver todos →
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {featured.slice(0, 6).map((p: any) => (
                <Link key={p.id} href={`/proveedores/${p.slug || p.id}`} className="group lift bg-white border border-bone-dark block">
                  <div className="zoom-parent aspect-[4/3] bg-bone-dark">
                    <img src={CATEGORY_PHOTOS[p.category] || PHOTO.weddings} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6">
                    <div className="eyebrow mb-2" style={{fontSize:'10px'}}>{(CATEGORIES.find(c=>c.id===p.category)?.label || '').toString()}</div>
                    <h3 className="font-serif italic text-xl mb-2 font-normal">{p.name}</h3>
                    <div className="text-[13px] text-ink-soft mb-4">{p.city}</div>
                    <div className="flex justify-between items-center pt-4 border-t border-bone-dark">
                      <div className="text-sm">desde <span className="font-serif text-lg">{(p.price_base || 0).toLocaleString('es-ES')}<span className="text-gold">€</span></span></div>
                      <span className="text-[10px] tracking-[0.15em] uppercase font-medium group-hover:text-gold transition-colors">Ver perfil →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA FINAL ── */}
      <section className="relative h-[480px] md:h-[560px] overflow-hidden">
        <img src={PHOTO.cta} alt="Fiesta" className="absolute inset-0 w-full h-full object-cover kenburns" />
        <div className="absolute inset-0 bg-ink/55" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6 z-10">
          <p className="eyebrow-light mb-4" style={{ letterSpacing: '0.3em' }}>Reserva sin comisión</p>
          <h2 className="font-serif text-4xl md:text-6xl text-white leading-tight mb-6 max-w-3xl">
            Tu fiesta no se va a <span className="italic" style={{color:'#FFD166'}}>organizar sola</span>.
          </h2>
          <p className="text-white/85 text-base md:text-lg max-w-lg mx-auto mb-10">
            Cuéntanos qué celebras y te montamos un pack a medida en menos de 24 horas.
          </p>
          <Link
            href="/#packs"
            className="bg-white text-ink text-[11px] tracking-[0.18em] uppercase font-medium px-8 py-4 rounded-full hover:bg-bone transition-colors"
          >
            Empezar mi celebración →
          </Link>
        </div>
      </section>
    </main>
  )
}
