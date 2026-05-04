import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function checkAuth(req: NextRequest) {
  return !!req.headers.get('x-provider-token')
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  // Get availability from a JSON field we store in the provider record
  const { data: provider } = await supabase
    .from('providers')
    .select('short_desc')
    .eq('id', id)
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
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { providerId, date, available } = await req.json()
  if (!providerId || !date) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

  // Get current availability
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

  // Update or add the date
  const idx = availability.findIndex((a: any) => a.date === date)
  if (idx >= 0) {
    availability[idx].available = available
  } else {
    availability.push({ date, available })
  }

  // Save back — clean old dates
  const cutoff = new Date().toISOString().split('T')[0]
  availability = availability.filter((a: any) => a.date >= cutoff)

  await supabase.from('providers').update({
    short_desc: `avail:${JSON.stringify(availability)}`
  }).eq('id', providerId)

  return NextResponse.json({ success: true })
}
