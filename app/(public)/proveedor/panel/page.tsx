'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { CATEGORIES, CANCELLATION_POLICIES } from '@/lib/constants'
import { precioCliente, formatEuro } from '@/lib/pricing'
import QuotesTab from './QuotesTab'
import QuickRepliesTab from './QuickRepliesTab'
import GmbTab from './GmbTab'
import WelcomeModal from './WelcomeModal'

type ServiceMedia = {
  id: string
  url: string
  thumbnail_url: string | null
  media_type: 'image' | 'video'
  sort_order: number
  is_primary: boolean
}

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
  cancellation_policy: 'flexible' | 'moderate' | 'strict' | null
  addons?: Array<{ id: string; label: string; description?: string | null; price: number }>
  media?: ServiceMedia[]
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
  total_amount: number      // lo que pagó el cliente (base + 8%)
  provider_earns: number    // lo que cobra el proveedor (base, sin fee)
  status: string
}

type Provider = {
  id: string
  slug: string | null
  name: string
  category: string
  city: string
  email: string
  phone: string | null
  website: string | null
  instagram: string | null
  description: string | null
  photo_idx: number
  photo_url: string | null
  verified: boolean
  verification_status: 'none' | 'pending' | 'approved' | 'rejected' | null
  verification_doc_type: string | null
  verification_notes: string | null
  rating: number
  total_reviews: number
  total_bookings: number
  specialties: string[]
}

const TABS = [
  { id:'dashboard',    icon:'📊', label:'Resumen'        },
  { id:'stats',        icon:'📈', label:'Estadísticas'   },
  { id:'profile',      icon:'✏️', label:'Mi perfil'      },
  { id:'services',     icon:'💼', label:'Mis servicios'  },
  { id:'quotes',       icon:'🧾', label:'Presupuestos IA' },
  { id:'wa-replies',   icon:'💬', label:'Plantillas WhatsApp' },
  { id:'gmb',          icon:'📍', label:'Google Business' },
  { id:'availability', icon:'📅', label:'Disponibilidad' },
  { id:'bookings',     icon:'📋', label:'Reservas'       },
  { id:'earnings',     icon:'💶', label:'Cobros'         },
  { id:'messages',     icon:'💬', label:'Mensajes'       },
  { id:'embed',        icon:'🔗', label:'Widget para mi web' },
  { id:'coupons',      icon:'🎟️', label:'Cupones'        },
  { id:'reviews',      icon:'⭐', label:'Reseñas'        },
  { id:'security',     icon:'🔒', label:'Seguridad'      },
]

