import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Atajo del admin que reenvía al endpoint cron de polling.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const cronSecret = process.env.CRON_SECRET || ''
  const baseUrl = process.env.SITE_URL || `https://${req.headers.get('host')}`
  const res = await fetch(`${baseUrl}/api/cron/content-daily-poll`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-cron-secret': cronSecret,
    },
    body: JSON.stringify({}),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
