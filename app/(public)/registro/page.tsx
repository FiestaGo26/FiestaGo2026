'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CITIES = ['Madrid','Barcelona','Valencia','Sevilla','Bilbao','Málaga','Zaragoza','Murcia','Alicante','Granada']

export default function RegistroClientePage() {
  const router   = useRouter()
  const supabase = createClient()

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [phone,    setPhone]    = useState('')
  const [city,     setCity]     = useState('')
  const [marketing,setMarketing]= useState(true)
  const [saving,   setSaving]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setSaving(true)
    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone,
            city,
            accepts_marketing: marketing,
            account_type: 'customer',
          },
        },
      })

      if (authError) {
        const already = /already registered|already exists/i.test(authError.message)
        if (already) {
          // Intentar login con esas credenciales
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
          if (signInErr) {
            toast.error('Este email ya está registrado. Prueba a iniciar sesión.')
            setSaving(false); return
          }
          toast.success('¡Bienvenido de vuelta!')
          router.push('/mi-cuenta')
          return
        }
        throw authError
      }

      toast.success('¡Bienvenido a FiestaGo! Te hemos enviado un email de confirmación.')
      // Intentar login automático
      await supabase.auth.signInWithPassword({ email, password }).catch(() => {})
      router.push('/mi-cuenta')
    } catch (err: any) {
      toast.error(err.message || 'Error al registrarte')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-cream py-16 px-6">
      <div className="max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink/50 hover:text-coral mb-6 transition-colors">
          ← Volver al inicio
        </Link>

        <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-card">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-coral bg-coral/10 border border-coral/20 px-4 py-1.5 rounded-full mb-4">
              ✨ Hazte socio gratis
            </div>
            <h1 className="font-serif text-3xl font-black text-ink mb-2">Únete a FiestaGo</h1>
            <p className="text-ink/55 text-sm">Descuentos, novedades y el calendario de tus celebraciones — todo en un sitio.</p>
          </div>

          {/* Beneficios */}
          <div className="bg-coral/5 border border-coral/15 rounded-xl p-4 mb-6">
            <ul className="text-xs text-ink/75 space-y-1.5">
              <li>🎁 <span className="font-semibold">Descuentos exclusivos</span> de socios</li>
              <li>📅 <span className="font-semibold">Calendario</span> de tus reservas en un solo sitio</li>
              <li>💌 <span className="font-semibold">Novedades</span> de proveedores que sigues (opcional)</li>
              <li>⚡ <span className="font-semibold">Reservas más rápidas</span>, sin reescribir tus datos</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Nombre completo *</label>
              <input required value={name} onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Email *</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Contraseña *</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Teléfono</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+34..."
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Ciudad</label>
                <select value={city} onChange={e => setCity(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors">
                  <option value="">Elige tu ciudad</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-ink/60 mt-1 cursor-pointer">
              <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)}
                className="mt-0.5 accent-coral"/>
              <span>Quiero recibir descuentos, novedades de proveedores y promociones por email.</span>
            </label>

            <button type="submit" disabled={saving}
              className="bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50 mt-2">
              {saving ? 'Creando tu cuenta...' : 'Crear cuenta gratis'}
            </button>

            <div className="text-center text-xs text-ink/45 mt-1">
              Al continuar aceptas los <Link href="#" className="text-coral hover:underline">Términos</Link> y la <Link href="#" className="text-coral hover:underline">Privacidad</Link>.
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-stone-100 text-center text-sm text-ink/60">
            ¿Ya tienes cuenta? <Link href="/login" className="text-coral font-semibold hover:underline">Inicia sesión</Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-ink/40">
          ¿Eres profesional? <Link href="/registro-proveedor" className="text-coral hover:underline">Regístrate como proveedor</Link>
        </div>
      </div>
    </div>
  )
}
