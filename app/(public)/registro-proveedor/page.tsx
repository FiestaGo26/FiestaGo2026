'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { CATEGORIES, CITIES } from '@/lib/constants'

export default function RegistroProveedorPage() {
  const router = useRouter()
  const [step,    setStep]    = useState(1) // 1=info, 2=confirm
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name:'', category:'foto', city:'Madrid',
    email:'', phone:'', website:'', instagram:'',
    description:'', price_base:'', price_unit:'por evento',
    specialties:[] as string[],
  })

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.city) {
      toast.error('Completa los campos obligatorios')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price_base: parseFloat(form.price_base) || null }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStep(2)
      toast.success('¡Registro enviado! Te contactaremos pronto.')
    } catch (err: any) {
      toast.error(err.message || 'Error al registrarte. Inténtalo de nuevo.')
    }
    setLoading(false)
  }

  const cat = CATEGORIES.find(c => c.id === form.category)

  if (step === 2) return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="font-serif text-3xl font-black text-ink mb-4">¡Registro enviado!</h1>
        <p className="text-ink/60 mb-6 leading-relaxed">
          Hemos recibido tu solicitud para <strong className="text-ink">{form.name}</strong>.
          Nuestro equipo la revisará en las próximas 24-48 horas y te contactaremos en{' '}
          <strong className="text-ink">{form.email}</strong>.
        </p>
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6 text-left">
          <div className="text-xs font-bold text-ink/40 uppercase tracking-widest mb-4">Resumen del registro</div>
          {[['Negocio',form.name],['Categoría',`${cat?.icon} ${cat?.label}`],
            ['Ciudad',form.city],['Email',form.email]].map(([k,v])=>(
            <div key={k} className="flex justify-between py-2 border-b border-stone-100 text-sm">
              <span className="text-ink/50">{k}</span>
              <span className="font-medium text-ink">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 text-sm text-ink/50 bg-sage/10 border border-sage/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2"><span className="text-sage">✓</span> Registro gratuito — sin tarjeta</div>
          <div className="flex items-center gap-2"><span className="text-sage">✓</span> 1ª transacción sin comisión (0%)</div>
          <div className="flex items-center gap-2"><span className="text-sage">✓</span> Solo 8% desde la 2ª venta real</div>
        </div>
        <button onClick={() => router.push('/')}
          className="w-full bg-coral text-white font-bold py-3 rounded-xl hover:bg-coral-dark transition-colors">
          Volver al inicio
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream py-16 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block text-xs font-bold tracking-widest uppercase text-sage bg-sage/10 border border-sage/20 px-3 py-1 rounded-full mb-4">
            Registro gratuito
          </div>
          <h1 className="font-serif text-3xl font-black text-ink mb-3">Registra tu negocio</h1>
          <p className="text-ink/55 leading-relaxed">Sin coste hasta tu primera reserva. Solo pagas cuando ganas.</p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[['🆓','Gratis','Sin tarjeta ni pago inicial'],
            ['🎁','1ª transacción','0% comisión'],
            ['💸','Desde la 2ª','Solo 8%'],
          ].map(([ic,t,d])=>(
            <div key={t} className="bg-white border border-stone-200 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-2">{ic}</div>
              <div className="text-xs font-bold text-ink mb-1">{t}</div>
              <div className="text-xs text-ink/50">{d}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="bg-white border border-stone-200 rounded-3xl p-6 shadow-card">
          <div className="grid grid-cols-1 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Nombre del negocio *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} required
                placeholder="ej. Fotografía García"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>

            {/* Category + City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Categoría *</label>
                <select value={form.category} onChange={e=>set('category',e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors">
                  {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Ciudad *</label>
                <select value={form.city} onChange={e=>set('city',e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors">
                  {CITIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} required
                  placeholder="hola@minegocio.com"
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Teléfono</label>
                <input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}
                  placeholder="+34 600 000 000"
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Precio base (€)</label>
                <input type="number" value={form.price_base} onChange={e=>set('price_base',e.target.value)}
                  placeholder="ej. 1500"
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Unidad</label>
                <select value={form.price_unit} onChange={e=>set('price_unit',e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors">
                  {['por evento','por persona','por hora','por día'].map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Website + Instagram */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Web</label>
                <input value={form.website} onChange={e=>set('website',e.target.value)}
                  placeholder="https://minegocio.com"
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Instagram</label>
                <input value={form.instagram} onChange={e=>set('instagram',e.target.value)}
                  placeholder="@minegocio"
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Descripción</label>
              <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3}
                placeholder="Cuéntanos qué ofreces y qué te hace especial..."
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full mt-5 bg-coral text-white font-bold py-3.5 rounded-xl text-base hover:bg-coral-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Enviando...' : 'Crear mi perfil gratis →'}
          </button>
          <p className="text-center text-xs text-ink/40 mt-3">
            Sin permanencia · Sin coste hasta tu 1ª transacción · Puedes darte de baja cuando quieras
          </p>
        </form>
      </div>
    </div>
  )
}
