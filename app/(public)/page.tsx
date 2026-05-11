import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase'
import { getPhoto, CATEGORIES } from '@/lib/constants'
import SearchBar from './_components/SearchBar'

async function getPacks() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('packs').select('*').eq('status','active').order('sort_order')
  return data || []
}

async function getFeaturedProviders() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('providers').select('*')
    .eq('status','approved').eq('featured',true).order('rating',{ascending:false}).limit(4)
  return data || []
}

const REVIEWS = [
  {name:'Laura & Carlos', city:'Madrid', stars:5, text:'Reservé el Pack Cumple Premium para mi hija y fue perfecto. Todo coordinado, sin estrés. ¡Repetimos!', event:'Cumpleaños 6 años'},
  {name:'Carlos & Ana',   city:'Barcelona', stars:5, text:'FiestaGo organizó nuestra boda íntima en tiempo récord. Increíble equipo.', event:'Boda íntima'},
  {name:'Marcos R.',      city:'Sevilla', stars:5, text:'El Pack Fiesta en Casa superó todas mis expectativas. Llegaron, montaron y yo disfruté.', event:'Cumpleaños adulto'},
  {name:'Sara T.',        city:'Valencia', stars:5, text:'Por fin una plataforma donde reservas todo a la vez. Sin llamar a 10 sitios. 10/10.', event:'Fiesta privada'},
]

