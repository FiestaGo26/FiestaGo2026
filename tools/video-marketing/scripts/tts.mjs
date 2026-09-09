/**
 * Voz de ElevenLabs para una frase suelta.
 *
 * Devuelve el MP3 en memoria: quien lo llama decide si lo guarda o lo manda
 * a fal como data URI (que es lo que hace la cadena de lipsync, y así nos
 * ahorramos subir el audio a ningún sitio).
 */
import { TTS } from './models.mjs'

export async function speak(line, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('Falta ELEVENLABS_API_KEY · necesaria para el diálogo')
  if (!voiceId) {
    throw new Error(
      'Falta el voice_id de este personaje. Define su variable (p.ej. ' +
      'ELEVENLABS_VOICE_MARCOS) o ELEVENLABS_VOICE_ID como genérica.'
    )
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: line,
      model_id: TTS.modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
    }),
  })
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/** MP3 → data URI, que es lo que acepta sync-lipsync sin necesidad de hosting. */
export function toDataUri(buf) {
  return `data:audio/mpeg;base64,${buf.toString('base64')}`
}
