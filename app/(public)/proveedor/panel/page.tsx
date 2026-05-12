'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { CATEGORIES } from '@/lib/constants'

type Service = {
  id: string
  name: string
  description: string | null
  price: number | null
  price_unit: string
  duration: string | null
  max_guests: number | null
  media_type: 'image' | 'video' | 'none'
  media_url: string | null
  thumbnail_url: string | null
  status: string
  sort_order: number
}

type Booking = {
  id: string
  created_at: string
  client_name: string
  client_email: string
  client_phone: string | null
  event_date: string
  event_type: string
  guests: number | null
  message: string | null
  total_amount: number
  status: string
}

type Provider = {
  id: string
  name: string
  category: string
  city: string
  email: string
  phone: string | null
  website: string | null
  instagram: string | null
  description: string | null
  photo_idx: number
  rating: number
  total_reviews: number
  total_bookings: number
  specialties: string[]
}

const TABS = [
  { id:'dashboard',    icon:'📊', label:'Resumen'        },
  { id:'profile',      icon:'✏️', label:'Mi perfil'      },
  { id:'services',     icon:'💼', label:'Mis servicios'  },
  { id:'availability', icon:'📅', label:'Disponibilidad' },
  { id:'bookings',     icon:'📋', label:'Reservas'       },
  { id:'security',     icon:'🔒', label:'Seguridad'      },
]

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['L','M','X','J','V','S','D']

function getDaysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
function getFirstDay(y: number, m: number) { const d = new Date(y,m,1).getDay(); return d===0?6:d-1 }