type Review = {
  id: string
  author: string
  rating: number
  text: string
  event_type: string | null
  event_date: string
  date: string
  reply: string | null
  reply_date: string | null
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['L','M','X','J','V','S','D']

function getDaysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
function getFirstDay(y: number, m: number) { const d = new Date(y,m,1).getDay(); return d===0?6:d-1 }

function ProveedorPanelInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const adminAsId    = searchParams?.get('as') || null
  const [isAdminView, setIsAdminView] = useState(false)
  // Wrapper que añade x-admin-password si estamos en modo admin. Sin esto
  // los endpoints autenticados rechazarían al admin impersonando.
  const apiFetch = (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (typeof window !== 'undefined' && adminAsId) {
      const pwd = localStorage.getItem('fg_admin_pass')
      if (pwd) headers.set('x-admin-password', pwd)
    }
    return fetch(url, { ...init, headers })
  }
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
    name:'', phone:'', website:'', instagram:'', description:'', specialties:'',
    photo_url:'' as string,
    auto_reply_message:'' as string,
  })
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Services form
  const [showNewSvc, setShowNewSvc] = useState(false)
  const [editSvc,    setEditSvc]    = useState<Service|null>(null)
  const [availSvc,   setAvailSvc]   = useState<Service|null>(null)
  const [availBlocked, setAvailBlocked] = useState<string[]>([])  // ISO dates YYYY-MM-DD
  const [availMonth, setAvailMonth] = useState<number>(new Date().getMonth())
  const [availYear,  setAvailYear]  = useState<number>(new Date().getFullYear())
  const [newSvc, setNewSvc] = useState<{
    name: string; description: string; price: string; duration: string; maxGuests: string
    cancellation_policy: 'flexible' | 'moderate' | 'strict'
    mediaFile: File | null; mediaPreview: string | null
  }>({
    name: '', description: '', price: '', duration: 'Todo el día', maxGuests: '',
    cancellation_policy: 'moderate',
    mediaFile: null, mediaPreview: null,
  })

  // Security form
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass,    setChangingPass]    = useState(false)

  // Reviews
  const [reviews,        setReviews]        = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [replyDraft,     setReplyDraft]     = useState<Record<string, string>>({})
  const [replyingId,     setReplyingId]     = useState<string | null>(null)
  const [replyTemplates, setReplyTemplates] = useState<Array<{ label: string; body: string }>>([])
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)

  // Galería de servicios (subida múltiple + drag&drop reorder)
  const [uploadingMediaFor, setUploadingMediaFor] = useState<string | null>(null)
  const [draggedMedia, setDraggedMedia] = useState<{ serviceId: string; mediaId: string } | null>(null)

  // Verificación
  const [verifDocType, setVerifDocType] = useState<'dni' | 'cif' | 'rc'>('dni')
  const [verifUploading, setVerifUploading] = useState(false)

  // Cupones
  const [coupons, setCoupons] = useState<any[]>([])
  const [couponsLoading, setCouponsLoading] = useState(false)
  const [newCoupon, setNewCoupon] = useState({ code:'', description:'', percent_off:'10', max_uses:'', expires_at:'' })

  // Cobros
  const [earnings,        setEarnings]        = useState<any | null>(null)
  const [earningsYear,    setEarningsYear]    = useState<number>(new Date().getFullYear())
  const [earningsLoading, setEarningsLoading] = useState(false)

  // Mensajería
  const [threads,       setThreads]       = useState<any[]>([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [openThread,    setOpenThread]    = useState<any | null>(null)
  const [threadMessages, setThreadMessages] = useState<any[]>([])
  const [msgInput,      setMsgInput]      = useState('')
  const [sendingMsg,    setSendingMsg]    = useState(false)

  // Stats
  const [statsData, setStatsData] = useState<{
    total_events: number
    profile_views: number
    service_views: number
    booking_started: number
    booking_completed: number
    contact_clicked: number
    conversion_rate: number
    series: { date: string; views: number }[]
    top_services: { id: string; name: string; price: number | null; views: number }[]
  } | null>(null)
  const [statsRange,    setStatsRange]    = useState<7 | 30 | 90>(30)
  const [statsLoading,  setStatsLoading]  = useState(false)

  async function loadStats(providerId: string, days: number) {
    setStatsLoading(true)
    try {
      const res = await apiFetch(`/api/proveedor/stats?provider_id=${providerId}&days=${days}`, {
        headers: { 'x-provider-token': providerId }
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStatsData(data)
    } catch (err: any) {
      toast.error('Error cargando estadísticas')
    }
    setStatsLoading(false)
  }

  // Cargar stats cuando se entra en la pestaña o cambia el rango
  useEffect(() => {
    if (tab === 'stats' && provider?.id) loadStats(provider.id, statsRange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statsRange, provider?.id])

  async function loadReviews(providerId: string) {
    setReviewsLoading(true)
    try {
      const res = await apiFetch(`/api/proveedor/reviews?provider_id=${providerId}`)
      const data = await res.json()
      setReviews(data.reviews || [])
    } catch {
      setReviews([])
    }
    setReviewsLoading(false)
  }

  useEffect(() => {
    if (tab === 'reviews' && provider?.id) loadReviews(provider.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, provider?.id])

  async function loadEarnings(providerId: string, year: number) {
    setEarningsLoading(true)
    try {
      const res = await apiFetch(`/api/proveedor/earnings?provider_id=${providerId}&year=${year}`)
      const data = await res.json()
      setEarnings(data)
    } catch { setEarnings(null) }
    setEarningsLoading(false)
  }

  useEffect(() => {
    if (tab === 'earnings' && provider?.id) loadEarnings(provider.id, earningsYear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, earningsYear, provider?.id])

  function exportEarningsCSV() {
    if (!earnings?.transactions?.length) return
    const head = ['fecha_evento','fecha_cobro','cliente','servicio','tipo_evento','ciudad','estado','importe_bruto','comision','neto']
    const rows = earnings.transactions.map((t: any) => [
      t.event_date || '', t.paid_at || '', t.client_name || '',
      t.service_name || '', t.event_type || '', t.city || '', t.status,
      t.total, t.commission, t.net,
    ])
    const csv = [head, ...rows].map(r => r.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `fiestago-cobros-${earnings.year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadThreads(providerId: string) {
    setThreadsLoading(true)
    try {
      const res = await apiFetch(`/api/messages/threads?role=provider&token=${providerId}`)
      const data = await res.json()
      setThreads(data.threads || [])
    } catch {
      setThreads([])
    }
    setThreadsLoading(false)
  }

  useEffect(() => {
    if (tab === 'messages' && provider?.id) loadThreads(provider.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, provider?.id])

  async function openChat(thread: any) {
    if (!provider) return
    setOpenThread(thread)
    setThreadMessages([])
    try {
      const res = await apiFetch(`/api/messages?booking_id=${thread.booking_id}&role=provider&token=${provider.id}`)
      const data = await res.json()
      setThreadMessages(data.messages || [])
      setThreads(prev => prev.map(t => t.booking_id === thread.booking_id ? { ...t, unread_count: 0 } : t))
    } catch {
      setThreadMessages([])
    }
  }

  // Suscripción Realtime: cuando hay un hilo abierto, escucha inserts de
  // messages para esa reserva y los añade en vivo (evita refrescar).
  useEffect(() => {
    if (!openThread?.booking_id) return
    const ch = supabase.channel(`thread-${openThread.booking_id}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${openThread.booking_id}` },
          (payload: any) => {
            setThreadMessages(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
          })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [openThread?.booking_id, supabase])

  async function sendChatMessage() {
    if (!provider || !openThread) return
    const text = msgInput.trim()
    if (!text) return
    setSendingMsg(true)
    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: openThread.booking_id,
          role: 'provider',
          token: provider.id,
          body: text,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setThreadMessages(prev => [...prev, data.message])
      setMsgInput('')
    } catch (err: any) {
      toast.error(err.message || 'No se pudo enviar')
    }
    setSendingMsg(false)
  }

  async function uploadVerificationDoc(file: File) {
    if (!provider) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Archivo demasiado grande (máx 8MB)')
      return
    }
    setVerifUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('provider_id', provider.id)
      fd.append('doc_type', verifDocType)
      const res = await apiFetch('/api/proveedor/verification', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setProvider(p => p ? { ...p, verification_status: 'pending', verification_doc_type: verifDocType } as Provider : p)
      toast.success('Documento enviado. Te avisaremos por email cuando lo revisemos.')
    } catch (err: any) {
      toast.error(err.message || 'Error al subir el documento')
    }
    setVerifUploading(false)
  }

  async function loadCoupons(providerId: string) {
    setCouponsLoading(true)
    try {
      const res = await apiFetch(`/api/proveedor/coupons?provider_id=${providerId}`)
      const data = await res.json()
      setCoupons(data.coupons || [])
    } catch { setCoupons([]) }
    setCouponsLoading(false)
  }

  useEffect(() => {
    if (tab === 'coupons' && provider?.id) loadCoupons(provider.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, provider?.id])

  async function createCoupon() {
    if (!provider) return
    const code = newCoupon.code.trim()
    const percent = parseInt(newCoupon.percent_off)
    if (!code) { toast.error('Pon un código'); return }
    if (!percent || percent < 1 || percent > 100) { toast.error('Porcentaje entre 1 y 100'); return }
    try {
      const res = await apiFetch('/api/proveedor/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: provider.id,
          code,
          description: newCoupon.description || null,
          percent_off: percent,
          max_uses:    newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null,
          expires_at:  newCoupon.expires_at || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setCoupons(prev => [data.coupon, ...prev])
      setNewCoupon({ code:'', description:'', percent_off:'10', max_uses:'', expires_at:'' })
      toast.success('Cupón creado ✓')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    }
  }

  async function toggleCoupon(id: string, active: boolean) {
    if (!provider) return
    try {
      const res = await apiFetch('/api/proveedor/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, provider_id: provider.id, active }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, active } : c))
    } catch (err: any) { toast.error(err.message || 'Error') }
  }

  async function deleteCoupon(id: string) {
    if (!provider) return
    if (!confirm('¿Borrar este cupón? Las reservas que ya lo usaron se mantienen.')) return
    try {
      await apiFetch(`/api/proveedor/coupons?id=${id}&provider_id=${provider.id}`, { method: 'DELETE' })
      setCoupons(prev => prev.filter(c => c.id !== id))
    } catch (err: any) { toast.error(err.message || 'Error') }
  }

  async function uploadServiceMedia(serviceId: string, file: File) {
    if (!provider) return
    setUploadingMediaFor(serviceId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('service_id', serviceId)
      fd.append('provider_id', provider.id)
      const res = await apiFetch('/api/proveedor/services/media', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setServices(prev => prev.map(s => s.id === serviceId
        ? { ...s, media: [...(s.media || []), data.media] }
        : s))
      toast.success('Archivo subido ✓')
    } catch (err: any) {
      toast.error(err.message || 'Error al subir')
    }
    setUploadingMediaFor(null)
  }

  async function deleteServiceMedia(serviceId: string, mediaId: string) {
    if (!provider) return
    if (!confirm('¿Eliminar este archivo de la galería?')) return
    try {
      const url = `/api/proveedor/services/media?id=${mediaId}&service_id=${serviceId}&provider_id=${provider.id}`
      const res = await apiFetch(url, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setServices(prev => prev.map(s => {
        if (s.id !== serviceId) return s
        const remaining = (s.media || []).filter(m => m.id !== mediaId)
        const wasPrimary = (s.media || []).find(m => m.id === mediaId)?.is_primary
        if (wasPrimary && remaining.length) remaining[0] = { ...remaining[0], is_primary: true }
        return { ...s, media: remaining }
      }))
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar')
    }
  }

  async function reorderMedia(serviceId: string, fromMediaId: string, toMediaId: string) {
    if (!provider || fromMediaId === toMediaId) return
    const svc = services.find(s => s.id === serviceId)
    if (!svc?.media?.length) return

    const ids = svc.media.map(m => m.id)
    const fromIdx = ids.indexOf(fromMediaId)
    const toIdx   = ids.indexOf(toMediaId)
    if (fromIdx < 0 || toIdx < 0) return

    // Mover en local
    const next = [...svc.media]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, media: next } : s))

    // Persistir
    try {
      const res = await apiFetch('/api/proveedor/services/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          provider_id: provider.id,
          ordered_ids: next.map(m => m.id),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
    } catch (err: any) {
      toast.error(err.message || 'Error al reordenar')
    }
  }

  async function setPrimaryMedia(serviceId: string, mediaId: string) {
    if (!provider) return
    try {
      const res = await apiFetch('/api/proveedor/services/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mediaId, service_id: serviceId, provider_id: provider.id, is_primary: true }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setServices(prev => prev.map(s => s.id !== serviceId ? s : ({
        ...s,
        media: (s.media || []).map(m => ({ ...m, is_primary: m.id === mediaId })),
      })))
      toast.success('Portada actualizada ✓')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    }
  }

  async function saveReplyTemplates(next: Array<{ label: string; body: string }>) {
    if (!provider) return
    try {
      const res = await apiFetch('/api/proveedor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, reply_templates: next }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setReplyTemplates(next)
      toast.success('Plantillas guardadas ✓')
    } catch (err: any) {
      toast.error(err.message || 'No se pudo guardar')
    }
  }

  function applyTemplate(reviewId: string, body: string, authorName: string) {
    const filled = body.replace(/\{nombre\}/gi, authorName || '')
    setReplyDraft(d => ({ ...d, [reviewId]: filled }))
  }

  async function submitReply(bookingId: string) {
    if (!provider) return
    const text = (replyDraft[bookingId] || '').trim()
    setReplyingId(bookingId)
    try {
      const res = await apiFetch('/api/proveedor/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id:  bookingId,
          provider_id: provider.id,
          reply:       text || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setReviews(prev => prev.map(r => r.id === bookingId
        ? { ...r, reply: text || null, reply_date: text ? new Date().toISOString() : null }
        : r))
      setReplyDraft(d => ({ ...d, [bookingId]: '' }))
      toast.success(text ? 'Respuesta publicada ✓' : 'Respuesta eliminada')
    } catch (err: any) {
      toast.error(err.message || 'No se pudo guardar la respuesta')
    }
    setReplyingId(null)
  }

  useEffect(() => {
    // Modo admin: el admin abre el panel de cualquier proveedor con ?as=<id>
    // si tiene la contraseña admin en localStorage.
    if (adminAsId && typeof window !== 'undefined' && localStorage.getItem('fg_admin_pass')) {
      setIsAdminView(true)
      loadData(null, adminAsId)
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/proveedor/login'); return }
      setUserId(user.id)
      loadData(user.email!, null)
    })
  }, [])

  async function loadData(email: string | null, providerIdOverride: string | null) {
    setLoading(true)
    try {
      // Find provider by id (admin) o por email (proveedor logueado)
      const url = providerIdOverride
        ? `/api/proveedor/profile?id=${providerIdOverride}`
        : `/api/proveedor/profile?email=${encodeURIComponent(email!)}`
      const res  = await apiFetch(url)
      const data = await res.json()
      if (!data.provider) {
        setNoProviderForEmail(email || providerIdOverride)
        setLoading(false)
        return
      }

      setProvider(data.provider)
      // Cargar servicios desde la nueva tabla provider_services
      try {
        const svcRes = await apiFetch(`/api/proveedor/services?provider_id=${data.provider.id}`)
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
        photo_url:   data.provider.photo_url || '',
        auto_reply_message: data.provider.auto_reply_message || '',
      })
      setReplyTemplates(Array.isArray(data.provider.reply_templates) ? data.provider.reply_templates : [])

      // Load bookings (envía header de auth)
      const bookRes  = await apiFetch(`/api/proveedor/bookings?id=${data.provider.id}`, {
        headers: { 'x-provider-token': data.provider.id }
      })
      const bookData = await bookRes.json()
      setBookings(bookData.bookings || [])

      // Load availability
      const availRes  = await apiFetch(`/api/proveedor/availability?id=${data.provider.id}`)
      const availData = await availRes.json()
      const map: Record<string,boolean> = {}
      ;(availData.availability || []).forEach((a: any) => { map[a.date] = a.available })
      setAvailability(map)

    } catch (err) {
      toast.error('Error cargando datos')
    }
    setLoading(false)
  }

  async function uploadProfilePhoto(file: File) {
    if (!provider) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagen demasiado grande (máx 10MB)')
      return
    }
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('provider_id', provider.id)
      const res = await apiFetch('/api/proveedor/profile/upload-photo', { method:'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error HTTP ${res.status}`)
      setProfile(p => ({ ...p, photo_url: data.url }))
      setProvider(p => p ? { ...p, photo_url: data.url } as Provider : p)
      toast.success('Foto actualizada ✓')
    } catch (err: any) {
      toast.error(err.message || 'Error al subir la foto')
    }
    setUploadingPhoto(false)
  }

  async function saveProfile() {
    if (!provider) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/proveedor/profile', {
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
          auto_reply_message: profile.auto_reply_message.trim() || null,
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
      await apiFetch('/api/proveedor/availability', {
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
    const res = await apiFetch('/api/proveedor/services/upload', { method: 'POST', body: fd })
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

      const res = await apiFetch('/api/proveedor/services', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          provider_id: provider.id,
          name:        newSvc.name,
          description: newSvc.description || null,
          price:       parseFloat(newSvc.price),
          duration:    newSvc.duration,
          max_guests:  newSvc.maxGuests ? parseInt(newSvc.maxGuests) : null,
          cancellation_policy: newSvc.cancellation_policy,
          media_type,
          media_url,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setServices(s => [...s, data.service])
      setNewSvc({ name:'', description:'', price:'', duration:'Todo el día', maxGuests:'',
                  cancellation_policy: 'moderate',
                  mediaFile: null, mediaPreview: null })
      setShowNewSvc(false)
      toast.success('Servicio añadido ✓ · Marca ahora los días que NO estés disponible')
      // Abrir automáticamente el calendario de disponibilidad para el servicio recién creado
      setAvailSvc(data.service)
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function updateService() {
    if (!editSvc || !provider) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/proveedor/services', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          id:           editSvc.id,
          name:         editSvc.name,
          description:  editSvc.description,
          price:        editSvc.price,
          duration:     editSvc.duration,
          max_guests:   editSvc.max_guests,
          cancellation_policy: editSvc.cancellation_policy,
          addons:       editSvc.addons || [],
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
    await apiFetch(`/api/proveedor/services?id=${id}`, { method:'DELETE' })
    setServices(s => s.filter(x => x.id !== id))
    toast.success('Servicio eliminado')
  }

  // ── DISPONIBILIDAD POR SERVICIO ────────────────────────────────────────
  async function loadAvailability(serviceId: string) {
    if (!provider) return
    const res = await apiFetch(`/api/proveedor/service-availability?service_id=${serviceId}`, {
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
    const res = await apiFetch('/api/proveedor/service-availability', {
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
    await apiFetch('/api/proveedor/bookings', {
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
    // Ingresos del proveedor = lo que él cobra (sin la Garantía de Éxito que paga el cliente).
    revenue:   bookings.filter(b => b.status==='confirmed').reduce((s,b) => s + (b.provider_earns ?? b.total_amount / 1.08), 0),
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
      {!isAdminView && provider?.id && (provider as any)?.status === 'approved' && (
        <WelcomeModal
          providerId={provider.id}
          providerName={provider.name}
          onGoTab={setTab}
        />
      )}
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col fixed top-0 left-0 bottom-0">
        <div className="p-5 border-b border-stone-200">
          <a href="/" aria-label="FiestaGo — inicio"><img src="/logo.svg" alt="FiestaGo" className="h-12 w-auto" /></a>
          <div className="text-xs text-ink/50 mt-1">Panel del proveedor</div>
        </div>
        <nav className="p-3 flex-1 overflow-y-auto">
          {TABS.filter(t => !(isAdminView && t.id === 'security')).map(t => (
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

        {/* Banner modo admin */}
        {isAdminView && (
          <div className="mb-6 -mt-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm text-amber-900">
              <span className="font-bold">🔓 Modo administrador</span>
              <span className="text-amber-800/80"> · Estás viendo el panel de <strong>{provider?.name}</strong> como admin. Los cambios que hagas afectarán al proveedor real.</span>
            </div>
            <a href="/admin" className="text-xs font-bold bg-amber-900 text-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-950 transition-colors whitespace-nowrap">
              ← Volver al admin
            </a>
          </div>
        )}

        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div>
            <h1 className="font-serif text-2xl font-black text-ink mb-1">
              Hola, {provider?.name} 👋
            </h1>
            <p className="text-ink/50 text-sm mb-8">{cat?.icon} {cat?.label} · 📍 {provider?.city}</p>

            <OnboardingChecklist provider={provider} services={services} onGoTab={setTab} />

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

        {/* STATS · Estadísticas de visitas y conversiones */}
        {tab==='stats' && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h1 className="font-serif text-2xl font-black text-ink">Estadísticas</h1>
              <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
                {([7, 30, 90] as const).map(d => (
                  <button key={d} onClick={() => setStatsRange(d)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                      statsRange === d ? 'bg-white text-coral shadow-sm' : 'text-ink/55 hover:text-ink'
                    }`}>
                    {d} días
                  </button>
                ))}
              </div>
            </div>
            <p className="text-ink/55 text-sm mb-6">
              Cuántas personas han visto tu perfil y servicios, y cuántas acabaron reservando.
            </p>

            {statsLoading && !statsData ? (
              <div className="text-ink/40 text-sm">Cargando estadísticas...</div>
            ) : !statsData || statsData.total_events === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-card">
                <div className="text-5xl mb-3">📈</div>
                <h3 className="font-serif text-lg font-bold text-ink mb-2">Aún no hay datos</h3>
                <p className="text-ink/50 text-sm max-w-md mx-auto">
                  Cuando los usuarios visiten tu perfil empezarás a ver aquí cuántas vistas, clicks en servicios, formularios iniciados y reservas completadas tienes.
                </p>
              </div>
            ) : (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'Vistas perfil',       value: statsData.profile_views,     icon: '👁️',  color: '#3B82F6' },
                    { label: 'Vistas servicios',    value: statsData.service_views,     icon: '💼',  color: '#8B5CF6' },
                    { label: 'Inicios reserva',     value: statsData.booking_started,   icon: '✍️',  color: '#F59E0B' },
                    { label: 'Reservas hechas',     value: statsData.booking_completed, icon: '✅',  color: '#10B981' },
                    { label: 'Clicks contacto',     value: statsData.contact_clicked,   icon: '📞',  color: '#E8553E' },
                  ].map(s => (
                    <div key={s.label} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-card">
                      <div className="text-xl mb-2">{s.icon}</div>
                      <div className="font-serif text-2xl font-bold mb-0.5" style={{color: s.color}}>{s.value}</div>
                      <div className="text-[11px] text-ink/55">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Conversion rate */}
                <div className="bg-gradient-to-br from-coral/10 via-amber-50 to-rose-50 border border-coral/30 rounded-2xl p-5 mb-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-coral">Tasa de conversión</div>
                      <div className="font-serif text-3xl font-black text-ink mt-1">
                        {statsData.conversion_rate}%
                      </div>
                      <p className="text-xs text-ink/60 mt-1">
                        De cada 100 personas que visitan tu perfil, <strong>{Math.round(statsData.conversion_rate)}</strong> acaban reservando.
                      </p>
                    </div>
                    <div className="text-4xl opacity-30">🎯</div>
                  </div>
                </div>

                {/* Daily chart */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card mb-6">
                  <h3 className="font-semibold text-ink mb-4 text-sm">Vistas por día (últimos {statsRange} días)</h3>
                  {(() => {
                    const max = Math.max(1, ...statsData.series.map(p => p.views))
                    return (
                      <div className="flex items-end gap-[2px] h-32">
                        {statsData.series.map(p => {
                          const h = (p.views / max) * 100
                          return (
                            <div key={p.date} className="flex-1 flex flex-col justify-end group relative"
                                 title={`${p.date}: ${p.views} vista${p.views === 1 ? '' : 's'}`}>
                              <div
                                className="w-full bg-coral/70 hover:bg-coral rounded-t transition-colors"
                                style={{ height: `${h}%`, minHeight: p.views ? '3px' : '0px' }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  <div className="flex justify-between text-[10px] text-ink/40 mt-2">
                    <span>{statsData.series[0]?.date}</span>
                    <span>{statsData.series[statsData.series.length - 1]?.date}</span>
                  </div>
                </div>

                {/* Top services */}
                {statsData.top_services.length > 0 && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                    <h3 className="font-semibold text-ink mb-4 text-sm">Servicios más vistos</h3>
                    <div className="space-y-2">
                      {statsData.top_services.map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-xs font-bold text-ink/40 w-5">#{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-ink truncate">{s.name}</div>
                              {s.price != null && (
                                <div className="text-xs text-ink/50" title={`Cliente paga ${formatEuro(precioCliente(s.price))} (incluye 8% Garantía)`}>{formatEuro(s.price)}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <div className="w-24 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-coral h-full"
                                   style={{ width: `${(s.views / statsData.top_services[0].views) * 100}%` }}/>
                            </div>
                            <span className="text-xs font-bold text-ink w-8 text-right">{s.views}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PROFILE */}
        {tab==='profile' && (
          <div className="max-w-lg">
            <h1 className="font-serif text-2xl font-black text-ink mb-6">Mi perfil</h1>

            {/* Foto de cabecera */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card mb-5">
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-3">Foto de cabecera</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 flex-shrink-0">
                  {profile.photo_url ? (
                    <img src={profile.photo_url} alt="Foto del proveedor" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-ink/25">📷</div>
                  )}
                </div>
                <div className="flex-1">
                  <label className={`inline-block ${uploadingPhoto ? 'opacity-50 pointer-events-none' : 'cursor-pointer'} bg-ink text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-ink/85 transition-colors`}>
                    {uploadingPhoto ? 'Subiendo...' : (profile.photo_url ? 'Cambiar foto' : 'Subir foto')}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) uploadProfilePhoto(f)
                        e.target.value = ''
                      }} />
                  </label>
                  <p className="text-[11px] text-ink/45 mt-2 leading-relaxed">
                    Es la imagen que aparecerá en tu ficha y en los listados públicos. JPG, PNG o WEBP. Máximo 10MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Verificación */}
            <div className={`border-2 rounded-2xl p-5 mb-5 shadow-card ${
              provider?.verified
                ? 'bg-emerald-50 border-emerald-200'
                : provider?.verification_status === 'pending'
                  ? 'bg-amber-50 border-amber-200'
                  : provider?.verification_status === 'rejected'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-white border-stone-200'
            }`}>
              <div className="flex items-start gap-3">
                <div className="text-3xl">
                  {provider?.verified ? '🛡️' :
                   provider?.verification_status === 'pending' ? '⏳' :
                   provider?.verification_status === 'rejected' ? '❌' : '📄'}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: provider?.verified ? '#059669' : provider?.verification_status === 'rejected' ? '#dc2626' : '#92400e' }}>
                    Verificación
                  </div>
                  {provider?.verified ? (
                    <>
                      <div className="font-semibold text-ink">Cuenta verificada</div>
                      <p className="text-xs text-ink/65 mt-0.5">El sello "Verificado" aparece en tu ficha pública. Los clientes confían más en proveedores verificados.</p>
                    </>
                  ) : provider?.verification_status === 'pending' ? (
                    <>
                      <div className="font-semibold text-ink">En revisión</div>
                      <p className="text-xs text-ink/65 mt-0.5">Tu documento está siendo revisado por nuestro equipo. Te avisaremos en menos de 48h.</p>
                    </>
                  ) : provider?.verification_status === 'rejected' ? (
                    <>
                      <div className="font-semibold text-ink">Documento rechazado</div>
                      {provider?.verification_notes && (
                        <p className="text-xs text-red-700 mt-1 italic">Motivo: {provider.verification_notes}</p>
                      )}
                      <p className="text-xs text-ink/65 mt-1">Puedes volver a subir un documento corrigiendo el motivo indicado.</p>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-ink">Consigue el sello "Verificado"</div>
                      <p className="text-xs text-ink/65 mt-0.5">Sube tu DNI, CIF o seguro de RC. Los proveedores verificados convierten hasta 2× más.</p>
                    </>
                  )}

                  {(!provider?.verified && provider?.verification_status !== 'pending') && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <select value={verifDocType}
                        onChange={e => setVerifDocType(e.target.value as any)}
                        disabled={verifUploading}
                        className="border border-stone-200 bg-white rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-coral">
                        <option value="dni">DNI / NIE</option>
                        <option value="cif">CIF / autónomo</option>
                        <option value="rc">Seguro de RC</option>
                      </select>
                      <label className={`inline-flex items-center justify-center bg-ink text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer hover:bg-ink/85 transition-colors ${verifUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {verifUploading ? 'Subiendo...' : '📤 Subir documento'}
                        <input type="file" accept="image/*,application/pdf" className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) uploadVerificationDoc(f)
                            e.target.value = ''
                          }} />
                      </label>
                    </div>
                  )}
                  <p className="text-[10px] text-ink/40 mt-2 leading-relaxed">
                    🔒 El documento se guarda en un bucket privado, solo lo ve el equipo de FiestaGo y se borra automáticamente tras la revisión.
                  </p>
                </div>
              </div>
            </div>

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
              <div className="mb-5 pt-4 border-t border-stone-200">
                <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">
                  Auto-respuesta al cliente
                </label>
                <p className="text-[11px] text-ink/45 mb-2 leading-relaxed">
                  Email que recibirá el cliente nada más reservar. Reduce la ansiedad de la espera y mejora tu tasa de aceptación. Déjalo vacío para no enviar nada.
                </p>
                <textarea value={profile.auto_reply_message} rows={4} maxLength={1000}
                  onChange={e => setProfile(p => ({...p, auto_reply_message: e.target.value}))}
                  placeholder="¡Hola! Gracias por confiar en nosotros. Te respondo en menos de 24h con la confirmación. Si tienes alguna duda urgente, escríbeme por aquí."
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
                <div className="text-[10px] text-ink/40 text-right mt-1">{profile.auto_reply_message.length}/1000</div>
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
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Precio fijo (€) — el que tú cobras *</label>
                    <input type="number" value={newSvc.price} onChange={e => setNewSvc(s=>({...s,price:e.target.value}))}
                      placeholder="1200"
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                    {newSvc.price && parseFloat(newSvc.price) > 0 && (
                      <div className="text-[11px] text-ink/55 mt-1 leading-tight">
                        Tú cobras <strong>{formatEuro(parseFloat(newSvc.price))}</strong> · cliente paga <strong>{formatEuro(precioCliente(parseFloat(newSvc.price)))}</strong> (8% Garantía de Éxito)
                      </div>
                    )}
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
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Política de cancelación</label>
                    <select value={newSvc.cancellation_policy}
                      onChange={e => setNewSvc(s=>({...s, cancellation_policy: e.target.value as any}))}
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors">
                      {(Object.entries(CANCELLATION_POLICIES) as Array<[string, any]>).map(([key, p]) => (
                        <option key={key} value={key}>{p.icon} {p.label} — {p.short}</option>
                      ))}
                    </select>
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
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-ink/45 uppercase tracking-widest mb-1">Política de cancelación</label>
                        <select value={editSvc.cancellation_policy || 'moderate'}
                          onChange={e => setEditSvc(s=>s?{...s, cancellation_policy: e.target.value as any}:null)}
                          className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-coral">
                          {(Object.entries(CANCELLATION_POLICIES) as Array<[string, any]>).map(([key, p]) => (
                            <option key={key} value={key}>{p.icon} {p.label} — {p.short}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-ink/45 uppercase tracking-widest mb-2">
                          Extras opcionales ({(editSvc.addons || []).length}/10)
                        </label>
                        <p className="text-[11px] text-ink/45 mb-2">
                          El cliente verá estos extras al reservar y podrá añadirlos sumando al precio base.
                        </p>
                        {(editSvc.addons || []).map((a, idx) => (
                          <div key={a.id} className="flex gap-2 mb-2 items-start">
                            <input value={a.label} placeholder="Nombre (ej. Álbum 30x30)"
                              onChange={e => setEditSvc(s => s ? {
                                ...s,
                                addons: (s.addons || []).map((x, i) => i === idx ? { ...x, label: e.target.value } : x)
                              } : null)}
                              className="flex-1 border border-stone-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-coral"/>
                            <input type="number" value={a.price} placeholder="0"
                              onChange={e => setEditSvc(s => s ? {
                                ...s,
                                addons: (s.addons || []).map((x, i) => i === idx ? { ...x, price: parseFloat(e.target.value) || 0 } : x)
                              } : null)}
                              className="w-20 border border-stone-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-coral"/>
                            <span className="text-xs text-ink/45 pt-2">€</span>
                            <button onClick={() => setEditSvc(s => s ? {
                              ...s,
                              addons: (s.addons || []).filter((_, i) => i !== idx)
                            } : null)}
                              className="text-red-400 hover:text-red-600 text-sm px-1.5">🗑️</button>
                          </div>
                        ))}
                        {(editSvc.addons || []).length < 10 && (
                          <button onClick={() => setEditSvc(s => s ? {
                            ...s,
                            addons: [...(s.addons || []), { id: 'addon_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), label: '', price: 0 }]
                          } : null)}
                            className="text-xs font-bold text-coral hover:text-coral-dark border border-dashed border-stone-200 hover:border-coral rounded-lg w-full py-1.5 transition-colors">
                            + Añadir extra
                          </button>
                        )}
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
                  <>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1.5">
                          <h3 className="font-semibold text-ink">{svc.name}</h3>
                          <span className="text-xs text-ink/50 bg-stone-100 px-2 py-0.5 rounded-full">{svc.duration}</span>
                          {svc.max_guests!=null&&<span className="text-xs text-ink/50">max. {svc.max_guests} pax</span>}
                          {svc.cancellation_policy && CANCELLATION_POLICIES[svc.cancellation_policy] && (
                            <span className="text-xs text-ink/55" title={CANCELLATION_POLICIES[svc.cancellation_policy].short}>
                              {CANCELLATION_POLICIES[svc.cancellation_policy].icon} Cancelación {CANCELLATION_POLICIES[svc.cancellation_policy].label.toLowerCase()}
                            </span>
                          )}
                        </div>
                        {svc.description&&<p className="text-xs text-ink/55 mb-2">{svc.description}</p>}
                        {svc.price != null ? (
                          <div>
                            <div className="font-serif text-xl font-bold text-coral">{formatEuro(svc.price)}</div>
                            <div className="text-[11px] text-ink/55 leading-tight">Tú cobras esto · cliente paga {formatEuro(precioCliente(svc.price))} (8% Garantía)</div>
                          </div>
                        ) : (
                          <div className="font-serif text-xl font-bold text-coral">—</div>
                        )}
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

                    {/* Galería */}
                    <div className="mt-4 pt-4 border-t border-stone-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-ink/45 uppercase tracking-widest">
                          Galería ({(svc.media || []).length}/10)
                        </span>
                        <span className="text-[10px] text-ink/40">
                          Arrastra para reordenar · ★ marca la portada
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {(svc.media || []).map(m => {
                          const isDragged = draggedMedia?.serviceId === svc.id && draggedMedia?.mediaId === m.id
                          return (
                          <div key={m.id}
                            draggable
                            onDragStart={e => {
                              setDraggedMedia({ serviceId: svc.id, mediaId: m.id })
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragOver={e => {
                              if (draggedMedia?.serviceId === svc.id) e.preventDefault()
                            }}
                            onDrop={e => {
                              e.preventDefault()
                              if (draggedMedia?.serviceId === svc.id && draggedMedia.mediaId !== m.id) {
                                reorderMedia(svc.id, draggedMedia.mediaId, m.id)
                              }
                              setDraggedMedia(null)
                            }}
                            onDragEnd={() => setDraggedMedia(null)}
                            className={`relative group flex-shrink-0 cursor-move transition-opacity ${isDragged ? 'opacity-30' : ''}`}>
                            <div className="w-24 h-24 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                              {m.media_type === 'video' ? (
                                <video src={m.url} muted loop className="w-full h-full object-cover" />
                              ) : (
                                <img src={m.url} alt="" className="w-full h-full object-cover pointer-events-none" />
                              )}
                            </div>
                            {m.is_primary && (
                              <span className="absolute top-1 left-1 text-[9px] font-bold uppercase tracking-widest bg-coral text-white px-1.5 py-0.5 rounded">
                                Portada
                              </span>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                              {!m.is_primary && (
                                <button onClick={() => setPrimaryMedia(svc.id, m.id)}
                                  title="Marcar como portada"
                                  className="text-xs bg-white/95 text-ink rounded-md px-2 py-1 font-bold hover:bg-white">
                                  ★
                                </button>
                              )}
                              <button onClick={() => deleteServiceMedia(svc.id, m.id)}
                                title="Eliminar"
                                className="text-xs bg-red-500/95 text-white rounded-md px-2 py-1 font-bold hover:bg-red-600">
                                ✕
                              </button>
                            </div>
                          </div>
                          )
                        })}
                        {(svc.media || []).length < 10 && (
                          <label className={`w-24 h-24 flex-shrink-0 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${uploadingMediaFor === svc.id ? 'border-coral bg-coral/5' : 'border-stone-200 hover:border-coral hover:bg-coral/5'}`}>
                            {uploadingMediaFor === svc.id ? (
                              <span className="text-xs text-coral">Subiendo...</span>
                            ) : (
                              <>
                                <span className="text-2xl text-ink/30">+</span>
                                <span className="text-[10px] text-ink/45">Añadir</span>
                              </>
                            )}
                            <input type="file" accept="image/*,video/*" className="hidden"
                              disabled={uploadingMediaFor === svc.id}
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) uploadServiceMedia(svc.id, f)
                                e.target.value = ''
                              }} />
                          </label>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AVAILABILITY */}
        {tab==='quotes' && provider?.id && (
          <div className="max-w-4xl">
            <QuotesTab providerId={provider.id} />
          </div>
        )}

        {tab==='wa-replies' && provider?.id && (
          <div className="max-w-4xl">
            <QuickRepliesTab providerId={provider.id} />
          </div>
        )}

        {tab==='gmb' && provider?.id && (
          <div className="max-w-4xl">
            <GmbTab providerId={provider.id} />
          </div>
        )}

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
            <GoogleCalendarBlock providerId={provider?.id || ''} />
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
                    <div className="text-xs text-ink/40 mb-0.5">Tú cobras</div>
                    <div className="font-semibold text-coral" title={`El cliente pagó ${formatEuro(b.total_amount)} (incluye 8% Garantía)`}>{formatEuro(b.provider_earns || b.total_amount / 1.08)}</div>
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

        {/* EARNINGS */}
        {tab==='earnings' && (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
              <h1 className="font-serif text-2xl font-black text-ink">Cobros y facturación</h1>
              <div className="flex items-center gap-2">
                <select value={earningsYear}
                  onChange={e => setEarningsYear(parseInt(e.target.value))}
                  className="border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral">
                  {(earnings?.years || [earningsYear]).map((y: number) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button onClick={exportEarningsCSV}
                  disabled={!earnings?.transactions?.length}
                  className="bg-ink text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-ink/85 transition-colors disabled:opacity-40">
                  ⬇ Export CSV
                </button>
              </div>
            </div>

            {earningsLoading ? (
              <div className="text-center text-ink/40 py-12">Cargando cobros...</div>
            ) : !earnings || earnings.totals.count === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">💶</div>
                <p className="text-ink/55 text-sm">
                  Aún no hay cobros en {earningsYear}. Cuando confirmes una reserva, su importe aparecerá aquí.
                </p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-coral/5 border-2 border-coral/30 rounded-2xl p-5">
                    <div className="text-xs text-coral uppercase tracking-widest mb-2 font-bold">Cobras tú</div>
                    <div className="font-serif text-3xl font-bold text-coral">{earnings.totals.net.toLocaleString()}€</div>
                    <div className="text-xs text-ink/55 mt-1">100% del precio de tus servicios</div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                    <div className="text-xs text-ink/50 uppercase tracking-widest mb-2">Cliente pagó</div>
                    <div className="font-serif text-3xl font-bold text-ink">{earnings.totals.gross.toLocaleString()}€</div>
                    <div className="text-xs text-ink/45 mt-1">{earnings.totals.count} reserva{earnings.totals.count!==1?'s':''}</div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
                    <div className="text-xs text-ink/50 uppercase tracking-widest mb-2">Comisión FiestaGo</div>
                    <div className="font-serif text-3xl font-bold text-amber-600">{earnings.totals.commission.toLocaleString()}€</div>
                    <div className="text-xs text-ink/45 mt-1">
                      La paga el cliente (no tú)
                    </div>
                  </div>
                </div>

                {/* Mensual */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card mb-6">
                  <h3 className="font-semibold text-ink text-sm mb-4">Mes a mes</h3>
                  <div className="grid grid-cols-12 gap-1 items-end" style={{ minHeight: 120 }}>
                    {earnings.monthly.map((m: any) => {
                      const max = Math.max(1, ...earnings.monthly.map((x: any) => x.net))
                      const h = max > 0 ? Math.round((m.net / max) * 100) : 0
                      return (
                        <div key={m.month} className="flex flex-col items-center gap-1">
                          <div className="text-[9px] font-bold text-ink/55">{m.net > 0 ? `${m.net.toLocaleString()}€` : ''}</div>
                          <div className="w-full bg-stone-100 rounded-t-md overflow-hidden flex items-end" style={{ height: 90 }}>
                            <div className="w-full bg-coral rounded-t-md transition-all" style={{ height: `${h}%`, minHeight: m.net > 0 ? 2 : 0 }}/>
                          </div>
                          <div className="text-[10px] text-ink/50 capitalize">{m.label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Transacciones */}
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-card">
                  <div className="px-5 py-4 border-b border-stone-200">
                    <h3 className="font-semibold text-ink text-sm">Transacciones ({earnings.transactions.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-left">
                          {['Fecha evento','Cliente','Servicio','Cliente pagó','Comisión','Cobras tú','Estado'].map(h => (
                            <th key={h} className="px-4 py-2 text-[10px] font-bold text-ink/45 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {earnings.transactions.map((t: any) => {
                          const d = t.event_date ? new Date(t.event_date).toLocaleDateString('es-ES', { day:'2-digit', month:'short' }) : '—'
                          return (
                            <tr key={t.id} className="border-b border-stone-100 last:border-0">
                              <td className="px-4 py-3 text-ink/65 text-xs whitespace-nowrap">{d}</td>
                              <td className="px-4 py-3 text-ink font-medium">{t.client_name}</td>
                              <td className="px-4 py-3 text-ink/65 text-xs">{t.service_name || '—'}</td>
                              <td className="px-4 py-3 text-ink font-medium tabular-nums">{t.total.toLocaleString()}€</td>
                              <td className="px-4 py-3 text-amber-700 tabular-nums">
                                {t.is_free ? <span className="text-xs text-emerald-600">Sin coste (1ª)</span> : `${t.commission.toLocaleString()}€`}
                              </td>
                              <td className="px-4 py-3 text-coral font-bold tabular-nums">{t.net.toLocaleString()}€</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                  t.status === 'completed'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}>{t.status}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-[11px] text-ink/45 mt-4 leading-relaxed">
                  Los importes mostrados son los que figuran en cada reserva. El cobro real depende del calendario de pagos de FiestaGo (te lo notificaremos cuando se transfiera). Las reservas canceladas o disputadas no aparecen.
                </p>
              </>
            )}
          </div>
        )}

        {/* EMBED WIDGET */}
        {tab==='embed' && (
          <EmbedTab provider={provider} />
        )}

        {/* MESSAGES */}
        {tab==='messages' && (
          <div className="max-w-4xl">
            <h1 className="font-serif text-2xl font-black text-ink mb-2">Mensajes</h1>
            <p className="text-ink/55 text-sm mb-6">
              Conversaciones con clientes de tus reservas confirmadas. El cliente solo te puede escribir aquí tras aceptar su reserva.
            </p>

            {threadsLoading ? (
              <div className="text-center text-ink/40 py-12">Cargando conversaciones...</div>
            ) : threads.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-ink/55 text-sm">Aún no tienes conversaciones. Cuando aceptes una reserva, el chat con ese cliente aparecerá aquí.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-[320px_1fr] gap-4 bg-white border border-stone-200 rounded-2xl overflow-hidden" style={{ minHeight: 540 }}>
                {/* Lista de hilos */}
                <div className="border-r border-stone-200 overflow-y-auto" style={{ maxHeight: 600 }}>
                  {threads.map(t => {
                    const isOpen = openThread?.booking_id === t.booking_id
                    const last   = t.last_message
                    const dateF  = last?.created_at
                      ? new Date(last.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
                      : ''
                    return (
                      <button key={t.booking_id} onClick={() => openChat(t)}
                        className={`w-full text-left px-4 py-3 border-b border-stone-100 flex items-start gap-3 transition-colors ${isOpen ? 'bg-coral/5' : 'hover:bg-stone-50'}`}>
                        <div className="w-10 h-10 rounded-full bg-coral/10 text-coral flex items-center justify-center font-bold text-sm shrink-0">
                          {(t.client_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-sm font-semibold text-ink truncate">{t.client_name}</div>
                            <div className="text-[10px] text-ink/40 whitespace-nowrap">{dateF}</div>
                          </div>
                          <div className="text-xs text-ink/55 truncate">
                            {last ? (
                              <>{last.sender_role === 'provider' ? 'Tú: ' : ''}{last.body}</>
                            ) : (
                              <span className="italic text-ink/40">Sin mensajes — empieza la conversación</span>
                            )}
                          </div>
                        </div>
                        {t.unread_count > 0 && (
                          <span className="bg-coral text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {t.unread_count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Conversación */}
                {openThread ? (
                  <div className="flex flex-col" style={{ maxHeight: 600 }}>
                    <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-ink">{openThread.client_name}</div>
                        <div className="text-[11px] text-ink/45">
                          {openThread.client_email} · evento {new Date(openThread.event_date).toLocaleDateString('es-ES')}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        {openThread.status}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4 bg-stone-50/50 space-y-2">
                      {threadMessages.length === 0 && (
                        <div className="text-center text-ink/40 text-sm py-10">
                          Aún no hay mensajes. Sé el primero en escribir.
                        </div>
                      )}
                      {threadMessages.map(m => {
                        const mine = m.sender_role === 'provider'
                        const time = new Date(m.created_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
                        return (
                          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-snug ${mine ? 'bg-coral text-white' : 'bg-white border border-stone-200 text-ink'}`}>
                              <div className="whitespace-pre-wrap">{m.body}</div>
                              <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-ink/40'} text-right`}>{time}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="border-t border-stone-200 p-3 flex gap-2">
                      <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                        placeholder="Escribe un mensaje..."
                        maxLength={2000}
                        className="flex-1 border border-stone-200 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                      <button onClick={sendChatMessage} disabled={sendingMsg || !msgInput.trim()}
                        className="bg-coral text-white font-bold text-sm px-5 py-2 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-50">
                        {sendingMsg ? '...' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-ink/40 text-sm p-10">
                    Elige una conversación para empezar a chatear.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* COUPONS */}
        {tab==='coupons' && (
          <div className="max-w-3xl">
            <h1 className="font-serif text-2xl font-black text-ink mb-2">Cupones</h1>
            <p className="text-ink/55 text-sm mb-6 leading-relaxed">
              Crea códigos de descuento para tus clientes (ej. <code className="bg-stone-100 px-1.5 py-0.5 rounded text-coral">PROMO20</code>). El cliente lo introduce al reservar y se le aplica el porcentaje al total. La comisión de FiestaGo se calcula sobre el importe ya descontado.
            </p>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card mb-6">
              <div className="text-[10px] font-bold text-ink/45 uppercase tracking-widest mb-3">Nuevo cupón</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input value={newCoupon.code} onChange={e => setNewCoupon(c => ({...c, code: e.target.value.toUpperCase()}))}
                  placeholder="Código (ej. AMIGO20)" maxLength={32}
                  className="border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono uppercase outline-none focus:border-coral"/>
                <div className="flex items-center gap-1">
                  <input type="number" value={newCoupon.percent_off}
                    onChange={e => setNewCoupon(c => ({...c, percent_off: e.target.value}))}
                    min={1} max={100}
                    className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-coral"/>
                  <span className="text-sm text-ink/50">% off</span>
                </div>
                <input value={newCoupon.description}
                  onChange={e => setNewCoupon(c => ({...c, description: e.target.value}))}
                  placeholder="Descripción (opcional, solo tú la ves)"
                  className="col-span-2 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-coral"/>
                <input type="number" value={newCoupon.max_uses}
                  onChange={e => setNewCoupon(c => ({...c, max_uses: e.target.value}))}
                  placeholder="Máx. usos (vacío = sin límite)"
                  className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-coral"/>
                <input type="date" value={newCoupon.expires_at}
                  onChange={e => setNewCoupon(c => ({...c, expires_at: e.target.value}))}
                  className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-coral"/>
              </div>
              <button onClick={createCoupon}
                className="w-full bg-coral text-white font-bold py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
                + Crear cupón
              </button>
            </div>

            {couponsLoading ? (
              <div className="text-center text-ink/40 py-8">Cargando...</div>
            ) : coupons.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
                <div className="text-3xl mb-2">🎟️</div>
                <p className="text-ink/55 text-sm">Aún no tienes cupones.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {coupons.map(c => {
                  const expired = c.expires_at && new Date(c.expires_at) < new Date()
                  const exhausted = c.max_uses != null && c.used_count >= c.max_uses
                  return (
                    <div key={c.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4">
                      <div className="font-mono font-bold text-lg text-coral">{c.code}</div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-ink">{c.percent_off}% descuento</div>
                        <div className="text-xs text-ink/55 mt-0.5">
                          {c.description && <span>{c.description} · </span>}
                          {c.used_count} usos{c.max_uses != null ? ` / ${c.max_uses}` : ''}
                          {c.expires_at && <span> · caduca {new Date(c.expires_at).toLocaleDateString('es-ES')}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                        expired || exhausted ? 'bg-stone-100 text-stone-500'
                          : c.active ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {expired ? 'Caducado' : exhausted ? 'Agotado' : c.active ? 'Activo' : 'Pausado'}
                      </span>
                      <button onClick={() => toggleCoupon(c.id, !c.active)}
                        className="text-xs text-ink/55 hover:text-coral px-2 transition-colors">
                        {c.active ? 'Pausar' : 'Activar'}
                      </button>
                      <button onClick={() => deleteCoupon(c.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-1">🗑️</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* REVIEWS */}
        {tab==='reviews' && (
          <div className="max-w-3xl">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
              <h1 className="font-serif text-2xl font-black text-ink">Reseñas</h1>
              <button onClick={() => setShowTemplatesModal(true)}
                className="text-xs font-bold text-coral hover:text-coral-dark transition-colors">
                ⚙️ Gestionar plantillas ({replyTemplates.length})
              </button>
            </div>
            <p className="text-ink/55 text-sm mb-6">
              {reviews.length > 0
                ? `${reviews.length} reseña${reviews.length !== 1 ? 's' : ''} · media ${Number(provider?.rating || 0).toFixed(1)}★`
                : 'Aún no tienes reseñas. Cuando un cliente reserve y deje su valoración, aparecerá aquí.'}
            </p>

            {reviewsLoading ? (
              <div className="text-center text-ink/40 py-12">Cargando reseñas...</div>
            ) : reviews.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">⭐</div>
                <p className="text-ink/55 text-sm">Sin reseñas todavía.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map(r => {
                  const dateF = r.date
                    ? new Date(r.date).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
                    : ''
                  const draft = replyDraft[r.id] ?? (r.reply || '')
                  const dirty = draft !== (r.reply || '')
                  return (
                    <div key={r.id} className="bg-white border border-stone-200 rounded-2xl p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-coral/10 text-coral flex items-center justify-center font-bold text-sm shrink-0">
                          {r.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <div className="text-sm font-semibold text-ink">{r.author}</div>
                            <div className="text-[11px] text-ink/45">{dateF}{r.event_type ? ` · ${r.event_type}` : ''}</div>
                          </div>
                          <div className="text-coral text-sm">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={i < r.rating ? '' : 'text-ink/15'}>★</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {r.text && (
                        <p className="text-sm text-ink/75 leading-relaxed mb-4">{r.text}</p>
                      )}

                      <div className="pt-3 border-t border-stone-100">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label className="text-[10px] font-bold text-ink/45 uppercase tracking-widest">
                            {r.reply ? 'Tu respuesta (pública)' : 'Responder públicamente'}
                          </label>
                          {replyTemplates.length > 0 && (
                            <select value=""
                              onChange={e => { if (e.target.value !== '') applyTemplate(r.id, e.target.value, r.author); e.target.value = '' }}
                              className="text-[11px] border border-stone-200 rounded-lg px-2 py-1 text-ink/60 outline-none focus:border-coral">
                              <option value="">📋 Usar plantilla...</option>
                              {replyTemplates.map((t, i) => (
                                <option key={i} value={t.body}>{t.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <textarea value={draft}
                          onChange={e => setReplyDraft(d => ({ ...d, [r.id]: e.target.value }))}
                          rows={2} maxLength={1000}
                          placeholder="Agradece al cliente o aclara algo. Máx 1000 caracteres."
                          className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => submitReply(r.id)}
                            disabled={replyingId === r.id || !dirty}
                            className="bg-coral text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-50">
                            {replyingId === r.id ? 'Guardando...' : (r.reply ? 'Actualizar respuesta' : 'Publicar respuesta')}
                          </button>
                          {r.reply && (
                            <button onClick={() => { setReplyDraft(d => ({ ...d, [r.id]: '' })); submitReply(r.id) }}
                              disabled={replyingId === r.id}
                              className="text-xs text-ink/55 hover:text-coral px-2 transition-colors disabled:opacity-50">
                              Eliminar respuesta
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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

      {/* MODAL PLANTILLAS DE RESPUESTA */}
      {showTemplatesModal && (
        <TemplatesModal
          initial={replyTemplates}
          onClose={() => setShowTemplatesModal(false)}
          onSave={async next => { await saveReplyTemplates(next); setShowTemplatesModal(false) }}
        />
      )}

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

function EmbedTab({ provider }: { provider: Provider | null }) {
  const [variant, setVariant] = useState<'button' | 'card'>('button')
  const [copied,  setCopied]  = useState(false)
  if (!provider) return null

  const url = `https://fiestago.es/proveedores/${provider.slug || provider.id}?utm_source=widget&utm_medium=${variant}&utm_campaign=embed`
  const safeName = provider.name.replace(/"/g, '&quot;')

  const buttonHtml =
`<!-- FiestaGo · botón de reserva -->
<a href="${url}" target="_blank" rel="noopener" style="
  display:inline-flex;align-items:center;gap:8px;
  background:#E8553E;color:#fff;text-decoration:none;
  font-family:system-ui,-apple-system,sans-serif;font-weight:700;font-size:14px;
  padding:12px 22px;border-radius:12px;
  box-shadow:0 4px 12px rgba(232,85,62,.25);">
  <span>📅</span><span>Reserva en FiestaGo</span>
</a>`

  const cardHtml =
`<!-- FiestaGo · tarjeta de reserva -->
<a href="${url}" target="_blank" rel="noopener" style="
  display:flex;align-items:center;gap:14px;
  max-width:380px;background:#fff;border:1px solid #E5E1D8;
  border-radius:16px;padding:14px 16px;text-decoration:none;
  font-family:system-ui,-apple-system,sans-serif;color:#1A1612;
  box-shadow:0 4px 16px rgba(0,0,0,.06);">
  ${provider.photo_url
    ? `<img src="${provider.photo_url}" alt="" style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex-shrink:0;" />`
    : `<div style="width:56px;height:56px;border-radius:12px;background:#FBF7F0;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">🎉</div>`}
  <div style="flex:1;min-width:0;">
    <div style="font-size:11px;font-weight:700;color:#E8553E;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;">Reserva en FiestaGo</div>
    <div style="font-size:15px;font-weight:700;line-height:1.2;">${safeName}</div>
    ${provider.rating > 0
      ? `<div style="font-size:12px;color:#5C534A;margin-top:2px;">★ ${Number(provider.rating).toFixed(1)} · ${provider.total_reviews||0} reseñas</div>`
      : ''}
  </div>
  <span style="background:#E8553E;color:#fff;font-size:12px;font-weight:700;padding:8px 14px;border-radius:10px;flex-shrink:0;">Reservar →</span>
</a>`

  const snippet = variant === 'button' ? buttonHtml : cardHtml

  function copy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      toast.success('Copiado al portapapeles ✓')
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-2xl font-black text-ink mb-2">Widget para tu web</h1>
      <p className="text-ink/55 text-sm mb-6 leading-relaxed">
        Pega este código en tu propia web (WordPress, Wix, HTML directo, etc.) para que tus visitantes puedan reservarte vía FiestaGo. Cada click queda etiquetado como tráfico de tu widget para que sepamos cuánto te trae.
      </p>

      <div className="flex gap-2 mb-6">
        {([
          ['button', '🔘 Botón pequeño', 'Discreto, encaja en cualquier sitio'],
          ['card',   '🪪 Tarjeta',       'Mejor conversión, con tu foto y rating'],
        ] as const).map(([key, label, hint]) => (
          <button key={key} onClick={() => setVariant(key)}
            className={`flex-1 text-left p-4 border-2 rounded-2xl transition-colors ${
              variant === key
                ? 'border-coral bg-coral/5'
                : 'border-stone-200 hover:border-stone-300'
            }`}>
            <div className="font-bold text-sm text-ink mb-1">{label}</div>
            <div className="text-xs text-ink/55">{hint}</div>
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="mb-5">
        <div className="text-[10px] font-bold text-ink/45 uppercase tracking-widest mb-2">Vista previa</div>
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 flex items-center justify-center">
          <div dangerouslySetInnerHTML={{ __html: snippet }} />
        </div>
      </div>

      {/* Code */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-bold text-ink/45 uppercase tracking-widest">Código para copiar</div>
        <button onClick={copy}
          className="bg-ink text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-ink/85 transition-colors">
          {copied ? '✓ Copiado' : '📋 Copiar'}
        </button>
      </div>
      <pre className="bg-stone-900 text-stone-100 text-[11px] leading-relaxed rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono">{snippet}</pre>

      <div className="mt-5 bg-cream border border-stone-200 rounded-xl p-4 text-xs text-ink/65 leading-relaxed">
        <div className="font-bold text-ink mb-1">¿Dónde lo pego?</div>
        <ul className="list-disc ml-5 space-y-1">
          <li><strong>WordPress</strong>: en un bloque tipo "HTML personalizado" o en el footer del tema.</li>
          <li><strong>Wix / Squarespace</strong>: en un bloque "Embed code" o "Insertar HTML".</li>
          <li><strong>Web propia</strong>: pégalo donde quieras que aparezca, igual que cualquier HTML.</li>
        </ul>
      </div>
    </div>
  )
}

function TemplatesModal({ initial, onSave, onClose }: {
  initial: Array<{ label: string; body: string }>
  onSave: (next: Array<{ label: string; body: string }>) => void | Promise<void>
  onClose: () => void
}) {
  const MAX = 5
  const [items, setItems] = useState<Array<{ label: string; body: string }>>(
    initial.length ? initial : []
  )
  const [saving, setSaving] = useState(false)

  function addItem() {
    if (items.length >= MAX) return
    setItems(prev => [...prev, { label: '', body: '' }])
  }
  function updateItem(i: number, patch: Partial<{ label: string; body: string }>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }
  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }
  async function handleSave() {
    const clean = items
      .map(it => ({ label: it.label.trim().slice(0, 60), body: it.body.trim().slice(0, 1000) }))
      .filter(it => it.label && it.body)
    setSaving(true)
    await onSave(clean)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-serif text-xl font-black text-ink">Plantillas de respuesta</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-2xl leading-none">×</button>
        </div>
        <p className="text-xs text-ink/55 mb-5 leading-relaxed">
          Guarda hasta {MAX} respuestas tipo. Usa <code className="bg-stone-100 px-1.5 py-0.5 rounded text-coral">{'{nombre}'}</code> y se sustituirá por el nombre de pila del cliente al aplicarla.
        </p>

        {items.length === 0 && (
          <div className="text-center text-ink/45 text-sm py-8 border border-dashed border-stone-200 rounded-xl mb-4">
            No tienes plantillas todavía. Crea la primera.
          </div>
        )}

        {items.map((t, i) => (
          <div key={i} className="border border-stone-200 rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <input value={t.label} maxLength={60}
                onChange={e => updateItem(i, { label: e.target.value })}
                placeholder="Nombre de la plantilla (ej. 5★ agradecimiento)"
                className="flex-1 border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-ink outline-none focus:border-coral"/>
              <button onClick={() => removeItem(i)}
                className="text-xs text-red-500 hover:text-red-700 px-2">🗑️</button>
            </div>
            <textarea value={t.body} rows={3} maxLength={1000}
              onChange={e => updateItem(i, { body: e.target.value })}
              placeholder={'Ej. ¡Muchas gracias por tu reseña, {nombre}! Fue un placer formar parte de tu día.'}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-coral resize-none"/>
          </div>
        ))}

        {items.length < MAX && (
          <button onClick={addItem}
            className="w-full border-2 border-dashed border-stone-200 hover:border-coral hover:text-coral text-ink/50 rounded-xl py-2 text-sm font-bold transition-colors mb-4">
            + Añadir plantilla ({items.length}/{MAX})
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-coral text-white font-bold py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar plantillas'}
          </button>
          <button onClick={onClose}
            className="px-5 border border-stone-200 rounded-xl text-sm text-ink/60 hover:bg-stone-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function OnboardingChecklist({ provider, services, onGoTab }: {
  provider: Provider | null
  services: Service[]
  onGoTab: (tab: string) => void
}) {
  if (!provider) return null
  const items = [
    {
      key: 'photo',
      done: !!provider.photo_url,
      label: 'Sube tu foto de cabecera',
      hint:  'La primera imagen que ven los clientes en tu ficha.',
      tab:   'profile',
    },
    {
      key: 'description',
      done: !!(provider.description && provider.description.trim().length >= 40),
      label: 'Escribe una descripción (mínimo 40 caracteres)',
      hint:  'Explica quién eres y qué te diferencia.',
      tab:   'profile',
    },
    {
      key: 'phone',
      done: !!provider.phone,
      label: 'Añade un teléfono',
      hint:  'No se muestra al público, lo usamos para urgencias.',
      tab:   'profile',
    },
    {
      key: 'specialties',
      done: Array.isArray(provider.specialties) && provider.specialties.length > 0,
      label: 'Indica al menos una especialidad',
      hint:  'Aparecen como etiquetas en tu ficha (ej. Bodas íntimas, Vídeo 4K).',
      tab:   'profile',
    },
    {
      key: 'service',
      done: services.filter(s => s.status === 'active').length > 0,
      label: 'Crea al menos un servicio activo con precio',
      hint:  'Sin servicios no puedes recibir reservas.',
      tab:   'services',
    },
    {
      key: 'gallery',
      done: services.some(s => (s.media || []).length > 0),
      label: 'Sube al menos una imagen a la galería',
      hint:  'Las bodas se venden por foto. Sube al menos 1 por servicio.',
      tab:   'services',
    },
  ]
  const total = items.length
  const doneCount = items.filter(i => i.done).length
  const pct = Math.round((doneCount / total) * 100)

  if (pct === 100) return null

  return (
    <div className="bg-white border-2 border-coral/30 rounded-2xl p-5 mb-6 shadow-card">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-coral mb-0.5">Configura tu perfil</div>
          <h2 className="font-serif text-lg font-black text-ink">
            Tu perfil está al {pct}% — completa lo que falta
          </h2>
          <p className="text-xs text-ink/55 mt-0.5">
            Los proveedores con perfil completo reciben hasta 3× más reservas.
          </p>
        </div>
        <div className="text-right">
          <div className="font-serif text-3xl font-bold text-coral leading-none">{doneCount}/{total}</div>
        </div>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-coral transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {items.map(it => (
          <li key={it.key}>
            <button
              onClick={() => !it.done && onGoTab(it.tab)}
              disabled={it.done}
              className={`w-full text-left flex items-start gap-3 px-3 py-2 rounded-xl transition-colors ${
                it.done ? 'opacity-60 cursor-default' : 'hover:bg-coral/5 cursor-pointer'
              }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                it.done ? 'bg-emerald-500 text-white' : 'border-2 border-stone-300'
              }`}>
                {it.done && '✓'}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${it.done ? 'text-ink/50 line-through' : 'text-ink'}`}>
                  {it.label}
                </div>
                {!it.done && <div className="text-xs text-ink/50">{it.hint}</div>}
              </div>
              {!it.done && <span className="text-xs text-coral font-bold whitespace-nowrap self-center">Hacerlo →</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Sub-bloque que se muestra al final del tab "availability". Permite al
// proveedor conectar/desconectar su Google Calendar. La conexión importa
// los ocupados a service_availability (source='google') y exporta cada
// reserva confirmada como evento de día completo.
function GoogleCalendarBlock({ providerId }: { providerId: string }) {
  const [status, setStatus] = useState<{
    connected: boolean
    google_email: string | null
    last_synced_at: string | null
    watch_until: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const searchParams = useSearchParams()

  async function load() {
    if (!providerId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/google/status?provider_id=${providerId}`)
      if (res.ok) setStatus(await res.json())
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const gcal = searchParams.get('gcal')
    if (gcal === 'ok')    toast.success('Google Calendar conectado ✓')
    if (gcal === 'error') toast.error('No se pudo conectar Google Calendar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])

  async function disconnect() {
    if (!confirm('¿Desconectar Google Calendar? Los bloqueos importados se borrarán; los manuales se mantienen.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId }),
      })
      if (res.ok) {
        toast.success('Google Calendar desconectado')
        await load()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Error desconectando')
      }
    } finally { setBusy(false) }
  }

  if (loading) return null

  if (!status?.connected) {
    return (
      <div className="mt-6 bg-white border border-stone-200 rounded-2xl p-5 shadow-card">
        <div className="flex items-start gap-4">
          <div className="text-3xl">📅</div>
          <div className="flex-1">
            <div className="font-bold text-ink mb-1">Sincroniza con Google Calendar</div>
            <p className="text-sm text-ink/55 mb-3">
              Conecta tu Google Calendar y los días que tengas otros compromisos se bloquearán
              solos aquí. Las reservas que aceptes se añadirán a tu Google Calendar como eventos.
              Solo leemos disponibilidad (ocupado/libre), nunca los títulos.
            </p>
            <a
              href={`/api/google/connect?provider_id=${providerId}`}
              className="inline-block text-sm font-bold bg-coral text-white px-4 py-2 rounded-xl hover:bg-coral-dark"
            >
              Conectar Google Calendar
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="text-3xl">✅</div>
        <div className="flex-1">
          <div className="font-bold text-ink">Google Calendar conectado</div>
          <div className="text-xs text-ink/60 mt-1">
            {status.google_email && <>Como <strong>{status.google_email}</strong>. </>}
            {status.last_synced_at
              ? <>Última sincronización: {new Date(status.last_synced_at).toLocaleString('es-ES')}.</>
              : 'Sincronización inicial en curso.'}
          </div>
          <button onClick={disconnect} disabled={busy}
            className="text-xs text-coral hover:underline mt-2 disabled:opacity-50">
            Desconectar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProveedorPanelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center text-ink/40">Cargando panel...</div>}>
      <ProveedorPanelInner />
    </Suspense>
  )
}

