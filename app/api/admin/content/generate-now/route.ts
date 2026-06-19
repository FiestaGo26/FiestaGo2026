import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Atajo desde el admin que reenvía al endpoint cron protegido con el
// CRON_SECRET. Así reutilizamos la lógica y no la duplicamos.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const cronSecret = process.env.CRON_SECRET || ''
  const adminPass  = req.headers.get('x-admin-password') || ''

  const baseUrl = process.env.SITE_URL || `https://${req.headers.get('host')}`
  const res = await fetch(`${baseUrl}/api/cron/content-daily-generate`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-cron-secret':   cronSecret,
      'x-admin-password': adminPass,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
