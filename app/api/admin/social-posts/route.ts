import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/social-posts?status=pending|approved|...
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const limit  = parseInt(searchParams.get('limit') || '50')

  let q = supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Counts
  const { data: counts } = await supabase
    .from('social_posts')
    .select('status', { count: 'exact', head: false })

  const stats = (counts || []).reduce((s: any, r: any) => {
    s[r.status] = (s[r.status] || 0) + 1
    return s
  }, {})

  return NextResponse.json({ posts: data || [], stats })
}

// PATCH /api/admin/social-posts — update (status, caption, hashtags, scheduled_for)
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Auditar aprobación/rechazo
  if (updates.status === 'approved') {
    updates.approved_at = new Date().toISOString()
    updates.approved_by = process.env.ADMIN_EMAIL || 'admin'
  }
  if (updates.status === 'published') {
    updates.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('social_posts').update(updates).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

// DELETE /api/admin/social-posts?id=...
export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Borrar el archivo de Storage si existe
  const { data: post } = await supabase.from('social_posts').select('media_url').eq('id', id).single()
  if (post?.media_url) {
    // Extract path: .../social-posts/2026-05-07/abc123.mp4
    const match = post.media_url.match(/\/social-posts\/(.+)$/)
    if (match) {
      await supabase.storage.from('social-posts').remove([match[1]]).catch(() => {})
    }
  }

  const { error } = await supabase.from('social_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
