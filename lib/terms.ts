// Versión actual de los "Compromisos del Proveedor". Cuando cambies el
// documento en app/(public)/proveedor/compromisos/page.tsx, sube aquí
// la versión. Los proveedores con terms_version distinta tendrán que
// re-aceptar antes de seguir aceptando reservas.
//
// Historial:
//   1.0 · junio 2026 — versión inicial con 7 compromisos
//   1.1 · agosto 2026 — nuevo compromiso 8 "Alta el día de emitir
//         factura" que separa la obligación fiscal recurrente del
//         compromiso 4 (verificación documental). Necesario tras
//         añadir facturación Verifactu con anticipo + pagos divididos.
export const TERMS_VERSION_CURRENT = '1.1'
