/**
 * Modelos de fal.ai y su precio. Fuente única para el generador y para la
 * calculadora de coste — si cambias de modelo, el presupuesto se recalcula solo.
 *
 * Precios en USD, comprobados en septiembre de 2026. fal los actualiza:
 * verifica en https://fal.ai/models antes de una tanda grande.
 */

export const IMAGE_MODEL = {
  id:            'fal-ai/flux-pro/v1.1',
  usdPerImage:   0.04,
}

// Por defecto vamos al barato que aún da 720p decente en vertical.
// El salto a Pro (1080p) casi triplica el precio y tarda ~3x más por clip.
export const VIDEO_MODELS = {
  'kling-o3-standard': {
    id:            'fal-ai/kling-video/o3/standard/image-to-video',
    usdPerSecond:  0.084,
    resolution:    '720p',
    nota:          'Recomendado · mejor relación calidad/precio y ~94s por clip',
  },
  'kling-v3-pro': {
    id:            'fal-ai/kling-video/v3/pro/image-to-video',
    usdPerSecond:  0.112,
    resolution:    '1080p',
    nota:          'Solo si el vídeo va a verse fuera del móvil · ~318s por clip',
  },
}

export const DEFAULT_VIDEO_MODEL = 'kling-o3-standard'

export function videoModel(name = DEFAULT_VIDEO_MODEL) {
  const m = VIDEO_MODELS[name]
  if (!m) {
    throw new Error(
      `Modelo de vídeo desconocido: "${name}". Opciones: ${Object.keys(VIDEO_MODELS).join(', ')}`
    )
  }
  return m
}
