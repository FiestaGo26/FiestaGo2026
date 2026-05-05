import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id    = searchParams.get('id')
  const email = searchParams.get('email')

  if (!id && !email) {
    return NextResponse.json({ error: 'ID o email requerido' }, { status: 400 })
  }

  let query = supabase.from('providers').select('*')

  if (id)         query = query.eq('id', id)
  else if (email) query = query.ilike('email', email.toLowerCase().trim())

  const { data: provider, error } = await query.single()

  if (error || !provider) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }

  // Parse services stored in agent_notes
  let services = []
  try {
    const notes = provider.agent_notes || ''
    if (notes.includes('services:')) {
      services = JSON.parse(notes.split('services:')[1].split('|')[0])
    }
  } catch {}

  return NextResponse.json({ provider, services })
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('providers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ provider: data })
}
