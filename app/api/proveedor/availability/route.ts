import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  const auth = await requireProviderAuth(req, id)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data: provider } = await supabase
    .from('providers')
    .select('short_desc')
    .eq('id', id!)
    .single()

  let availability = []
  try {
    if (provider?.short_desc?.startsWith('avail:')) {
      availability = JSON.parse(provider.short_desc.replace('avail:', ''))
    }
  } catch {}

  return NextResponse.json({ availability })
}

export async function POST(req: NextRequest) {
  const { providerId, date, available } = await req.json()
  if (!providerId || !date) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data: provider } = await supabase
    .from('providers')
    .select('short_desc')
    .eq('id', providerId)
    .single()

  let availability: any[] = []
  try {
    if (provider?.short_desc?.startsWith('avail:')) {
      availability = JSON.parse(provider.short_desc.replace('avail:', ''))
    }
  } catch {}

  const idx = availability.findIndex((a: any) => a.date === date)
  if (idx >= 0) {
    availability[idx].available = available
  } else {
    availability.push({ date, available })
  }

  const cutoff = new Date().toISOString().split('T')[0]
  availability = availability.filter((a: any) => a.date >= cutoff)

  await supabase.from('providers').update({
    short_desc: `avail:${JSON.stringify(availability)}`
  }).eq('id', providerId)

  return NextResponse.json({ success: true })
}
