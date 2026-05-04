'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { CATEGORIES } from '@/lib/constants'

type Service = {
  id: string
  name: string
  description: string
  price: number
  duration: string
  maxGuests: number | null
}

type Availability = {
  date: string
  available: boolean
  slots?: string[]
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
  services: Service[]
  specialties: string[]
}

const TABS = [
  { id:'dashboard',     icon:'📊', label:'Resumen'       },
  { id:'profile',       icon:'✏️', label:'Mi perfil'     },
  { id:'services',      icon:'💼', label:'Mis servicios' },
  { id:'availability',  icon:'📅', label:'Disponibilidad'},
  { id:'bookings',      icon:'📋', label:'Reservas'      },
]

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['L','M','X','J','V','S','D']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export default function ProveedorPanelPage() {
  const router  = useRouter()
  const [tab,   setTab]   = useState('dashboard')
  const [provider, setProvider] = useState<Provider | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  // Availability state
  const now    = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [availability, setAvailability] = useState<Record<string, boolean>>({})

  // Services state
  const [services,    setServices]    = useState<Service[]>([])
  const [editService, setEditService] = useState<Service | null>(null)
  const [showNewSvc,  setShowNewSvc]  = useState(false)
  const [newSvc,      setNewSvc]      = useState({ name:'', description:'', price:'', duration:'todo el día', maxGuests:'' })

  // Profile state
  const [profile, setProfile] = useState({
    name:'', phone:'', website:'', instagram:'', description:'', specialties:''
  })

  const providerId = typeof window !== 'undefined' ? localStorage.getItem('fg_provider_id') : null
  const token      = typeof window !== 'undefined' ? localStorage.getItem('fg_provider_token') : null

  function authHeaders() {
    return { 'Content-Type':'application/json', 'x-provider-token': token || '' }
  }

  const fetchData = useCallback(async () => {
    if (!providerId || !token) { router.push('/proveedor/login'); return }
    setLoading(true)
    try {
      const [provRes, bookRes, availRes] = await Promise.all([
        fetch(`/api/proveedor/profile?id=${providerId}`, { headers: authHeaders() }),
        fetch(`/api/proveedor/bookings?id=${providerId}`, { headers: authHeaders() }),
        fetch(`/api/proveedor/availability?id=${providerId}`, { headers: authHeaders() }),
      ])
      const provData  = await provRes.json()
      const bookData  = await bookRes.json()
      const availData = await availRes.json()

      if (provData.provider) {
        setProvider(provData.provider)
        setServices(provData.provider.services || [])
        setProfile({
          name:        provData.provider.name || '',
          phone:       provData.provider.phone || '',
          website:     provData.provider.website || '',
          instagram:   provData.provider.instagram || '',
          description: provData.provider.description || '',
          specialties: (provData.provider.specialties || []).join(', '),
        })
      }
      setBookings(bookData.bookings || [])

      // Convert availability array to map
      const availMap: Record<string, boolean> = {}
      ;(availData.availability || []).forEach((a: Availability) => {
        availMap[a.date] = a.available
      })
      setAvailability(availMap)
    } catch (err) {
      toast.error('Error cargando datos')
    }
    setLoading(false)
  }, [providerId, token])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveProfile() {
    if (!providerId) return
    setSaving(true)
    try {
      const res = await fetch('/api/proveedor/profile', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          id: providerId,
          name:        profile.name,
          phone:       profile.phone || null,
          website:     profile.website || null,
          instagram:   profile.instagram || null,
          description: profile.description || null,
          specialties: profile.specialties.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Perfil actualizado')
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function toggleDay(dateStr: string) {
    const current = availability[dateStr]
    const newVal  = !current
    setAvailability(prev => ({ ...prev, [dateStr]: newVal }))

    try {
      await fetch('/api/proveedor/availability', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ providerId, date: dateStr, available: newVal }),
      })
    } catch {
      setAvailability(prev => ({ ...prev, [dateStr]: current }))
      toast.error('Error actualizando disponibilidad')
    }
  }

  async function saveService(svc: Service) {
    try {
      const res = await fetch('/api/proveedor/services', {
        method: svc.id ? 'PATCH' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...svc, providerId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success(svc.id ? 'Servicio actualizado' : 'Servicio añadido')
      setEditService(null)
      setShowNewSvc(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function addService() {
    if (!newSvc.name || !newSvc.price) { toast.error('Nombre y precio son obligatorios'); return }
    await saveService({
      id:          '',
      name:        newSvc.name,
      description: newSvc.description,
      price:       parseFloat(newSvc.price),
      duration:    newSvc.duration,
      maxGuests:   newSvc.maxGuests ? parseInt(newSvc.maxGuests) : null,
    })
    setNewSvc({ name:'', description:'', price:'', duration:'todo el día', maxGuests:'' })
  }

  async function deleteService(id: string) {
    if (!confirm('¿Eliminar este servicio?')) return
    await fetch(`/api/proveedor/services?id=${id}&providerId=${providerId}`, {
      method: 'DELETE', headers: authHeaders(),
    })
    fetchData()
  }

  // Calendar render
  function renderCalendar() {
    const daysInMonth  = getDaysInMonth(calYear, calMonth)
    const firstDay     = getFirstDayOfMonth(calYear, calMonth)
    const today        = new Date().toISOString().split('T')[0]
    const cells        = []

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`}/>)

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const isPast  = dateStr < today
      const isAvail = availability[dateStr]

      cells.push(
        <button key={dateStr}
          onClick={() => !isPast && toggleDay(dateStr)}
          disabled={isPast}
          className={`
            aspect-square rounded-xl text-sm font-semibold transition-all
            ${isPast ? 'opacity-30 cursor-not-allowed bg-stone-100 text-ink/40' :
              isAvail ? 'bg-green-100 text-green-700 border-2 border-green-400 hover:bg-green-200' :
              'bg-stone-100 text-ink/60 hover:bg-stone-200 border-2 border-transparent'}
          `}>
          {d}
        </button>
      )
    }
    return cells
  }

  const cat   = CATEGORIES.find(c => c.id === provider?.category)
  const stats = {
    pending:   bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    revenue:   bookings.filter(b => b.status === 'confirmed').reduce((s,b) => s + b.total_amount, 0),
    available: Object.values(availability).filter(Boolean).length,
  }

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-ink/40 text-sm">Cargando tu panel...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col fixed top:0 left-0 bottom-0 top-0">
        <div className="p-5 border-b border-stone-200">
          <div className="font-serif text-lg font-black text-ink">🎉 FiestaGo</div>
          <div className="text-xs text-ink/50 mt-1">Panel del proveedor</div>
        </div>
        <nav className="p-3 flex-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition-colors text-left
                ${tab===t.id ? 'bg-coral/10 text-coral font-bold' : 'text-ink/60 hover:bg-stone-100'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-stone-200">
          <div className="text-xs text-ink/40 mb-1">Conectado como</div>
          <div className="text-xs font-semibold text-ink truncate">{provider?.name}</div>
          <button onClick={() => { localStorage.clear(); router.push('/proveedor/login') }}
            className="text-xs text-coral hover:underline mt-2">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 p-8">

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div>
            <h1 className="font-serif text-2xl font-black text-ink mb-2">
              Hola, {provider?.name} 👋
            </h1>
            <p className="text-ink/50 text-sm mb-8">{cat?.icon} {cat?.label} · {provider?.city}</p>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label:'Reservas pendientes', value:stats.pending,   color:'#F59E0B', icon:'⏳' },
                { label:'Confirmadas',          value:stats.confirmed, color:'#10B981', icon:'✅' },
                { label:'Ingresos totales',     value:`${stats.revenue.toLocaleString()}€`, color:'#3B82F6', icon:'💶' },
                { label:'Días disponibles',     value:stats.available, color:'#8B5CF6', icon:'📅' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                  <div className="text-2xl mb-3">{s.icon}</div>
                  <div className="font-serif text-2xl font-bold mb-1" style={{ color:s.color }}>{s.value}</div>
                  <div className="text-xs text-ink/50">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                <h3 className="font-semibold text-ink mb-4 text-sm">Reservas recientes</h3>
                {bookings.length === 0 ? (
                  <p className="text-xs text-ink/40">Aún no tienes reservas.</p>
                ) : bookings.slice(0,4).map(b => (
                  <div key={b.id} className="flex justify-between items-center py-2.5 border-b border-stone-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-ink">{b.client_name}</div>
                      <div className="text-xs text-ink/50">{new Date(b.event_date).toLocaleDateString('es-ES')}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      b.status==='confirmed' ? 'bg-green-100 text-green-700' :
                      b.status==='pending'   ? 'bg-amber-100 text-amber-700' :
                      'bg-stone-100 text-stone-600'
                    }`}>
                      {b.status==='confirmed'?'Confirmada':b.status==='pending'?'Pendiente':'Cancelada'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                <h3 className="font-semibold text-ink mb-4 text-sm">Mi rendimiento</h3>
                <div className="flex flex-col gap-3">
                  {[
                    ['Valoración media', provider?.rating ? `${provider.rating} ⭐` : 'Sin valoraciones'],
                    ['Total reseñas',    `${provider?.total_reviews || 0}`],
                    ['Total reservas',   `${provider?.total_bookings || 0}`],
                    ['Servicios activos',`${services.length}`],
                  ].map(([k,v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-ink/50">{k}</span>
                      <span className="font-semibold text-ink">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div className="max-w-lg">
            <h1 className="font-serif text-2xl font-black text-ink mb-6">Mi perfil</h1>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card">
              {[
                ['Nombre del negocio','name','text','Tu nombre de negocio'],
                ['Teléfono','phone','tel','+34 600 000 000'],
                ['Sitio web','website','url','https://minegocio.com'],
                ['Instagram','instagram','text','@minegocio'],
              ].map(([label,field,type,ph]) => (
                <div key={field} className="mb-4">
                  <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type={type} value={(profile as any)[field]} placeholder={ph}
                    onChange={e => setProfile(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                </div>
              ))}
              <div className="mb-4">
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">Descripción</label>
                <textarea value={profile.description} rows={4}
                  onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe tu negocio y qué te hace especial..."
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1.5">
                  Especialidades (separadas por comas)
                </label>
                <input value={profile.specialties}
                  onChange={e => setProfile(p => ({ ...p, specialties: e.target.value }))}
                  placeholder="ej. Bodas íntimas, Fotografía documental, Vídeo 4K"
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
        {tab === 'services' && (
          <div className="max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-serif text-2xl font-black text-ink">Mis servicios</h1>
              <button onClick={() => setShowNewSvc(true)}
                className="bg-coral text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
                + Añadir servicio
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
              💡 Cada servicio tiene un <strong>precio fijo</strong>. Los clientes verán exactamente cuánto cuesta antes de reservar.
            </div>

            {/* New service form */}
            {showNewSvc && (
              <div className="bg-white border border-coral/30 rounded-2xl p-6 mb-5 shadow-card">
                <h3 className="font-semibold text-ink mb-4">Nuevo servicio</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Nombre del servicio *</label>
                    <input value={newSvc.name} onChange={e => setNewSvc(s => ({ ...s, name: e.target.value }))}
                      placeholder="ej. Reportaje fotográfico completo"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Precio fijo (€) *</label>
                    <input type="number" value={newSvc.price} onChange={e => setNewSvc(s => ({ ...s, price: e.target.value }))}
                      placeholder="ej. 1200"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Duración</label>
                    <select value={newSvc.duration} onChange={e => setNewSvc(s => ({ ...s, duration: e.target.value }))}
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors">
                      {['1 hora','2 horas','3 horas','4 horas','6 horas','Todo el día','Fin de semana'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Máx. invitados</label>
                    <input type="number" value={newSvc.maxGuests} onChange={e => setNewSvc(s => ({ ...s, maxGuests: e.target.value }))}
                      placeholder="Sin límite"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Descripción</label>
                    <textarea value={newSvc.description} rows={2}
                      onChange={e => setNewSvc(s => ({ ...s, description: e.target.value }))}
                      placeholder="Qué incluye este servicio..."
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={addService}
                    className="flex-1 bg-coral text-white font-bold py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
                    Añadir servicio
                  </button>
                  <button onClick={() => setShowNewSvc(false)}
                    className="px-5 border border-stone-200 rounded-xl text-sm text-ink/60 hover:border-coral transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Services list */}
            {services.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center shadow-card">
                <div className="text-4xl mb-3">💼</div>
                <p className="text-ink/50 text-sm">Aún no tienes servicios. Añade tu primer servicio para que los clientes puedan reservarte.</p>
              </div>
            ) : services.map(svc => (
              <div key={svc.id} className="bg-white border border-stone-200 rounded-2xl p-5 mb-4 shadow-card">
                {editService?.id === svc.id ? (
                  <div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="col-span-2">
                        <input value={editService.name} onChange={e => setEditService(s => s ? {...s, name: e.target.value} : null)}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral"/>
                      </div>
                      <input type="number" value={editService.price} onChange={e => setEditService(s => s ? {...s, price: parseFloat(e.target.value)} : null)}
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral"/>
                      <select value={editService.duration} onChange={e => setEditService(s => s ? {...s, duration: e.target.value} : null)}
                        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral">
                        {['1 hora','2 horas','3 horas','4 horas','6 horas','Todo el día','Fin de semana'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <div className="col-span-2">
                        <textarea value={editService.description} rows={2}
                          onChange={e => setEditService(s => s ? {...s, description: e.target.value} : null)}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral resize-none"/>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveService(editService)}
                        className="flex-1 bg-coral text-white font-bold py-2 rounded-xl text-sm">Guardar</button>
                      <button onClick={() => setEditService(null)}
                        className="px-4 border border-stone-200 rounded-xl text-sm text-ink/60">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-ink">{svc.name}</h3>
                        <span className="text-xs text-ink/50 bg-stone-100 px-2 py-0.5 rounded-full">{svc.duration}</span>
                        {svc.maxGuests && <span className="text-xs text-ink/50">max. {svc.maxGuests} pax</span>}
                      </div>
                      {svc.description && <p className="text-xs text-ink/55 mb-2">{svc.description}</p>}
                      <div className="font-serif text-xl font-bold text-coral">{svc.price.toLocaleString()}€</div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => setEditService(svc)}
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
        {tab === 'availability' && (
          <div className="max-w-lg">
            <h1 className="font-serif text-2xl font-black text-ink mb-2">Disponibilidad</h1>
            <p className="text-ink/55 text-sm mb-6">
              Haz clic en cada día para marcarlo como disponible o no disponible. Los clientes verán esto en tiempo real.
            </p>

            {/* Legend */}
            <div className="flex gap-4 mb-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-green-100 border-2 border-green-400"/>
                <span className="text-ink/60">Disponible</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-stone-100 border-2 border-transparent"/>
                <span className="text-ink/60">No disponible</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-stone-100 opacity-30"/>
                <span className="text-ink/60">Fecha pasada</span>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card">
              {/* Calendar nav */}
              <div className="flex justify-between items-center mb-5">
                <button onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1) }
                  else setCalMonth(m => m-1)
                }} className="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center text-ink/60 hover:border-coral hover:text-coral transition-colors">
                  ←
                </button>
                <div className="font-semibold text-ink">{MONTHS[calMonth]} {calYear}</div>
                <button onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1) }
                  else setCalMonth(m => m+1)
                }} className="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center text-ink/60 hover:border-coral hover:text-coral transition-colors">
                  →
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-xs font-bold text-ink/40 py-1">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {renderCalendar()}
              </div>

              {/* Summary */}
              <div className="mt-5 pt-4 border-t border-stone-100 flex justify-between text-sm">
                <span className="text-ink/50">Días disponibles este mes:</span>
                <span className="font-bold text-green-600">
                  {Object.entries(availability).filter(([date, avail]) => {
                    const d = new Date(date)
                    return avail && d.getMonth() === calMonth && d.getFullYear() === calYear
                  }).length} días
                </span>
              </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
              💡 Los cambios se guardan automáticamente. Los clientes ven tu disponibilidad en tiempo real cuando visitan tu perfil.
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div>
            <h1 className="font-serif text-2xl font-black text-ink mb-6">Mis reservas</h1>
            {bookings.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center shadow-card">
                <div className="text-5xl mb-4">📋</div>
                <h3 className="font-serif text-xl font-bold text-ink mb-2">Sin reservas todavía</h3>
                <p className="text-ink/50 text-sm">Cuando los clientes te reserven aparecerán aquí.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {bookings.map(b => (
                  <div key={b.id} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-ink text-base">{b.client_name}</div>
                        <div className="text-xs text-ink/50 mt-0.5">{b.client_email} {b.client_phone && `· ${b.client_phone}`}</div>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        b.status==='confirmed' ? 'bg-green-100 text-green-700' :
                        b.status==='pending'   ? 'bg-amber-100 text-amber-700' :
                        b.status==='cancelled' ? 'bg-red-100 text-red-500' :
                        'bg-stone-100 text-stone-600'
                      }`}>
                        {b.status==='confirmed'?'Confirmada':b.status==='pending'?'Pendiente':b.status==='cancelled'?'Cancelada':'Completada'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                      <div>
                        <div className="text-xs text-ink/40 mb-0.5">Fecha del evento</div>
                        <div className="font-medium">{new Date(b.event_date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
                      </div>
                      <div>
                        <div className="text-xs text-ink/40 mb-0.5">Invitados</div>
                        <div className="font-medium">{b.guests || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-ink/40 mb-0.5">Importe</div>
                        <div className="font-semibold text-coral">{b.total_amount.toLocaleString()}€</div>
                      </div>
                    </div>
                    {b.message && (
                      <div className="bg-stone-50 rounded-xl p-3 text-xs text-ink/60 mb-3">
                        "{b.message}"
                      </div>
                    )}
                    {b.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          await fetch('/api/proveedor/bookings', {
                            method:'PATCH', headers: authHeaders(),
                            body: JSON.stringify({ id:b.id, status:'confirmed', providerId })
                          })
                          fetchData()
                          toast.success('Reserva confirmada')
                        }} className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-sm hover:bg-green-600 transition-colors">
                          ✓ Confirmar reserva
                        </button>
                        <button onClick={async () => {
                          await fetch('/api/proveedor/bookings', {
                            method:'PATCH', headers: authHeaders(),
                            body: JSON.stringify({ id:b.id, status:'cancelled', providerId })
                          })
                          fetchData()
                          toast.success('Reserva cancelada')
                        }} className="px-4 border border-red-200 text-red-400 rounded-xl text-sm hover:bg-red-50 transition-colors">
                          ✕ Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