export default async function HomePage() {
  const [packs, featured] = await Promise.all([getPacks(), getFeaturedProviders()])

  return (
    <main>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 py-20 px-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-coral/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-400/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* copy */}
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-coral bg-coral/10 border border-coral/20 px-4 py-1.5 rounded-full mb-6">
              ✨ El marketplace de celebraciones #1 en España
            </div>
            <h1 className="font-serif text-5xl font-black text-ink leading-tight tracking-tight mb-5">
              Organiza una fiesta increíble{' '}
              <span className="text-coral italic">sin complicarte.</span>
            </h1>
            <p className="text-lg text-ink/60 leading-relaxed mb-10 max-w-md">
              Elige un pack listo para reservar o personaliza tu celebración con los mejores profesionales de tu ciudad.
            </p>

            {/* search bar (unificado: Packs / Proveedores / Servicios) */}
            <SearchBar />

            <div className="flex gap-5 text-sm text-ink/50">
              {['✔ Proveedores verificados','✔ Reserva segura','✔ Precios transparentes'].map(t=>(
                <span key={t} className="font-medium">{t}</span>
              ))}
            </div>
          </div>

          {/* photo collage */}
          <div className="relative h-[420px] hidden lg:block">
            <div className="absolute top-0 left-0 w-[62%] h-[68%] rounded-2xl overflow-hidden shadow-2xl">
              <Image src={getPhoto('party',0,600,400)} alt="Fiesta" fill className="object-cover"/>
            </div>
            <div className="absolute bottom-0 left-[10%] w-[55%] h-[54%] rounded-2xl overflow-hidden shadow-xl border-[3px] border-white">
              <Image src={getPhoto('kids',1,500,350)} alt="Cumpleaños" fill className="object-cover"/>
            </div>
            <div className="absolute top-[15%] right-0 w-[40%] h-[55%] rounded-2xl overflow-hidden shadow-xl border-[3px] border-white">
              <Image src={getPhoto('espacios',0,400,300)} alt="Espacio" fill className="object-cover"/>
            </div>
            {/* floating badges */}
            <div className="absolute top-3 right-6 bg-white rounded-2xl px-3 py-2 shadow-lg flex items-center gap-2 z-10">
              <span className="text-2xl">⭐</span>
              <div><div className="text-sm font-bold text-ink">4.9/5.0</div><div className="text-xs text-ink/50">+1.200 fiestas</div></div>
            </div>
            <div className="absolute bottom-4 right-3 bg-coral rounded-2xl px-3 py-2 shadow-lg z-10">
              <div className="text-xs font-bold text-white">🎁 1ª transacción</div>
              <div className="text-xs text-white/80">sin comisión</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PACKS ── */}
      <section id="packs" className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex justify-between items-end mb-12">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase text-coral mb-3">Packs listos para reservar</div>
            <h2 className="font-serif text-4xl font-black text-ink tracking-tight">
              Tu fiesta completa,<br/>en un solo clic.
            </h2>
          </div>
          <p className="text-sm text-ink/50 max-w-56 text-right leading-relaxed hidden md:block">
            Todo coordinado por nosotros. Tú solo apareces y disfrutas.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {packs.map((pk: any) => (
            <Link key={pk.id} href={`/packs/${pk.slug || pk.id}`}
              className="group bg-white border border-stone-200 rounded-3xl overflow-hidden hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200 flex flex-col"
              style={{ '--hover-border': pk.color } as any}>
              <div className="h-48 relative overflow-hidden">
                <Image src={getPhoto(pk.photo_seed || 'party', 0, 600, 400)} alt={pk.name}
                  fill className="object-cover group-hover:scale-105 transition-transform duration-300"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/>
                <div className="absolute top-3 left-3">
                  <span className="text-xs font-bold tracking-wide uppercase px-2.5 py-1 rounded-full"
                    style={{ background: pk.color + '22', color: pk.color, border: `1px solid ${pk.color}44` }}>
                    {pk.highlight}
                  </span>
                </div>
                <span className="absolute bottom-3 left-4 text-3xl">{pk.emoji}</span>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-serif text-lg font-bold text-ink mb-1.5">{pk.name}</h3>
                <div className="text-xs text-ink/50 mb-3">{pk.duration} · hasta {pk.max_guests} personas</div>
                <div className="flex flex-col gap-1.5 mb-5 flex-1">
                  {(pk.includes || []).slice(0,3).map((inc: string, i: number) => (
                    <div key={i} className="flex gap-2 items-center text-xs text-ink/60">
                      <span style={{ color: pk.color }}>✓</span>{inc}
                    </div>
                  ))}
                  {(pk.includes || []).length > 3 && (
                    <div className="text-xs text-ink/40">+{pk.includes.length - 3} más incluido</div>
                  )}
                </div>
                <div className="flex justify-between items-center border-t border-stone-100 pt-4">
                  <div>
                    <span className="text-xs text-ink/50">desde </span>
                    <span className="font-serif text-xl font-bold" style={{ color: pk.color }}>{pk.price_base}€</span>
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl text-white"
                    style={{ background: pk.color }}>
                    Reservar →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-cream-dark border-y border-stone-200 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-bold tracking-widest uppercase text-coral mb-3">Simple y rápido</div>
            <h2 className="font-serif text-4xl font-black text-ink tracking-tight">¿Cómo funciona?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {n:'01', icon:'📦', title:'Elige tu pack', desc:'Selecciona el pack que mejor encaje con tu celebración. Todo incluido desde 199€.'},
              {n:'02', icon:'✏️', title:'Personalízalo', desc:'Ajusta la fecha, invitados y ciudad. Añade extras a tu gusto en segundos.'},
              {n:'03', icon:'🥂', title:'Reserva y celebra', desc:'Pago seguro y nosotros coordinamos todo. Tú solo disfruta el día.'},
            ].map(s => (
              <div key={s.n} className="relative bg-white rounded-3xl p-8 border border-stone-200 text-center overflow-hidden">
                <div className="absolute top-0 right-0 font-serif text-8xl font-black text-coral/5 leading-none translate-x-2 -translate-y-2 select-none">{s.n}</div>
                <div className="w-14 h-14 bg-coral/10 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5">{s.icon}</div>
                <h3 className="font-serif text-xl font-bold text-ink mb-3">{s.title}</h3>
                <p className="text-sm text-ink/55 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POPULAR CATEGORIES ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex justify-between items-end mb-10">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase text-coral mb-3">Lo que más se reserva</div>
            <h2 className="font-serif text-3xl font-black text-ink tracking-tight">Categorías populares</h2>
          </div>
          <Link href="/proveedores" className="text-sm font-semibold text-ink/60 hover:text-coral transition-colors">
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIES.slice(0,8).map(cat => (
            <Link key={cat.id} href={`/proveedores?categoria=${cat.id}`}
              className="relative rounded-2xl overflow-hidden h-44 group cursor-pointer">
              <Image src={getPhoto(cat.id, 0, 400, 300)} alt={cat.label}
                fill className="object-cover group-hover:scale-105 transition-transform duration-300"/>
              <div className="absolute inset-0 transition-opacity"
                style={{ background: `linear-gradient(to top, ${cat.color}CC, transparent 55%)` }}/>
              <div className="absolute bottom-3 left-3">
                <div className="text-xl mb-1">{cat.icon}</div>
                <div className="text-sm font-bold text-white leading-tight">{cat.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className="bg-ink py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-bold tracking-widest uppercase text-coral mb-3">Lo que dicen nuestros clientes</div>
            <h2 className="font-serif text-4xl font-black text-white tracking-tight">Fiestas que no se olvidan</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {REVIEWS.map((r, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(s => <span key={s} className="text-gold text-base">★</span>)}
                </div>
                <p className="text-white/80 text-sm leading-relaxed mb-5">"{r.text}"</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-coral/20 flex items-center justify-center text-lg">👤</div>
                    <div>
                      <div className="text-sm font-bold text-white">{r.name}</div>
                      <div className="text-xs text-white/40">{r.city}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-coral bg-coral/15 px-3 py-1 rounded-xl">{r.event}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <section className="border-y border-stone-200 py-10 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-5">
          {[
            {icon:'🛡️', title:'Proveedores verificados', desc:'Todos los profesionales pasan por un proceso de verificación real.'},
            {icon:'🔒', title:'Reserva 100% segura', desc:'Pago protegido. Tu dinero no llega al proveedor hasta que el servicio se confirma.'},
            {icon:'💸', title:'Precios transparentes', desc:'Sin costes ocultos. Ves exactamente qué pagas y qué recibe cada proveedor.'},
          ].map(({icon,title,desc}) => (
            <div key={title} className="flex gap-4 items-start bg-white border border-stone-100 rounded-2xl p-5 shadow-card">
              <div className="w-11 h-11 bg-cream-dark rounded-xl flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
              <div>
                <div className="font-semibold text-ink text-sm mb-1.5">{title}</div>
                <div className="text-xs text-ink/55 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="bg-gradient-to-r from-coral to-coral-dark py-16 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-serif text-4xl font-black text-white tracking-tight mb-4">¿Lista tu próxima fiesta?</h2>
          <p className="text-white/80 text-base mb-8 leading-relaxed">Reserva en minutos. Sin llamadas, sin emails, sin estrés.</p>
          <a href="#packs"
            className="inline-block bg-white text-coral font-bold text-base px-10 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
            Ver todos los packs 🎉
          </a>
        </div>
      </section>
    </main>
  )
}
