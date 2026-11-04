# Subida manual a Printful → Shopify (14 fichas)

> La API de Printful **no permite crear productos sincronizados en una tienda Shopify** (solo en tiendas tipo "API"), así que se crean desde el panel de Printful. Este documento lo genera `node catalogo/documentos.mjs` a partir de `catalogo/productos.mjs`: si cambias algo allí, vuelve a generarlo.

**Antes de empezar**
1. `PRINTFUL_TOKEN=… node catalogo/printful.mjs verificar` → confirma que cada producto sigue en catálogo y sus costes. Donde haya diferencia, manda Printful.
2. `node designs/generate.mjs` si has cambiado áreas o diseños.
3. En Shopify, crea la colección **Drop 01 — Aguanta** (handle `drop-01-aguanta`, plantilla `collection.drop`).

**Pasos por ficha (Printful → Stores → tu tienda Shopify → Add product)**
1. Elige el producto base indicado.
2. Sube el archivo indicado en la posición indicada. Comprueba en el editor que no sale ningún aviso de baja resolución y que el diseño queda centrado arriba.
3. Selecciona solo los colores y tallas de la lista.
4. En "Product details": título, descripción (copia de `copy/productos.md`) y precio (PVP de la tabla, igual para todas las tallas salvo que Printful cobre más por 2XL; en ese caso súbelo 2 €).
5. Mockups: elige frontal + uno de detalle/modelo. Pon el texto alternativo indicado.
6. Envía a la tienda. Después, en Shopify: añade la ficha a la colección **Drop 01 — Aguanta**, pon la etiqueta `nuevo` (opcional) y el tipo de producto indicado (lo usa la guía de tallas).

| Ficha | Producto base Printful | PVP | Archivo |
|---|---|---|---|
| Camiseta AGUANTA | Bella + Canvas 3001 | 29 € | `designs/export/printful/camiseta-aguanta-frontal.png` |
| Camiseta UN RATO MÁS | Bella + Canvas 3001 | 29 € | `designs/export/printful/camiseta-un-rato-mas-frontal.png` |
| Camiseta DOMINGO DE SERIES | Bella + Canvas 3001 | 29 € | `designs/export/printful/camiseta-domingo-de-series-frontal.png` |
| Oversize HOY TOCA | Oversized | 45 € | `designs/export/printful/oversize-hoy-toca-frontal.png` |
| Oversize NO ERA TAN DURO | Oversized | 45 € | `designs/export/printful/oversize-no-era-tan-duro-frontal.png` |
| Sudadera con capucha AGUANTA | Cotton Heritage M2580 | 65 € | `designs/export/printful/sudadera-capucha-aguanta-frontal.png` |
| Sudadera con capucha FC AGUANTA | Cotton Heritage M2580 | 65 € | `designs/export/printful/sudadera-capucha-fc-aguanta-frontal.png` |
| Sudadera KILÓMETRO CERO | Gildan 18000 | 49 € | `designs/export/printful/sudadera-kilometro-cero-frontal.png` |
| Tirantes SUDOR LOCAL | Bella + Canvas 3480 | 29 € | `designs/export/printful/tirantes-sudor-local-frontal.png` |
| Leggings PATRÓN A | All-Over Print Leggings | 59 € | `designs/export/printful/leggings-patron-a-patron.png` |
| Shorts PATRÓN B | All-Over Print Men's Athletic Shorts | 55 € | `designs/export/printful/shorts-patron-b-patron.png` |
| Gorra MAÑANA TAMBIÉN | Yupoong 6245CM | 35 € | `designs/export/printful/gorra-manana-tambien-bordado_frontal.png` |
| Bolsa RESPIRA | All-Over Print Drawstring Bag | 39 € | `designs/export/printful/bolsa-respira-frontal.png` |
| Botella UN RATO MÁS | Stainless Steel Water Bottle | 45 € | `designs/export/printful/botella-un-rato-mas-envolvente.png` |

## Camiseta AGUANTA