export default function ProveedorPanelPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [tab,      setTab]      = useState('dashboard')
  const [provider, setProvider] = useState<Provider | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [userId,   setUserId]   = useState<string | null>(null)
  const [noProviderForEmail, setNoProviderForEmail] = useState<string | null>(null)

  // Availability
  const now = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [availability, setAvailability] = useState<Record<string,boolean>>({})

  // Profile form
  const [profile, setProfile] = useState({
    name:'', phone:'', website:'', instagram:'', description:'', specialties:''
  })

  // Services form
  const [showNewSvc, setShowNewSvc] = useState(false)
  const [editSvc,    setEditSvc]    = useState<Service|null>(null)
  const [availSvc,   setAvailSvc]   = useState<Service|null>(null)
  const [availBlocked, setAvailBlocked] = useState<string[]>([])  // ISO dates YYYY-MM-DD
  const [availMonth, setAvailMonth] = useState<number>(new Date().getMonth())
  const [availYear,  setAvailYear]  = useState<number>(new Date().getFullYear())
  const [newSvc, setNewSvc] = useState<{
    name: string; description: string; price: string; duration: string; maxGuests: string
    mediaFile: File | null; mediaPreview: string | null
  }>({
    name: '', description: '', price: '', duration: 'Todo el día', maxGuests: '',
    mediaFile: null, mediaPreview: null,
  })

  // Security form
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass,    setChangingPass]    = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/proveedor/login'); return }
      setUserId(user.id)
      loadData(user.email!)
    })
  }, [])

  async function loadData(email: string) {
    setLoading(true)
    try {
      // Find provider by email
      const res  = await fetch(`/api/proveedor/profile?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      if (!data.provider) {
        setNoProviderForEmail(email)
        setLoading(false)
        return
      }

      setProvider(data.provider)
      // Cargar servicios desde la nueva tabla provider_services
      try {
        const svcRes = await fetch(`/api/proveedor/services?provider_id=${data.provider.id}`)
        const svcData = await svcRes.json()
        setServices(svcData.services || [])
      } catch { setServices([]) }
      setProfile({
        name:        data.provider.name || '',
        phone:       data.provider.phone || '',
        website:     data.provider.website || '',
        instagram:   data.provider.instagram || '',
        description: data.provider.description || '',
        specialties: (data.provider.specialties || []).join(', '),
      })

      // Load bookings (envía header de auth)
      const bookRes  = await fetch(`/api/proveedor/bookings?id=${data.provider.id}`, {
        headers: { 'x-provider-token': data.provider.id }
      })
      const bookData = await bookRes.json()
      setBookings(bookData.bookings || [])

      // Load availability
      const availRes  = await fetch(`/api/proveedor/availability?id=${data.provider.id}`)
      const availData = await availRes.json()
      const map: Record<string,boolean> = {}
      ;(availData.availability || []).forEach((a: any) => { map[a.date] = a.available })
      setAvailability(map)

    } catch (err) {
      toast.error('Error cargando datos')
    }
    setLoading(false)
  }

  async function saveProfile() {
    if (!provider) return
    setSaving(true)
    try {
      const res = await fetch('/api/proveedor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          id:          provider.id,
          name:        profile.name,
          phone:       profile.phone || null,
          website:     profile.website || null,
          instagram:   profile.instagram || null,
          description: profile.description || null,
          specialties: profile.specialties.split(',').map(s=>s.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Perfil actualizado ✓')
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return }
    if (newPassword.length < 8) { toast.error('Mínimo 8 caracteres'); return }
    setChangingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Contraseña actualizada correctamente ✓')
      setNewPassword(''); setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.message)
    }
    setChangingPass(false)
  }

  async function toggleDay(dateStr: string) {
    if (!provider) return
    const current = availability[dateStr]
    const newVal  = !current
    setAvailability(prev => ({ ...prev, [dateStr]: newVal }))
    try {
      await fetch('/api/proveedor/availability', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ providerId: provider.id, date: dateStr, available: newVal }),
      })
    } catch {
      setAvailability(prev => ({ ...prev, [dateStr]: current }))
      toast.error('Error actualizando disponibilidad')
    }
  }

  async function uploadMedia(file: File): Promise<{ url: string; media_type: 'image' | 'video' } | null> {
    if (!provider) return null
    const fd = new FormData()
    fd.append('file', file)
    fd.append('provider_id', provider.id)
    const res = await fetch('/api/proveedor/services/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Error subiendo archivo'); return null }
    return { url: data.url, media_type: data.media_type }
  }

  async function addService() {
    if (!newSvc.name || !newSvc.price) { toast.error('Nombre y precio obligatorios'); return }
    if (!provider) return
    setSaving(true)
    try {
      let media_type: 'image' | 'video' | 'none' = 'none'
      let media_url: string | null = null
      if (newSvc.mediaFile) {
        const upl = await uploadMedia(newSvc.mediaFile)
        if (upl) { media_url = upl.url; media_type = upl.media_type }
      }

      const res = await fetch('/api/proveedor/services', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          provider_id: provider.id,
          name:        newSvc.name,
          description: newSvc.description || null,
          price:       parseFloat(newSvc.price),
          duration:    newSvc.duration,
          max_guests:  newSvc.maxGuests ? parseInt(newSvc.maxGuests) : null,
          media_type,
          media_url,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setServices(s => [...s, data.service])
      setNewSvc({ name:'', description:'', price:'', duration:'Todo el día', maxGuests:'',
                  mediaFile: null, mediaPreview: null })
      setShowNewSvc(false)
      toast.success('Servicio añadido ✓')
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function updateService() {
    if (!editSvc || !provider) return
    setSaving(true)
    try {
      const res = await fetch('/api/proveedor/services', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          id:           editSvc.id,
          name:         editSvc.name,
          description:  editSvc.description,
          price:        editSvc.price,
          duration:     editSvc.duration,
          max_guests:   editSvc.max_guests,
          status:       editSvc.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setServices(s => s.map(x => x.id === editSvc.id ? data.service : x))
      setEditSvc(null)
      toast.success('Servicio actualizado ✓')
    } catch (err: any) { toast.error(err.message) }
    setSaving(false)
  }

  async function deleteService(id: string) {
    if (!provider || !confirm('¿Eliminar este servicio?')) return
    await fetch(`/api/proveedor/services?id=${id}`, { method:'DELETE' })
    setServices(s => s.filter(x => x.id !== id))
    toast.success('Servicio eliminado')
  }

  // ── DISPONIBILIDAD POR SERVICIO ────────────────────────────────────────
  async function loadAvailability(serviceId: string) {
    if (!provider) return
    const res = await fetch(`/api/proveedor/service-availability?service_id=${serviceId}`, {
      headers: { 'x-provider-token': provider.id }
    })
    const data = await res.json()
    setAvailBlocked((data.blocked || []).map((b: any) => b.blocked_date))
  }

  useEffect(() => {
    if (availSvc) {
      loadAvailability(availSvc.id)
      setAvailMonth(new Date().getMonth())
      setAvailYear(new Date().getFullYear())
    } else {
      setAvailBlocked([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availSvc?.id])

  async function toggleBlockedDay(dateStr: string) {
    if (!availSvc || !provider) return
    // Optimistic update
    const wasBlocked = availBlocked.includes(dateStr)
    setAvailBlocked(prev => wasBlocked ? prev.filter(d => d !== dateStr) : [...prev, dateStr])
    const res = await fetch('/api/proveedor/service-availability', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-provider-token': provider.id },
      body: JSON.stringify({ service_id: availSvc.id, blocked_date: dateStr }),
    })
    if (!res.ok) {
      // revertir si falla
      setAvailBlocked(prev => wasBlocked ? [...prev, dateStr] : prev.filter(d => d !== dateStr))
      toast.error('Error al actualizar disponibilidad')
    }
  }

  async function updateBooking(id: string, status: string) {
    if (!provider) return
    await fetch('/api/proveedor/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json', 'x-provider-token': provider.id },
      body: JSON.stringify({ id, status, providerId: provider.id }),
    })
    setBookings(b => b.map(x => x.id === id ? { ...x, status } : x))
    toast.success(status === 'confirmed' ? 'Reserva confirmada ✓' : 'Reserva cancelada')
  }

  function renderCalendar() {
    const days     = getDaysInMonth(calYear, calMonth)
    const first    = getFirstDay(calYear, calMonth)
    const today    = new Date().toISOString().split('T')[0]
    const cells    = []
    for (let i=0; i<first; i++) cells.push(<div key={`e${i}`}/>)
    for (let d=1; d<=days; d++) {
      const dt    = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const past  = dt < today
      const avail = availability[dt]
      cells.push(
        <button key={dt} onClick={() => !past && toggleDay(dt)} disabled={past}
          className={`aspect-square rounded-xl text-sm font-semibold transition-all border-2
            ${past ? 'opacity-30 cursor-not-allowed bg-stone-100 text-ink/40 border-transparent' :
              avail ? 'bg-green-100 text-green-700 border-green-400 hover:bg-green-200' :
              'bg-stone-100 text-ink/60 border-transparent hover:bg-stone-200'}`}>
          {d}
        </button>
      )
    }
    return cells
  }

  const cat   = CATEGORIES.find(c => c.id === provider?.category)
  const stats = {
    pending:   bookings.filter(b => b.status==='pending').length,
    confirmed: bookings.filter(b => b.status==='confirmed').length,
    revenue:   bookings.filter(b => b.status==='confirmed').reduce((s,b) => s+b.total_amount, 0),
    available: Object.values(availability).filter(Boolean).length,
  }

  if (noProviderForEmail) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🤔</div>
          <h1 className="font-serif text-2xl font-bold text-ink mb-3">No tienes perfil de proveedor</h1>
          <p className="text-ink/60 text-sm mb-6 leading-relaxed">
            La cuenta <strong>{noProviderForEmail}</strong> no tiene un perfil de proveedor asociado en FiestaGo.
          </p>
          <div className="flex flex-col gap-3">
            <a href="/registro-proveedor"
              className="block w-full py-3 rounded-xl bg-coral text-white font-semibold text-sm">
              Registrarme como proveedor
            </a>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/proveedor/login') }}
              className="block w-full py-3 rounded-xl border border-stone-200 text-ink/70 font-semibold text-sm">
              Cerrar sesión y entrar con otro email
            </button>
          </div>
        </div>
      </div>
    )
  }

    if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-ink/40 text-sm">Cargando tu panel...</div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col fixed top-0 left-0 bottom-0">
        <div className="p-5 border-b border-stone-200">
          <a href="/" className="font-serif text-lg font-black text-ink">🎉 FiestaGo</a>
          <div className="text-xs text-ink/50 mt-1">Panel del proveedor</div>
        </div>
        <nav className="p-3 flex-1 overflow-y-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition-colors text-left
                ${tab===t.id ? 'bg-coral/10 text-coral font-bold' : 'text-ink/60 hover:bg-stone-100'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-stone-200">
          <div className="text-xs text-ink/40 mb-0.5">Conectado como</div>
          <div className="text-xs font-semibold text-ink truncate">{provider?.name}</div>
          <div className="text-xs text-ink/40 truncate">{provider?.email}</div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/proveedor/login') }}
            className="text-xs text-coral hover:underline mt-2 block">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 p-8">

        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div>
            <h1 className="font-serif text-2xl font-black text-ink mb-1">
              Hola, {provider?.name} 👋
            </h1>
            <p className="text-ink/50 text-sm mb-8">{cat?.icon} {cat?.label} · 📍 {provider?.city}</p>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label:'Pendientes',    value:stats.pending,   color:'#F59E0B', icon:'⏳' },
                { label:'Confirmadas',   value:stats.confirmed, color:'#10B981', icon:'✅' },
                { label:'Ingresos',      value:`${stats.revenue.toLocaleString()}€`, color:'#3B82F6', icon:'💶' },
                { label:'Días libres',   value:stats.available, color:'#8B5CF6', icon:'📅' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                  <div className="text-2xl mb-3">{s.icon}</div>
                  <div className="font-serif text-2xl font-bold mb-1" style={{color:s.color}}>{s.value}</div>
                  <div className="text-xs text-ink/50">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                <h3 className="font-semibold text-ink mb-4 text-sm">Últimas reservas</h3>
                {bookings.length===0 ? <p className="text-xs text-ink/40">Sin reservas todavía.</p>
                : bookings.slice(0,4).map(b => (
                  <div key={b.id} className="flex justify-between items-center py-2.5 border-b border-stone-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-ink">{b.client_name}</div>
                      <div className="text-xs text-ink/50">{new Date(b.event_date).toLocaleDateString('es-ES')}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      b.status==='confirmed'?'bg-green-100 text-green-700':
                      b.status==='pending'?'bg-amber-100 text-amber-700':'bg-stone-100 text-stone-600'
                    }`}>
                      {b.status==='confirmed'?'Confirmada':b.status==='pending'?'Pendiente':'Cancelada'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                <h3 className="font-semibold text-ink mb-4 text-sm">Mi rendimiento</h3>
                {[
                  ['Valoración',    provider?.rating ? `${provider.rating} ⭐` : 'Sin valoraciones'],
                  ['Reseñas',       `${provider?.total_reviews||0}`],
                  ['Reservas',      `${provider?.total_bookings||0}`],
                  ['Servicios',     `${services.length}`],
                ].map(([k,v]) => (
                  <div key={k} className="flex justify-between text-sm py-2 border-b border-stone-100 last:border-0">
                    <span className="text-ink/50">{k}</span>
                    <span className="font-semibold text-ink">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD DE REFERIDOS */}
            {provider && (
              <div className="mt-6 bg-gradient-to-br from-coral/10 via-amber-50 to-rose-50 border border-coral/30 rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🤝</span>
                  <div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-coral">Bonus de referidos</div>
                    <h3 className="font-serif text-xl font-black text-ink">Trae a un compañero, sube al top</h3>
                  </div>
                </div>
                <p className="text-xs text-ink/65 mb-4 leading-relaxed">
                  Invita a otro profesional. Cuando se registre, los dos apareceréis en los primeros puestos de vuestra categoría sin coste. Cuantos más traigas, más arriba.
                </p>
                <div className="bg-white border border-coral/30 rounded-xl p-3 flex items-center gap-2">
                  <input readOnly value={`https://fiestago.es/registro-proveedor?ref=${provider.id}`}
                    className="flex-1 bg-transparent border-0 outline-none text-xs text-ink font-mono truncate"/>
                  <button onClick={() => {
                    navigator.clipboard.writeText(`https://fiestago.es/registro-proveedor?ref=${provider.id}`)
                    toast.success('Link copiado ✓')
                  }}
                    className="text-xs font-bold bg-coral text-white px-3 py-1.5 rounded-lg hover:bg-coral-dark whitespace-nowrap">
                    Copiar
                  </button>
                </div>
                <div className="text-[10px] text-ink/45 mt-2">
                  Envía este link por WhatsApp, Instagram o email. Cuando alguien se registre vía tu link, lo verás aquí.
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {tab==='profile' && (
          <div className="max-w-lg">
            <h1 className="font-serif text-2xl font-black text-ink mb-6">Mi perfil</h1>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card">
              {[['Nombre del negocio','name','text','Tu nombre'],
                ['Teléfono','phone','tel','+34 600 000 000'],
                ['Sitio web','website','url','https://minegocio.com'],
                ['Instagram','instagram','text','@minegocio'],
              ].map(([lbl,field,type,ph]) => (
                <div key={field} className="mb-4">
                  <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">{lbl}</label>
                  <input type={type} value={(profile as any)[field]} placeholder={ph}
                    onChange={e => setProfile(p => ({...p,[field]:e.target.value}))}
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                </div>
              ))}
              <div className="mb-4">
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Descripción</label>
                <textarea value={profile.description} rows={4}
                  onChange={e => setProfile(p => ({...p,description:e.target.value}))}
                  placeholder="Describe tu negocio..."
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">
                  Especialidades (separadas por comas)
                </label>
                <input value={profile.specialties}
                  onChange={e => setProfile(p => ({...p,specialties:e.target.value}))}
                  placeholder="ej. Bodas íntimas, Vídeo 4K"
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
              <button onClick={saveProfile} disabled={saving}
                className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {/* SERVICES */}
        {tab==='services' && (
          <div className="max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-serif text-2xl font-black text-ink">Mis servicios</h1>
              <button onClick={() => setShowNewSvc(true)}
                className="bg-coral text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
                + Añadir servicio
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
              💡 Cada servicio tiene un <strong>precio fijo</strong>. Los clientes ven exactamente cuánto cuesta antes de reservar.
            </div>

            {showNewSvc && (
              <div className="bg-white border-2 border-coral/30 rounded-2xl p-6 mb-5 shadow-card">
                <h3 className="font-semibold text-ink mb-4">Nuevo servicio</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Nombre *</label>
                    <input value={newSvc.name} onChange={e => setNewSvc(s=>({...s,name:e.target.value}))}
                      placeholder="ej. Reportaje fotográfico completo"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Precio fijo (€) *</label>
                    <input type="number" value={newSvc.price} onChange={e => setNewSvc(s=>({...s,price:e.target.value}))}
                      placeholder="1200"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Duración</label>
                    <select value={newSvc.duration} onChange={e => setNewSvc(s=>({...s,duration:e.target.value}))}
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors">
                      {['1 hora','2 horas','3 horas','4 horas','6 horas','Todo el día','Fin de semana'].map(d=>(
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Máx. invitados</label>
                    <input type="number" value={newSvc.maxGuests} onChange={e => setNewSvc(s=>({...s,maxGuests:e.target.value}))}
                      placeholder="Sin límite"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Descripción</label>
                    <textarea value={newSvc.description} rows={2}
                      onChange={e => setNewSvc(s=>({...s,description:e.target.value}))}
                      placeholder="Qué incluye este servicio..."
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
                  </div>
                </div>
                {/* Upload de foto o vídeo (a ancho completo, ANTES de los botones) */}
                <div className="mb-4 mt-2 p-4 border-2 border-dashed border-coral/30 rounded-xl bg-coral/5">
                  <label className="block text-xs font-bold text-ink/60 uppercase tracking-widest mb-2">
                    📸 Foto o vídeo del servicio (opcional)
                  </label>
                  <p className="text-xs text-ink/50 mb-3">
                    Formatos: JPG, PNG, WEBP (máx. 10MB) · MP4, MOV, WEBM (máx. 50MB)
                  </p>
                  <input type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return
                      const url = URL.createObjectURL(f)
                      setNewSvc(s => ({ ...s, mediaFile: f, mediaPreview: url }))
                    }}
                    className="block w-full text-sm text-ink/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-coral file:text-white hover:file:bg-coral-dark file:cursor-pointer"
                  />
                  {newSvc.mediaPreview && (
                    <div className="mt-3 relative inline-block">
                      {newSvc.mediaFile?.type?.startsWith('video') ? (
                        <video src={newSvc.mediaPreview} controls
                          className="max-w-[280px] max-h-[200px] rounded-lg border border-stone-200" />
                      ) : (
                        <img src={newSvc.mediaPreview} alt="preview"
                          className="max-w-[280px] max-h-[200px] rounded-lg border border-stone-200" />
                      )}
                      <button onClick={() => setNewSvc(s => ({...s, mediaFile: null, mediaPreview: null }))}
                        className="absolute top-1 right-1 px-2 py-1 bg-black/70 text-white text-xs rounded">
                        ✕ Quitar
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={addService} disabled={saving}
                    className="flex-1 bg-coral text-white font-bold py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
                    {saving ? 'Subiendo...' : 'Añadir servicio'}
                  </button>
                  <button onClick={() => setShowNewSvc(false)}
                    className="px-5 border border-stone-200 rounded-xl text-sm text-ink/60">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {services.length===0 && !showNewSvc ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center shadow-card">
                <div className="text-4xl mb-3">💼</div>
                <p className="text-ink/50 text-sm">Añade tus servicios con precios fijos para que los clientes puedan reservarte.</p>
              </div>
            ) : services.map(svc => (
              <div key={svc.id} className="bg-white border border-stone-200 rounded-2xl p-5 mb-4 shadow-card">
                {editSvc?.id===svc.id ? (
                  <div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="col-span-2">
                        <input value={editSvc.name} onChange={e => setEditSvc(s=>s?{...s,name:e.target.value}:null)}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral"/>
                      </div>
                      <input type="number" value={editSvc.price ?? ''}
                        onChange={e => setEditSvc(s=>s?{...s,price:parseFloat(e.target.value) || null}:null)}
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral"/>
                      <select value={editSvc.duration ?? ''}
                        onChange={e => setEditSvc(s=>s?{...s,duration:e.target.value}:null)}
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral">
                        {['1 hora','2 horas','3 horas','4 horas','6 horas','Todo el día','Fin de semana'].map(d=>(
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <div className="col-span-2">
                        <textarea value={editSvc.description ?? ''} rows={2}
                          onChange={e => setEditSvc(s=>s?{...s,description:e.target.value}:null)}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral resize-none"/>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={updateService}
                        className="flex-1 bg-coral text-white font-bold py-2 rounded-xl text-sm">Guardar</button>
                      <button onClick={() => setEditSvc(null)}
                        className="px-4 border border-stone-200 rounded-xl text-sm text-ink/60">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="font-semibold text-ink">{svc.name}</h3>
                        <span className="text-xs text-ink/50 bg-stone-100 px-2 py-0.5 rounded-full">{svc.duration}</span>
                        {svc.max_guests!=null&&<span className="text-xs text-ink/50">max. {svc.max_guests} pax</span>}
                      </div>
                      {svc.description&&<p className="text-xs text-ink/55 mb-2">{svc.description}</p>}
                      <div className="font-serif text-xl font-bold text-coral">{svc.price!=null ? `${svc.price.toLocaleString()}€` : '—'}</div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => setAvailSvc(svc)}
                        className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-ink/60 hover:border-coral hover:text-coral transition-colors">
                        📅 Disponibilidad
                      </button>
                      <button onClick={() => setEditSvc(svc)}
                        className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-ink/60 hover:border-coral hover:text-coral transition-colors">
                        ✏️ Editar
                      </button>
                      <button onClick={() => deleteService(svc.id)}
                        className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AVAILABILITY */}
        {tab==='availability' && (
          <div className="max-w-md">
            <h1 className="font-serif text-2xl font-black text-ink mb-2">Disponibilidad</h1>
            <p className="text-ink/55 text-sm mb-6">
              Marca los días que estás disponible. Los clientes lo ven en tiempo real.
            </p>
            <div className="flex gap-4 mb-5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-green-100 border-2 border-green-400"/>
                <span className="text-ink/60">Disponible</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-stone-100 border-2 border-transparent"/>
                <span className="text-ink/60">No disponible</span>
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card">
              <div className="flex justify-between items-center mb-5">
                <button onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1)}else setCalMonth(m=>m-1) }}
                  className="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center text-ink/60 hover:border-coral hover:text-coral transition-colors">←</button>
                <div className="font-semibold text-ink">{MONTHS[calMonth]} {calYear}</div>
                <button onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1)}else setCalMonth(m=>m+1) }}
                  className="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center text-ink/60 hover:border-coral hover:text-coral transition-colors">→</button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-ink/40 py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">{renderCalendar()}</div>
              <div className="mt-5 pt-4 border-t border-stone-100 flex justify-between text-sm">
                <span className="text-ink/50">Disponibles este mes:</span>
                <span className="font-bold text-green-600">
                  {Object.entries(availability).filter(([date,avail]) => {
                    const d = new Date(date)
                    return avail && d.getMonth()===calMonth && d.getFullYear()===calYear
                  }).length} días
                </span>
              </div>
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              💡 Los cambios se guardan automáticamente y los clientes los ven al instante.
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {tab==='bookings' && (
          <div>
            <h1 className="font-serif text-2xl font-black text-ink mb-6">Mis reservas</h1>
            {bookings.length===0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center shadow-card">
                <div className="text-5xl mb-4">📋</div>
                <h3 className="font-serif text-xl font-bold text-ink mb-2">Sin reservas todavía</h3>
                <p className="text-ink/50 text-sm">Cuando los clientes te reserven aparecerán aquí.</p>
              </div>
            ) : bookings.map(b => (
              <div key={b.id} className="bg-white border border-stone-200 rounded-2xl p-5 mb-4 shadow-card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-ink text-base">{b.client_name}</div>
                    <div className="text-xs text-ink/50 mt-0.5">{b.client_email}{b.client_phone&&` · ${b.client_phone}`}</div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    b.status==='confirmed'?'bg-green-100 text-green-700':
                    b.status==='pending'?'bg-amber-100 text-amber-700':
                    b.status==='cancelled'?'bg-red-100 text-red-500':'bg-stone-100 text-stone-600'
                  }`}>
                    {b.status==='confirmed'?'Confirmada':b.status==='pending'?'Pendiente':b.status==='cancelled'?'Cancelada':'Completada'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div>
                    <div className="text-xs text-ink/40 mb-0.5">Fecha</div>
                    <div className="font-medium">{new Date(b.event_date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink/40 mb-0.5">Invitados</div>
                    <div className="font-medium">{b.guests||'—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink/40 mb-0.5">Importe</div>
                    <div className="font-semibold text-coral">{b.total_amount.toLocaleString()}€</div>
                  </div>
                </div>
                {b.message&&(
                  <div className="bg-stone-50 rounded-xl p-3 text-xs text-ink/60 mb-3 italic">"{b.message}"</div>
                )}
                {b.status==='pending'&&(
                  <div className="flex gap-2">
                    <button onClick={() => updateBooking(b.id,'confirmed')}
                      className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-sm hover:bg-green-600 transition-colors">
                      ✓ Confirmar reserva
                    </button>
                    <button onClick={() => updateBooking(b.id,'cancelled')}
                      className="px-4 border border-red-200 text-red-400 rounded-xl text-sm hover:bg-red-50 transition-colors">
                      ✕ Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SECURITY */}
        {tab==='security' && (
          <div className="max-w-md">
            <h1 className="font-serif text-2xl font-black text-ink mb-6">Seguridad</h1>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card">
              <h3 className="font-semibold text-ink mb-1">Cambiar contraseña</h3>
              <p className="text-xs text-ink/50 mb-5">
                Si no tienes contraseña todavía, puedes establecer una aquí para entrar sin necesitar el enlace mágico.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Nueva contraseña</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Confirmar contraseña</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
              </div>
              <button onClick={changePassword} disabled={changingPass||!newPassword||!confirmPassword}
                className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
                {changingPass ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </div>

            <div className="mt-5 bg-white border border-stone-200 rounded-2xl p-6 shadow-card">
              <h3 className="font-semibold text-ink mb-1">Tu email</h3>
              <p className="text-xs text-ink/50 mb-3">Este es el email con el que accedes a FiestaGo.</p>
              <div className="bg-stone-50 rounded-xl px-4 py-3 text-sm font-mono text-ink/70">
                {provider?.email}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DISPONIBILIDAD POR SERVICIO */}
      {availSvc && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setAvailSvc(null)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink/45 font-bold mb-1">Disponibilidad de</div>
                <h2 className="font-serif text-2xl font-bold text-ink">{availSvc.name}</h2>
              </div>
              <button onClick={() => setAvailSvc(null)} className="text-ink/45 hover:text-ink text-xl">✕</button>
            </div>
            <p className="text-xs text-ink/55 mb-4 leading-relaxed">
              Los clientes pueden reservar cualquier día por defecto. Haz click para marcar los días BLOQUEADOS (vacaciones, ya ocupados, etc).
            </p>

            <div className="flex justify-between items-center mb-3">
              <button onClick={() => {
                const m = availMonth === 0 ? 11 : availMonth - 1
                const y = availMonth === 0 ? availYear - 1 : availYear
                setAvailMonth(m); setAvailYear(y)
              }} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm hover:border-coral">←</button>
              <h3 className="font-serif text-lg font-bold">
                {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][availMonth]} {availYear}
              </h3>
              <button onClick={() => {
                const m = availMonth === 11 ? 0 : availMonth + 1
                const y = availMonth === 11 ? availYear + 1 : availYear
                setAvailMonth(m); setAvailYear(y)
              }} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm hover:border-coral">→</button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {['L','M','X','J','V','S','D'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold tracking-widest uppercase text-ink/40 py-1">{d}</div>
              ))}
              {(() => {
                const daysInMonth = new Date(availYear, availMonth + 1, 0).getDate()
                const firstDay = (() => { const d = new Date(availYear, availMonth, 1).getDay(); return d === 0 ? 6 : d - 1 })()
                const today = new Date()
                today.setHours(0,0,0,0)
                const cells: any[] = Array(firstDay).fill(null)
                for (let i = 1; i <= daysInMonth; i++) cells.push(i)
                return cells.map((day, idx) => {
                  if (day === null) return <div key={`e-${idx}`} />
                  const dateStr = `${availYear}-${String(availMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isPast    = new Date(dateStr) < today
                  const isBlocked = availBlocked.includes(dateStr)
                  return (
                    <button key={dateStr} disabled={isPast}
                      onClick={() => toggleBlockedDay(dateStr)}
                      className={`aspect-square rounded-lg text-sm transition-all ${
                        isPast
                          ? 'text-ink/20 cursor-not-allowed bg-stone-50'
                          : isBlocked
                          ? 'bg-red-500 text-white font-bold hover:bg-red-600'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}>
                      {day}
                    </button>
                  )
                })
              })()}
            </div>

            <div className="flex gap-3 text-[10px] text-ink/55 mt-3">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 inline-block"/> Libre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block"/> Bloqueado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-stone-100 inline-block"/> Pasado</span>
            </div>

            <button onClick={() => setAvailSvc(null)}
              className="w-full mt-5 bg-ink text-white font-bold py-2.5 rounded-xl text-sm hover:bg-ink/85">
              Hecho
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

