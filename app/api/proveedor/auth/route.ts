import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function getServices(notes: string) {
  try {
    if (notes?.includes('services:')) {
      return JSON.parse(notes.split('services:')[1].split('|')[0])
    }
  } catch {}
  return []
}

function setServices(notes: string, services: any[]) {
  const base = (notes || '').replace(/services:.*?(\||$)/, '')
  return `${base}services:${JSON.stringify(services)}|`
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const { providerId, name, description, price, duration, maxGuests } = await req.json()
  if (!providerId || !name || !price) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

  const { data: provider } = await supabase.from('providers').select('agent_notes').eq('id', providerId).single()
  const services = getServices(provider?.agent_notes || '')
  const newService = { id: `svc_${Date.now()}`, name, description: description || '', price, duration, maxGuests: maxGuests || null }
  services.push(newService)

  await supabase.from('providers').update({ agent_notes: setServices(provider?.agent_notes || '', services) }).eq('id', providerId)
  return NextResponse.json({ service: newService })
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const { providerId, id, name, description, price, duration, maxGuests } = await req.json()
  if (!providerId || !id) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

  const { data: provider } = await supabase.from('providers').select('agent_notes').eq('id', providerId).single()
  let services = getServices(provider?.agent_notes || '')
  services = services.map((s: any) => s.id === id ? { ...s, name, description, price, duration, maxGuests } : s)

  await supabase.from('providers').update({ agent_notes: setServices(provider?.agent_notes || '', services) }).eq('id', providerId)
  return NextResponse.json({ service: services.find((s: any) => s.id === id) })
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const providerId = searchParams.get('providerId')
  if (!id || !providerId) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

  const { data: provider } = await supabase.from('providers').select('agent_notes').eq('id', providerId).single()
  let services = getServices(provider?.agent_notes || '')
  services = services.filter((s: any) => s.id !== id)

  await supabase.from('providers').update({ agent_notes: setServices(provider?.agent_notes || '', services) }).eq('id', providerId)
  return NextResponse.json({ success: true })
}
