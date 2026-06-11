'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CATEGORIES, CITIES } from '@/lib/constants'
import toast from 'react-hot-toast'

function RegistroProveedorInner() {
  const router = useRouter()
  const sp     = useSearchParams()
  const supabase = createClient()
  const refParam = sp?.get('ref') || null  // ID del proveedor que refiere
  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [referrerName, setReferrerName] = useState<string | null>(null)
  // Si el POST a /api/providers falla después de que el signup de Auth haya
  // funcionado, NO podemos perder al proveedor. Guardamos el mensaje de error
  // y le mostramos un banner persistente con botón "Reintentar" que NO recrea
  // el auth user (ya existe), solo reintenta el INSERT del provider row.
  const [postError, setPostError] = useState<string | null>(null)
  const [authCreated, setAuthCreated] = useState(false)
  const [form, setForm] = useState({
    name:'', category:'foto', city:'Madrid',
    email:'', password:'', confirmPassword:'',
    phone:'', website:'', instagram:'',
    description:'', price_base:'', price_unit:'por evento',
    specialties:[] as string[],
    acceptTerms: false,
  })

  // Si llega con ?ref=ID, mostrar quién le invitó
  useEffect(() => {
    if (!refParam) return
    fetch(`/api/providers?id=${refParam}`)
      .then(r => r.json())
      .then(d => { if (d?.provider?.name) setReferrerName(d.provider.name) })
      .catch(() => {})
  }, [refParam])

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
    if (!form.acceptTerms) {
      toast.error('Debes aceptar los Compromisos del Proveedor para inscribirte')
      return
    }

    setLoading(true)
    setPostError(null)
    try {
      // 1. Auth: signUp si es nuevo, o sign-in si ya existe (orphan recovery).
      if (!authCreated) {
        const { error: authError } = await supabase.auth.signUp({
          email:    form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/proveedor/panel`,
            data: { name: form.name, role: 'provider' },
          },
        })
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
        setAuthCreated(true)
      }

      // 2. Provider INSERT (separado para poder reintentar sin tocar el auth).
      await createProviderRow()

      setStep(2)
      toast.success(authCreated ? 'Perfil creado correctamente' : '¡Registro completado!')

    } catch (err: any) {
      const msg = err.message || 'Error al registrarse. Inténtalo de nuevo.'
      toast.error(msg)
      // Si el auth ya está creado pero el INSERT del provider falló, mostramos
      // banner persistente con botón Reintentar — el form mantiene los datos.
      if (authCreated) setPostError(msg)
    }
    setLoading(false)
  }

  // Llamada al endpoint que crea el provider row. Separada para que el banner
  // "Reintentar" la pueda invocar sin volver a tocar el auth.
  async function createProviderRow() {
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
        referred_by: refParam,
        accept_terms: true,
      }),
    })
    const data = await res.json().catch(() => ({} as any))
    if (!res.ok || data.error) {
      const msg = (data.error || '').toLowerCase()
      if (!msg.includes('duplicate') && !msg.includes('already')) {
        throw new Error(data.error || `Error ${res.status} al crear el perfil`)
      }
    }
  }

  async function handleRetryPost() {
    setLoading(true); setPostError(null)
    try {
      await createProviderRow()
      setStep(2)
      toast.success('Perfil creado correctamente')
    } catch (err: any) {
      const msg = err.message || 'Error al crear el perfil'
      toast.error(msg)
      setPostError(msg)
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

        {/* Banner si llega vía link de referido */}
        {referrerName && (
          <div className="bg-coral/10 border border-coral/30 rounded-2xl p-4 mb-6 text-center">
            <div className="text-xs font-bold tracking-widest uppercase text-coral mb-1">🤝 Te invita</div>
            <div className="text-sm text-ink/80">
              <strong className="text-ink">{referrerName}</strong> te ha invitado a FiestaGo.<br/>
              <span className="text-xs text-ink/55">Al registrarte, los dos subís a los primeros puestos de vuestra categoría.</span>
            </div>
          </div>
        )}

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

        {/* Banner de recuperación: aparece si el auth se creó pero el INSERT del
            provider falló. Mantenemos los datos del form y damos botón Reintentar
            que NO vuelve a tocar el auth. */}
        {postError && authCreated && (
          <div className="mb-5 bg-coral/5 border-2 border-coral/40 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <div className="font-bold text-coral mb-1">Tu cuenta se creó, pero falló el último paso</div>
                <div className="text-sm text-ink/75 leading-relaxed mb-3">
                  Tu email y contraseña ya están guardados. Solo falta crear tu perfil de proveedor.
                  Pulsa <strong>Reintentar</strong> — no perderás los datos del formulario.
                </div>
                <div className="bg-white border border-coral/20 rounded-lg px-3 py-2 text-xs font-mono text-ink/70 mb-3 break-words">
                  {postError}
                </div>
                <button type="button" onClick={handleRetryPost} disabled={loading}
                  className="bg-coral text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-coral-dark disabled:opacity-50 transition-colors">
                  {loading ? 'Reintentando…' : '🔄 Reintentar creación del perfil'}
                </button>
              </div>
            </div>
          </div>
        )}

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

          {/* Compromisos del proveedor — checkbox obligatorio */}
          <label className="flex items-start gap-3 mt-5 cursor-pointer p-3 bg-cream-dark/40 border border-stone-200 rounded-xl">
            <input type="checkbox" checked={form.acceptTerms}
              onChange={e => set('acceptTerms', e.target.checked)}
              className="mt-0.5 accent-coral w-4 h-4 flex-shrink-0"/>
            <span className="text-xs text-ink/75 leading-relaxed">
              He leído y acepto los{' '}
              <a href="/proveedor/compromisos" target="_blank" rel="noreferrer" className="text-coral underline font-semibold">
                Compromisos del Proveedor
              </a>, incluidas las penalizaciones económicas del punto 3 y la autorización de domiciliación bancaria para su cargo.
            </span>
          </label>

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

export default function RegistroProveedorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center text-ink/40">Cargando...</div>}>
      <RegistroProveedorInner />
    </Suspense>
  )
}
