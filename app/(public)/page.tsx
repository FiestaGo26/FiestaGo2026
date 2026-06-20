import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase'
import { getPhoto, CATEGORIES } from '@/lib/constants'
import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'
import SearchBar from './_components/SearchBar'
import InspirationAccordion from './_components/InspirationAccordion'

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
  { id:'cumple',     title:'Cumpleaños inolvidables',  hint:'Animación, tartas, decoración… que cada año sea el mejor.',    cat:'animacion', seed:'kids',     href:'/cumpleanos' },
  { id:'bodas',      title:'Tu boda perfecta',         hint:'Espacios, catering y todo lo que necesitas para el gran día.', cat:'planner',   seed:'wedding',  href:'/proveedores?categoria=planner' },
  { id:'comuniones', title:'Comuniones y bautizos',    hint:'Restaurante, fotografía, decoración y tarta — el día especial.',cat:'pastel',    seed:'kids',     href:'/comuniones' },
  { id:'corporativo',title:'Eventos corporativos',     hint:'Cenas de empresa, despedidas, lanzamientos. Sin estrés logístico.',cat:'catering',seed:'party',   href:'/corporativo' },
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
      <section className="relative h-auto md:h-[88vh] min-h-[640px] md:min-h-[680px] flex items-end overflow-hidden pt-20 md:pt-0">
        <Image
          src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1920&q=85&auto=format&fit=crop"
          alt="Amigos celebrando con FiestaGo"
          fill priority className="object-cover"/>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/30 to-black/75" />

        <div className="relative max-w-6xl mx-auto px-6 pb-64 md:pb-52 w-full text-white">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs md:text-sm font-bold tracking-[0.22em] uppercase mb-5 bg-coral/95 text-white px-4 py-1.5 rounded-full">
              🛡 Garantía de Éxito
            </p>
            <h1 className="font-serif text-[2.6rem] sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-5 md:mb-6">
              Reserva tu celebración{' '}
              <span
                className="italic font-bold text-white"
                style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(232,85,62,0.95) 55%)', padding: '0 0.15em' }}>
                en 3 pasos.
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-2xl text-white/95 max-w-xl leading-snug md:leading-relaxed mb-3 md:mb-4">
              Bodas, cumpleaños, comuniones o eventos corporativos. Garantizado.
            </p>
            <p className="hidden sm:block text-sm md:text-base text-white/80 max-w-xl leading-relaxed">
              Si tu proveedor te falla, te devolvemos el 110% — o más. Profesionales verificados, pago seguro hasta el evento, y nuestra mediación si algo se complica.
            </p>
          </div>
        </div>

        {/* Search bar flotante DENTRO del hero (sobre la foto) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 md:bottom-12 w-[94%] max-w-4xl z-20">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-2 md:p-3">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* ─────────── 3 PASOS ─────────── */}
      <section className="bg-cream">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-20">
          <div className="text-center mb-10 md:mb-14">
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-coral mb-3">
              Así de fácil
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
              Tu celebración{' '}
              <span className="italic font-light">en 3 pasos.</span>
            </h2>
            <p className="text-ink/60 mt-3 max-w-xl mx-auto leading-relaxed">
              Sin mandar 10 emails, sin esperar 2 semanas a un presupuesto, sin pagar por adelantado a desconocidos.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                step:'1',
                icon:'🎯',
                title:'Elige qué necesitas',
                body:'Cuéntanos qué celebras (boda, cumpleaños, comunión, evento de empresa…), fecha y ciudad. Te enseñamos los profesionales disponibles ese día con precio claro.',
              },
              {
                step:'2',
                icon:'❤️',
                title:'Guarda tus favoritos y reserva',
                body:'Compara, comparte tu shortlist con tu pareja o familia, y reserva al que más te encaje en un click. Pago seguro, retenido hasta el evento.',
              },
              {
                step:'3',
                icon:'🎉',
                title:'Disfruta tu evento',
                body:'Ya está. Si algo va mal el día D, te respaldamos económicamente: 110% si no encontramos sustituto, o 100% más compensación si tu proveedor no aparece. Esto no lo encontrarás en ningún portal del sector.',
              },
            ].map(s => (
              <div key={s.step} className="relative">
                <div className="bg-white border border-stone-200 rounded-3xl p-7 h-full">
                  <div className="absolute -top-4 -left-2 text-7xl font-serif font-bold text-coral/15 leading-none select-none">
                    {s.step}
                  </div>
                  <div className="relative">
                    <div className="text-4xl mb-4">{s.icon}</div>
                    <h3 className="font-serif text-xl text-ink font-bold mb-3 leading-snug">{s.title}</h3>
                    <p className="text-sm text-ink/70 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/quiz"
              className="inline-block bg-coral text-white font-bold px-7 py-3.5 rounded-xl text-sm hover:bg-coral-dark transition-colors shadow-coral">
              ✨ Empezar el quiz (2 minutos) →
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── GARANTÍA DE ÉXITO ─────────── */}
      <section className="bg-ink text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-coral mb-3">
              Por qué somos distintos
            </p>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight">
              No somos un directorio.{' '}
              <span className="italic font-light">Respondemos.</span>
            </h2>
            <p className="text-white/65 mt-4 max-w-2xl mx-auto leading-relaxed">
              Mientras otras plataformas se desentienden cuando hay un problema, en FiestaGo respaldamos cada reserva con nuestro dinero. Esto cambia cómo se reserva.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon:'💸', title:'Te devolvemos el 110%', body:'Si tu proveedor cancela y no encontramos sustituto en 48h, recuperas el 110% de lo pagado. Y si no se presenta el día del evento, el 100% más una compensación de hasta 3.000€.' },
              { icon:'🔒', title:'Pago retenido hasta el evento', body:'El dinero queda en FiestaGo, no en el proveedor, hasta que tu celebración termina. Si algo falla, podemos actuar de verdad.' },
              { icon:'✅', title:'Profesionales verificados', body:'DNI/CIF y seguro de responsabilidad civil contrastados. Solo aparece en la web quien puede demostrar que es de fiar.' },
              { icon:'🎉', title:'Cualquier celebración', body:'Bodas, comuniones, cumpleaños, despedidas, eventos privados o corporativos. La misma garantía da igual lo que organices.' },
              { icon:'💰', title:'Precio cerrado, sin presupuestos', body:'Ves el precio, eliges fecha y reservas. Como un hotel. Nada de pedir 10 presupuestos a 10 sitios distintos para que nadie te conteste claro.' },
              { icon:'💬', title:'Soporte humano de verdad', body:'Hablas con una persona cuando lo necesitas — no con un chatbot. Especialmente la semana del evento, cuando entra el pánico.' },
            ].map(b => (
              <div key={b.title} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="text-3xl mb-4">{b.icon}</div>
                <h3 className="font-serif text-xl font-black mb-3 leading-snug">{b.title}</h3>
                <p className="text-white/65 text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/garantia"
              className="inline-block text-sm font-semibold border border-white/30 text-white px-6 py-3 rounded-xl hover:bg-white hover:text-ink transition-colors">
              Ver cómo funciona la Garantía →
            </Link>
            <p className="text-xs text-white/45 mt-4 max-w-xl mx-auto leading-relaxed">
              Aplica a reservas realizadas y pagadas íntegramente dentro de FiestaGo.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── CATEGORÍAS STRIP (Airbnb style) ─────────── */}
      <section className="border-b border-stone-200/70">
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

      {/* ─────────── ¿QUÉ QUIERES CELEBRAR? (panel desplegable) ─────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 md:pt-20">
        <div className="text-center mb-8 md:mb-10 px-2">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-coral mb-3">
            Empieza aquí
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
            ¿Qué quieres <span className="italic font-light">celebrar?</span>
          </h2>
          <p className="text-sm md:text-base text-ink/55 mt-3 max-w-md mx-auto leading-relaxed">
            Elige el tipo de evento y te enseñamos lo mejor que tenemos para ti.
          </p>
        </div>
        <InspirationAccordion items={COLLECTIONS} />
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
                  <div className="text-sm" title={textoGarantiaIncluida(pk.price_base)}>
                    <span className="text-ink/50">desde </span>
                    <span className="font-semibold text-ink">{formatEuro(precioCliente(pk.price_base))}</span>
                    <span className="text-[10px] text-ink/50 block leading-tight">garantía incl.</span>
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
          <Link href="/profesionales"
            className="inline-flex items-center gap-2 bg-coral text-white font-semibold px-7 py-4 rounded-2xl hover:bg-coral-dark transition-colors whitespace-nowrap">
            Saber más para profesionales →
          </Link>
        </div>
      </section>
    </main>
  )
}