- [ ] **Producto Printful:** Bella + Canvas 3001 — o, si no está, — Unisex Staple T-Shirt (DTG)
- [ ] **Diseño:** 01 AGUANTA — versión para fondo **oscuro**
- [ ] **Archivo:** `designs/export/printful/camiseta-aguanta-frontal.png` (3600×4800 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** Black
- [ ] **Tallas:** XS, S, M, L, XL, 2XL
- [ ] **Precio:** 29,00 € (coste estimado 12.50 € + envío 4.49 € → margen neto 43.0 %)
- [ ] **Tipo de producto en Shopify:** Camiseta
- [ ] **Texto alternativo:** Wordmark AGUANTA gigante en hueso y rojo, cortado por los bordes
- [ ] **Handle en Shopify:** `camiseta-aguanta`

## Camiseta UN RATO MÁS

- [ ] **Producto Printful:** Bella + Canvas 3001 — o, si no está, — Unisex Staple T-Shirt (DTG)
- [ ] **Diseño:** 02 UN RATO MÁS — versión para fondo **claro**
- [ ] **Archivo:** `designs/export/printful/camiseta-un-rato-mas-frontal.png` (3600×4800 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** White, Heather Dust
- [ ] **Tallas:** XS, S, M, L, XL, 2XL
- [ ] **Precio:** 29,00 € (coste estimado 12.50 € + envío 4.49 € → margen neto 43.0 %)
- [ ] **Tipo de producto en Shopify:** Camiseta
- [ ] **Texto alternativo:** Texto UN RATO en bloque y MÁS en rojo debajo
- [ ] **Handle en Shopify:** `camiseta-un-rato-mas`

## Camiseta DOMINGO DE SERIES

- [ ] **Producto Printful:** Bella + Canvas 3001 — o, si no está, — Unisex Staple T-Shirt (DTG)
- [ ] **Diseño:** 04 DOMINGO DE SERIES — versión para fondo **oscuro**
- [ ] **Archivo:** `designs/export/printful/camiseta-domingo-de-series-frontal.png` (3600×4800 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** Black, Dark Grey Heather
- [ ] **Tallas:** XS, S, M, L, XL, 2XL
- [ ] **Precio:** 29,00 € (coste estimado 12.50 € + envío 4.49 € → margen neto 43.0 %)
- [ ] **Tipo de producto en Shopify:** Camiseta
- [ ] **Texto alternativo:** Barras tipo marcador con DOMINGO DE SERIES y marcador AGUANTA 03 SOFÁ 00
- [ ] **Handle en Shopify:** `camiseta-domingo-de-series`

## Oversize HOY TOCA

- [ ] **Producto Printful:** Oversized — o, si no está, — Shaka Wear — o, si no está, — Garment-Dyed (DTG)
- [ ] **Diseño:** 06 HOY TOCA — versión para fondo **oscuro**
- [ ] **Archivo:** `designs/export/printful/oversize-hoy-toca-frontal.png` (3600×4800 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** Black
- [ ] **Tallas:** S, M, L, XL, 2XL
- [ ] **Precio:** 45,00 € (coste estimado 18.50 € + envío 4.49 € → margen neto 46.5 %)
- [ ] **Tipo de producto en Shopify:** Camiseta oversize
- [ ] **Texto alternativo:** MAÑANA tachado en rojo sobre HOY TOCA en letras enormes
- [ ] **Handle en Shopify:** `oversize-hoy-toca`

## Oversize NO ERA TAN DURO

- [ ] **Producto Printful:** Oversized — o, si no está, — Shaka Wear — o, si no está, — Garment-Dyed (DTG)
- [ ] **Diseño:** 12 NO ERA TAN DURO — versión para fondo **claro**
- [ ] **Archivo:** `designs/export/printful/oversize-no-era-tan-duro-frontal.png` (3600×4800 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** Ivory
- [ ] **Tallas:** S, M, L, XL, 2XL
- [ ] **Precio:** 45,00 € (coste estimado 18.50 € + envío 4.49 € → margen neto 46.5 %)
- [ ] **Tipo de producto en Shopify:** Camiseta oversize
- [ ] **Texto alternativo:** Frase pequeña NO ERA TAN DURO con asterisco rojo y nota mentira, sí lo era
- [ ] **Handle en Shopify:** `oversize-no-era-tan-duro`

## Sudadera con capucha AGUANTA

- [ ] **Producto Printful:** Cotton Heritage M2580 — o, si no está, — Unisex Premium Hoodie (DTG)
- [ ] **Diseño:** 01 AGUANTA — versión para fondo **oscuro**
- [ ] **Archivo:** `designs/export/printful/sudadera-capucha-aguanta-frontal.png` (3600×3600 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** Black
- [ ] **Tallas:** S, M, L, XL, 2XL
- [ ] **Precio:** 65,00 € (coste estimado 26.00 € + envío 6.49 € → margen neto 44.7 %)
- [ ] **Tipo de producto en Shopify:** Sudadera
- [ ] **Texto alternativo:** Wordmark AGUANTA gigante en hueso y rojo, cortado por los bordes
- [ ] **Handle en Shopify:** `sudadera-capucha-aguanta`

## Sudadera con capucha FC AGUANTA

- [ ] **Producto Printful:** Cotton Heritage M2580 — o, si no está, — Unisex Premium Hoodie (DTG)
- [ ] **Diseño:** 07 FC AGUANTA — versión para fondo **claro**
- [ ] **Archivo:** `designs/export/printful/sudadera-capucha-fc-aguanta-frontal.png` (3600×3600 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** Bone
- [ ] **Tallas:** S, M, L, XL, 2XL
- [ ] **Precio:** 65,00 € (coste estimado 26.00 € + envío 6.49 € → margen neto 44.7 %)
- [ ] **Tipo de producto en Shopify:** Sudadera
- [ ] **Texto alternativo:** Escudo FC AGUANTA con franjas rojas, la A en el centro y 2026
- [ ] **Handle en Shopify:** `sudadera-capucha-fc-aguanta`

## Sudadera KILÓMETRO CERO

- [ ] **Producto Printful:** Gildan 18000 — o, si no está, — Unisex Crew Neck Sweatshirt (DTG)
- [ ] **Diseño:** 03 KILÓMETRO CERO — versión para fondo **claro**
- [ ] **Archivo:** `designs/export/printful/sudadera-kilometro-cero-frontal.png` (3600×4800 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** Sport Grey, White
- [ ] **Tallas:** S, M, L, XL, 2XL
- [ ] **Precio:** 49,00 € (coste estimado 20.00 € + envío 6.49 € → margen neto 42.1 %)
- [ ] **Tipo de producto en Shopify:** Sudadera
- [ ] **Texto alternativo:** Mapa de líneas abstracto con ruta roja, KILÓMETRO CERO y coordenadas
- [ ] **Handle en Shopify:** `sudadera-kilometro-cero`

## Tirantes SUDOR LOCAL

- [ ] **Producto Printful:** Bella + Canvas 3480 — o, si no está, — Unisex Jersey Tank (DTG)
- [ ] **Diseño:** 05 SUDOR LOCAL — versión para fondo **claro**
- [ ] **Archivo:** `designs/export/printful/tirantes-sudor-local-frontal.png` (3000×3900 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** White, Athletic Heather
- [ ] **Tallas:** XS, S, M, L, XL, 2XL
- [ ] **Precio:** 29,00 € (coste estimado 12.75 € + envío 4.49 € → margen neto 42.0 %)
- [ ] **Tipo de producto en Shopify:** Tirantes
- [ ] **Texto alternativo:** Sello circular SUDOR LOCAL denominación de origen con D.O. en rojo
- [ ] **Handle en Shopify:** `tirantes-sudor-local`

## Leggings PATRÓN A

- [ ] **Producto Printful:** All-Over Print Leggings — o, si no está, — Leggings (Sublimación integral)
- [ ] **Diseño:** 09 PATRÓN A — versión para fondo **oscuro**
- [ ] **Archivo:** `designs/export/printful/leggings-patron-a-patron.png` (lámina 6000×6000 px). En el editor de Printful usa la herramienta de patrón/fondo con el módulo `designs/export/patrones/09-patron-a-oscuro-modulo.png` si prefieres que lo repita él; empalma sin costuras.
- [ ] **Posición:** Impresión integral — patrón (All-over / Pattern). Cubre todas las piezas (delantero, trasero, cinturilla).
- [ ] **Colores:** Integral
- [ ] **Tallas:** XS, S, M, L, XL
- [ ] **Precio:** 59,00 € (coste estimado 25.50 € + envío 4.99 € → margen neto 43.4 %)
- [ ] **Tipo de producto en Shopify:** Leggings
- [ ] **Texto alternativo:** Patrón repetido de la A de AGUANTA en hueso y lima sobre negro
- [ ] **Handle en Shopify:** `leggings-patron-a`

## Shorts PATRÓN B

- [ ] **Producto Printful:** All-Over Print Men's Athletic Shorts — o, si no está, — Athletic Shorts (Sublimación integral)
- [ ] **Diseño:** 10 PATRÓN B — versión para fondo **oscuro**
- [ ] **Archivo:** `designs/export/printful/shorts-patron-b-patron.png` (lámina 6000×6000 px). En el editor de Printful usa la herramienta de patrón/fondo con el módulo `designs/export/patrones/10-patron-b-oscuro-modulo.png` si prefieres que lo repita él; empalma sin costuras.
- [ ] **Posición:** Impresión integral — patrón (All-over / Pattern). Cubre todas las piezas (delantero, trasero, cinturilla).
- [ ] **Colores:** Integral
- [ ] **Tallas:** XS, S, M, L, XL, 2XL
- [ ] **Precio:** 55,00 € (coste estimado 23.00 € + envío 4.99 € → margen neto 44.9 %)
- [ ] **Tipo de producto en Shopify:** Shorts
- [ ] **Texto alternativo:** Patrón de calles de pista de atletismo en lima sobre negro con números
- [ ] **Handle en Shopify:** `shorts-patron-b`

## Gorra MAÑANA TAMBIÉN

- [ ] **Producto Printful:** Yupoong 6245CM — o, si no está, — Classic Dad Hat (Bordado)
- [ ] **Diseño:** 08 MAÑANA TAMBIÉN — versión para fondo **oscuro**
- [ ] **Archivo:** `designs/export/printful/gorra-manana-tambien-bordado_frontal.png` (1200×525 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Bordado frontal (Embroidery front)
- [ ] **Hilos:** blanco/hueso (#F4F1EA → elige el blanco de Printful más cercano). Printful convierte el PNG a puntadas: revisa la vista previa del bordado.
- [ ] **Colores:** Black
- [ ] **Tallas:** Única
- [ ] **Precio:** 35,00 € (coste estimado 14.50 € + envío 4.49 € → margen neto 45.6 %)
- [ ] **Tipo de producto en Shopify:** Gorra
- [ ] **Texto alternativo:** Bordado pequeño MAÑANA TAMBIÉN con punto rojo
- [ ] **Handle en Shopify:** `gorra-manana-tambien`

## Bolsa RESPIRA

- [ ] **Producto Printful:** All-Over Print Drawstring Bag — o, si no está, — Drawstring (Sublimación integral)
- [ ] **Diseño:** 11 RESPIRA — versión para fondo **oscuro**
- [ ] **Archivo:** `designs/export/printful/bolsa-respira-frontal.png` (4500×5100 px, 300 DPI, PNG transparente, con fondo negro porque es impresión integral)
- [ ] **Posición:** Frontal (Front), centrado, pegado arriba del área
- [ ] **Colores:** Integral
- [ ] **Tallas:** Única
- [ ] **Precio:** 39,00 € (coste estimado 16.50 € + envío 4.99 € → margen neto 43.2 %)
- [ ] **Tipo de producto en Shopify:** Bolsa
- [ ] **Texto alternativo:** RESPIRA con letras que se estiran en vertical, la A final en rojo
- [ ] **Handle en Shopify:** `bolsa-respira`

## Botella UN RATO MÁS

- [ ] **Producto Printful:** Stainless Steel Water Bottle — o, si no está, — Water Bottle (Impresión directa)
- [ ] **Nota:** Printful no tiene shaker de proteína en catálogo (a fecha de este trabajo): se sustituye por botella.
- [ ] **Diseño:** 02 UN RATO MÁS — versión para fondo **claro**
- [ ] **Archivo:** `designs/export/printful/botella-un-rato-mas-envolvente.png` (2850×1200 px, 300 DPI, PNG transparente)
- [ ] **Posición:** Envolvente (Wrap / Default)
- [ ] **Colores:** White
- [ ] **Tallas:** Única (500 ml aprox.)
- [ ] **Precio:** 45,00 € (coste estimado 17.50 € + envío 6.99 € → margen neto 42.5 %)
- [ ] **Tipo de producto en Shopify:** Botella
- [ ] **Texto alternativo:** Texto UN RATO en bloque y MÁS en rojo debajo
- [ ] **Handle en Shopify:** `botella-un-rato-mas`

## Después de subirlo todo

- [ ] En Shopify > Ajustes > Envíos: tarifa España 4,95 € y gratis desde 70 € (que coincida con la configuración del tema).
- [ ] Haz un pedido de prueba con un código de descuento del 100 % y cancélalo en Printful antes de que entre en producción, para comprobar que el pedido llega a Printful.
