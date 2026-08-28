// Paleta y tipos compartidos por todas las escenas.
// Los proveedores y los clientes tienen chip color propio para que la
// audiencia se identifique de un vistazo.

export const theme = {
  // Ground cinematográfico oscuro por defecto · más moderno para 2026
  bg:         '#0F1013',
  bgAccent:   '#E8553E',       // fondo cuando bgAccent=true en escena
  panel:      '#1A1D22',
  ink:        '#F5F1E8',       // off-white cálido
  inkMid:     '#A29D91',
  inkDim:     '#6B6560',
  coral:      '#E8553E',
  sage:       '#7DA87A',
  amber:      '#D4A054',
  // Fuentes locales (Google fonts fetched at bundle time via @remotion/google-fonts)
  displayFont: 'Space Grotesk',
  bodyFont:    'Inter',
  monoFont:    'JetBrains Mono',
} as const

export function targetAccent(t: 'provider' | 'client') {
  return t === 'provider' ? theme.coral : theme.sage
}
