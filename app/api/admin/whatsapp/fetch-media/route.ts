import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { downloadWhatsappMedia, transcribeAudio } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// ─── GET /api/admin/whatsapp/fetch-media?media_id=...&proxy=1 ────────────────
// Modo proxy: descarga el binario en el server y lo devuelve al navegador
// con el content-type correcto. Útil para reproducir/descargar la nota de
// voz desde el panel admin sin tener que tocar curls.
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const mediaId = url.searchParams.get('media_id') || ''
  if (!mediaId) return NextResponse.json({ error: 'media_id requerido' }, { status: 400 })

  const media = await downloadWhatsappMedia(mediaId)
  if (!media) {
    return NextResponse.json({
      error: 'No se pudo descargar el media. Causas típicas: WHATSAPP_TOKEN caducado, media_id inválido, o el archivo ya no existe en los servidores de Meta (las URLs caducan ~horas).',
    }, { status: 502 })
  }

  // Sugerencia de filename según mime
  const ext =
    media.mimeType.includes('opus') || media.mimeType.includes('ogg') ? 'ogg' :
    media.mimeType.includes('mpeg') || media.mimeType.includes('mp3') ? 'mp3' :
    media.mimeType.includes('wav') ? 'wav' :
    media.mimeType.includes('m4a') ? 'm4a' :
    media.mimeType.includes('jpeg') || media.mimeType.includes('jpg') ? 'jpg' :
    media.mimeType.includes('png') ? 'png' :
    media.mimeType.includes('pdf') ? 'pdf' :
    'bin'
  const filename = `wa-${mediaId}.${ext}`

  return new NextResponse(new Uint8Array(media.buffer), {
    status: 200,
    headers: {
      'Content-Type':        media.mimeType.split(';')[0].trim() || 'application/octet-stream',
      'Content-Length':      String(media.buffer.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}

// ─── POST /api/admin/whatsapp/fetch-media ───────────────────────────────────
// Body: { media_id, transcribe?: boolean, save_transcription?: boolean }
//
// Descarga el media (en server, con el token bueno) y opcionalmente:
//   - transcribe el audio con Whisper si OPENAI_API_KEY está configurada
//   - guarda la transcripción en whatsapp_messages.body / status para que el
//     historial de la conversación quede actualizado (útil para audios
//     antiguos que entraron antes de configurar Whisper).
//
// Devuelve { ok, mime_type, size, transcription?, saved_message_id? }.
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const mediaId           = String(body.media_id || '').trim()
  const wantsTranscribe   = !!body.transcribe
  const wantsSave         = !!body.save_transcription

  if (!mediaId) {
    return NextResponse.json({ error: 'media_id requerido' }, { status: 400 })
  }

  const media = await downloadWhatsappMedia(mediaId)
  if (!media) {
    return NextResponse.json({
      error: 'No se pudo descargar el media (token caducado, id inválido, o archivo expirado en Meta).',
    }, { status: 502 })
  }

  const result: any = {
    ok:        true,
    media_id:  mediaId,
    mime_type: media.mimeType,
    size:      media.buffer.length,
  }

  // Si no quieren transcripción, devolvemos solo metadata. El binario
  // se puede bajar con el GET ?proxy=1.
  if (!wantsTranscribe) return NextResponse.json(result)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ...result,
      error: 'transcribe=true pero falta OPENAI_API_KEY en el entorno — no se puede llamar a Whisper.',
    }, { status: 400 })
  }

  const text = await transcribeAudio({ buffer: media.buffer, mimeType: media.mimeType })
  if (!text) {
    return NextResponse.json({
      ...result,
      error: 'Whisper devolvió respuesta vacía (audio en silencio, idioma raro o error temporal).',
    }, { status: 502 })
  }

  result.transcription = text

  // Guardar la transcripción en la fila de whatsapp_messages — útil para
  // recuperar audios viejos. Busca la fila por media_id en el payload jsonb.
  if (wantsSave) {
    try {
      const supabase = createAdminClient()
      const newBody = `🎙 ${text}`

      // El media_id puede estar en payload.audio.id, payload.image.id, etc.
      // Lo buscamos en los tipos típicos de multimedia.
      const { data: row } = await supabase
        .from('whatsapp_messages')
        .select('id, body, status')
        .or(`payload->audio->>id.eq.${mediaId},payload->image->>id.eq.${mediaId},payload->document->>id.eq.${mediaId},payload->video->>id.eq.${mediaId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (row) {
        const { error: upErr } = await supabase
          .from('whatsapp_messages')
          .update({ body: newBody, status: 'received_transcribed' })
          .eq('id', row.id)
        if (upErr) {
          result.save_error = upErr.message
        } else {
          result.saved_message_id = row.id
        }
      } else {
        result.save_error = `No se encontró un whatsapp_messages con media_id ${mediaId} en el payload`
      }
    } catch (err: any) {
      result.save_error = err?.message || 'error guardando'
    }
  }

  return NextResponse.json(result)
}
