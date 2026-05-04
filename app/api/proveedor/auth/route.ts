import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import * as crypto from 'crypto'

function generateToken(providerId: string) {
  return crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || 'secret')
    .update(providerId + Date.now())
    .digest('hex')
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const { email } = await req.json()

  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const { data: provider } = await supabase
    .from('providers')
    .select('id, name, email, status')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!provider) {
    return NextResponse.json({ error: 'No encontramos ningún proveedor con ese email. ¿Te has registrado en FiestaGo?' }, { status: 404 })
  }

  // Generate simple token and store it
  const token = generateToken(provider.id)
  await supabase.from('providers').update({
    agent_notes: `token:${token}` // reusing field for simplicity
  }).eq('id', provider.id)

  // In production: send magic link email
  // For now: return token directly (demo mode)
  return NextResponse.json({
    token,
    providerId: provider.id,
    name:       provider.name,
    message:    'Acceso concedido',
  })
}
