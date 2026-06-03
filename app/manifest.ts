import type { MetadataRoute } from 'next'

// Web App Manifest. Hace que /fiestago.es sea instalable como PWA
// (icono en home screen, modo standalone sin barra del navegador,
// splash screen, etc.). Apple Safari respeta partes; Chrome/Edge
// soportan todo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'FiestaGo — Tu celebración perfecta',
    short_name:       'FiestaGo',
    description:      'Marketplace de bodas, cumpleaños, comuniones y eventos privados en España. Con Garantía de Éxito incluida.',
    start_url:        '/',
    display:          'standalone',
    orientation:      'portrait',
    background_color: '#FBF7F0',
    theme_color:      '#E8553E',
    lang:             'es-ES',
    dir:              'ltr',
    categories:       ['lifestyle', 'shopping', 'social'],
    icons: [
      { src: '/icon1', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon1', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name:        'Explorar proveedores',
        short_name:  'Catálogo',
        description: 'Ver el catálogo completo',
        url:         '/proveedores',
        icons: [{ src: '/icon1', sizes: '192x192' }],
      },
      {
        name:        'Mis favoritos',
        short_name:  'Favoritos',
        description: 'Tu shortlist guardada',
        url:         '/favoritos',
        icons: [{ src: '/icon1', sizes: '192x192' }],
      },
      {
        name:        'Calculadora',
        short_name:  'Calcular',
        description: 'Estima tu presupuesto',
        url:         '/calculadora',
        icons: [{ src: '/icon1', sizes: '192x192' }],
      },
    ],
  }
}
