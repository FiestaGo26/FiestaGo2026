'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CATEGORIES, CITIES } from '@/lib/constants'
import toast from 'react-hot-toast'

export default function RegistroProveedorPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name:'', category:'foto', city:'Madrid',
    email:'', password:'', confirmPassword:'',
    phone:'', website:'', instagram:'',
    description:'', price_base:'', price_unit:'por evento',
    specialties:[] as string[],
  })

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (form.password !== form.confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)
    try {
      // 1. Intentar crear cuenta en Supabase Auth.
      //    Si el auth user ya existe (caso "orphan": auth creado en intento anterior
      //    pero el provider no se llegó a insertar), intentamos sign-in con la
      //    misma contraseña para continuar y crear solo el provider.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/proveedor/panel`,
          data: { name: form.name, role: 'provider' },
        },
      })

      // Caso "user already registered" (orphan): probamos sign-in
      const isAlreadyRegistered = authError && (
        /already registered|already exists|user already|user_already/i.test(authError.message || '')
      )
      if (authError && !isAlreadyRegistered) throw authError
      if (isAlreadyRegistered) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (signInErr) {
          throw new Error('Ya existe una cuenta con este email. Si la contraseña es correcta, espera unos segundos y reintenta. Si no la recuerdas, usa "He olvidado mi contraseña" desde la página de acceso.')
        }
      }

      // 2. Crear el provider row. El POST detecta si ya existe por email.
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name,
          category:    form.category,
          city:        form.city,
          email:       form.email,
          phone:       form.phone || null,
          website:     form.website || null,
          instagram:   form.instagram || null,
          description: form.description || null,
          price_base:  parseFloat(form.price_base) || null,
          price_unit:  form.price_unit,
          specialties: [],
          source:      'web',
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        // Si el provider ya existe (constraint violation), lo damos por OK
        const msg = (data.error || '').toLowerCase()
        if (!msg.includes('duplicate') && !msg.includes('already')) {
          throw new Error(data.error || `Error ${res.status}`)
        }
      }

      setStep(2)
      toast.success(isAlreadyRegistered ? 'Cuenta vinculada y perfil creado' : '¡Registro completado!')

    } catch (err: any) {
      toast.error(err.message || 'Error al registrarse. Inténtalo de nuevo.')
    }
    setLoading(false)
  }

  const cat = CATEGORIES.find(c => c.id === form.category)

  if (step === 2) return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="font-serif text-3xl font-black text-ink mb-4">¡Ya eres parte de FiestaGo!</h1>
        <p className="text-ink/60 mb-6 leading-relaxed">
          Tu perfil está pendiente de verificación. Nuestro equipo lo revisará en 24-48h.
          Mientras tanto ya puedes acceder a tu panel.
        </p>
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6 text-left">
          <div className="text-xs font-bold text-ink/40 uppercase tracking-widest mb-4">Tu registro</div>
          {[['Negocio',form.name],['Categoría',`${cat?.icon} ${cat?.label}`],['Ciudad',form.city],['Email',form.email]].map(([k,v])=>(
            <div key={k} className="flex justify-between py-2 border-b border-stone-100 text-sm">
              <span className="text-ink/50">{k}</span>
              <span className="font-medium text-ink">{v}</span>
            </div>
          ))}
        </div>
        <button onClick={() => router.push('/proveedor/login')}
          className="w-full bg-coral text-white font-bold py-3 rounded-xl hover:bg-coral-dark transition-colors">
          Acceder a mi panel →
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream py-16 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block text-xs font-bold tracking-widest uppercase text-sage bg-sage/10 border border-sage/20 px-3 py-1 rounded-full mb-4">
            Registro gratuito
          </div>
          <h1 className="font-serif text-3xl font-black text-ink mb-3">Registra tu negocio</h1>
          <p className="text-ink/55 leading-relaxed">Sin coste hasta tu primera reserva.</p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[['🆓','Gratis','Sin tarjeta'],['🎁','1ª transacción','0% comisión'],['💸','Desde la 2ª','Solo 8%']].map(([ic,t,d])=>(
            <div key={t} className="bg-white border border-stone-200 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-2">{ic}</div>
              <div className="text-xs font-bold text-ink mb-1">{t}</div>
              <div className="text-xs text-ink/50">{d}</div>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="bg-white border border-stone-200 rounded-3xl p-6 shadow-card">
          <div className="grid grid-cols-1 gap-4">

            {/* Nombre */}
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Nombre del negocio *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} required
                placeholder="ej. Fotografía García"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>

            {/* Categoria + Ciudad */}
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

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Email *</label>
              <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} required
                placeholder="hola@minegocio.com"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Contraseña *</label>
              <input type="password" value={form.password} onChange={e=>set('password',e.target.value)} required
                placeholder="Mínimo 8 caracteres"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Confirmar contraseña *</label>
              <input type="password" value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} required
                placeholder="Repite la contraseña"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Teléfono</label>
              <input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>

            {/* Precio */}
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

            {/* Descripción */}
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Descripción</label>
              <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3}
                placeholder="Cuéntanos qué ofreces..."
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full mt-5 bg-coral text-white font-bold py-3.5 rounded-xl text-base hover:bg-coral-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Creando tu perfil...' : 'Crear mi perfil gratis →'}
          </button>

          <p className="text-center text-xs text-ink/40 mt-3">
            ¿Ya tienes cuenta?{' '}
            <a href="/proveedor/login" className="text-coral hover:underline font-semibold">Acceder</a>
          </p>
        </form>
      </div>
    </div>
  )
}
