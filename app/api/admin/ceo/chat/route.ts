import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/ceo/chat → últimos mensajes del chat con el CEO
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data, error } = await createAdminClient().from('ceo_messages')
    .select('id, created_at, role, content').order('created_at', { ascending: false }).limit(60)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: (data || []).reverse() })
}

// POST /api/admin/ceo/chat — body: { message }
// Guarda el mensaje y despierta al CEO en segundo plano (pensar con todas
// las métricas no cabe en una petición normal). El panel consulta el GET
// hasta que llega la respuesta.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { message } = await req.json().catch(() => ({} as any))
  const text = String(message || '').trim().slice(0, 4000)
  if (!text) return NextResponse.json({ error: 'Escribe un mensaje' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('ceo_messages').insert({ role: 'owner', content: text })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const base = process.env.SITE_URL || process.env.URL || `https://${req.headers.get('host')}`
  const res = await fetch(`${base}/.netlify/functions/ceo-chat-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tick-secret': process.env.CEO_TICK_SECRET || '' },
    body: '{}',
  }).catch((err: any) => ({ ok: false, status: 0, statusText: err?.message } as any))
  if (!res.ok) return NextResponse.json({ error: `No se pudo avisar al CEO (${res.status} ${res.statusText || ''})` }, { status: 502 })
  return NextResponse.json({ ok: true })
}
