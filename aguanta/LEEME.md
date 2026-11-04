# AGUANTA — LÉEME

Marca de ropa deportiva con diseños propios, vendida en **Shopify** y fabricada bajo demanda por **Printful**. Cero inventario.

```
aguanta/
├── brand/        logo (SVG positivo, negativo, monocromo, isotipo, favicon), paleta.md, guia-de-marca.md
├── designs/      generate.mjs (un comando lo regenera todo), src/*.svg, export/*.png, export/printful/, export/patrones/
├── catalogo/     productos.mjs (fuente de verdad), precios.csv, subida-manual.md, printful.mjs, contador-drop.mjs
├── theme/        tema Shopify OS 2.0 propio (Liquid)
├── copy/         titulares, productos, páginas, FAQ, emails, ideas para redes
├── preview/      vista previa local del tema sin tienda (datos de ejemplo)
├── fonts/        Anton + Space Grotesk (OFL) para generar los diseños
├── DECISIONES.md lo que he decidido yo y por qué
└── LEEME.md      esto
```

---

## Estado

| Criterio | Estado |
|---|---|
| `node designs/generate.mjs` genera los 12 diseños sin errores | ✅ 78 archivos (24 másteres 4500×5400 a 300 DPI claro/oscuro, patrones, archivos por producto, logos), ~100 s |
| `shopify theme check` sin errores | ✅ 70 archivos, 0 incidencias (Shopify CLI 5.0.0) |
| `shopify theme dev` con datos de ejemplo | ⏳ **Necesita tu tienda** (no puedo autenticarme). Mientras, `npm run preview` muestra el mismo tema renderizado en local con los 14 productos de ejemplo. Lighthouse móvil en esa vista previa: rendimiento 97–100, accesibilidad 100, buenas prácticas 100, SEO 100. |
| Los 10 productos tienen archivo, PVP y margen | ✅ 14 fichas sobre 10 productos base: `catalogo/precios.csv`, `designs/export/printful/`. ⚠️ **Costes estimados**: Printful no era accesible desde aquí; se verifican con tu token (paso 4). |
| Lista de pasos manuales | ✅ abajo |

---

## Puesta en marcha (en este orden)

### 0. Requisitos en tu ordenador
- Node 20 o superior.
- Shopify CLI: `npm install -g @shopify/cli`
- Dentro de `aguanta/`: `npm install`

### 1. Mira la tienda en local (sin cuentas)
```bash
npm run preview        # http://localhost:4545
```
Navega portada, colección, ficha, carrito lateral y páginas. Las imágenes son los diseños sobre el color de la prenda, no fotos.

### 2. Crea las cuentas (tú) — ver lista de pendientes, puntos 1 y 5
Tienda Shopify (o una *development store* desde Shopify Partners para probar gratis), cuenta Printful, app de Printful instalada en Shopify.

### 3. Sube el tema
```bash
shopify auth logout          # por si había otra sesión
cd theme
shopify theme dev --store tu-tienda.myshopify.com    # vista en vivo con tus datos
shopify theme push --unpublished                    # súbelo como tema sin publicar
```
En la tienda de desarrollo, para ver la tienda llena antes de tener los productos de Printful: **Productos > Importar > `catalogo/shopify-ejemplo.csv`** (se crean en borrador; publícalos y bórralos cuando lleguen los de Printful). Las imágenes del CSV apuntan a `raw.githubusercontent.com` y **solo cargan si el repo es público**; si no, ejecuta `IMG_BASE=https://tu-url-publica node catalogo/documentos.mjs` o súbelas a mano desde `preview/img/`.

### 4. Verifica Printful y recalcula precios
1. Crea un token en <https://developers.printful.com/tokens> (permisos de catálogo, mockups y productos de tienda).
2. ```bash
   PRINTFUL_TOKEN=xxx npm run printful:verificar   # catálogo, costes, plantillas, colores
   PRINTFUL_TOKEN=xxx npm run printful:envios      # tarifas reales a España
   ```
3. Copia lo que difiera a `catalogo/productos.mjs` (`costeBase`, `envio`, `areas`, colores), pon `verificado: true` en cada base y:
   ```bash
   npm run todo          # regenera diseños, precios.csv, subida-manual.md y copys
   ```

### 5. Crea los productos en Printful
La API de Printful no permite crear productos en tiendas Shopify, así que se hace en su panel siguiendo **`catalogo/subida-manual.md`** (14 fichas: producto base, archivo, posición, colores, tallas, PVP, alt). Mockups: los del propio Printful al crear el producto, o `FILES_BASE_URL=… PRINTFUL_TOKEN=… npm run printful:mockups`.

### 6. Configura Shopify
- **Colección** `Drop 01 — Aguanta`, handle `drop-01-aguanta`, plantilla **`collection.drop`**. Añade las 14 fichas.
- **Páginas** (Tienda online > Páginas): crea cada una con este handle y esta plantilla y pega el HTML de `copy/paginas/`:

  | Título | Handle | Plantilla | Contenido |
  |---|---|---|---|
  | Sobre AGUANTA | `sobre-aguanta` | `page.sobre` | `copy/paginas/sobre-aguanta.html` |
  | Envíos y devoluciones | `envios-y-devoluciones` | `page.envios` | `copy/paginas/envios-y-devoluciones.html` |
  | Guía de tallas | `guia-de-tallas` | `page.tallas` | `copy/paginas/guia-de-tallas.html` |
  | Contacto | `contacto` | `page.contacto` | `copy/paginas/contacto.html` |
  | Preguntas frecuentes | `preguntas-frecuentes` | `page.faq` | `copy/paginas/preguntas-frecuentes.html` (las 12 preguntas ya están en la plantilla) |
- **Menús** (Navegación): `main-menu` → Drop 01, Todo, Sobre AGUANTA, FAQ. `footer` → Envíos y devoluciones, Guía de tallas, Preguntas frecuentes, Contacto.
- **Tipo de producto** en cada ficha (Camiseta, Camiseta oversize, Sudadera, Tirantes, Leggings, Shorts, Gorra, Bolsa, Botella): lo usa la guía de tallas desplegable.
- **Envíos**: España 4,95 €, gratis desde 70 € (si cambias el umbral, cámbialo también en *Personalizar > Configuración del tema > Carrito y envíos* y en `AJUSTES.envioGratisDesde`). Excluye Canarias, Ceuta y Melilla o configúralas aparte.
- **Notificaciones**: pega los textos de `copy/emails.md`.
- **Editor del tema**: en el hero elige el producto destacado y sube su mockup; en «Imagen con texto», una foto tuya real. Todos los textos, colores de sección y bloques se cambian ahí.
- **Preferencias**: metadescripción de la portada y redes sociales (Configuración del tema > Marca / Redes). Metadescripciones del resto en `copy/titulares.md`.

### 7. Contador del drop (opcional, solo con ventas reales)
```bash
SHOPIFY_STORE=tu-tienda.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx npm run contador
```
Crea los metacampos de colección y guarda las unidades vendidas reales. Mientras sea 0, el contador no aparece. Si quieres barra de progreso, rellena a mano el metacampo *Unidades objetivo* de la colección. Ejecútalo cuando quieras (a mano o programado).

### 8. Antes de abrir
- Pedido de prueba con descuento del 100 % → comprueba que llega a Printful → cancélalo allí antes de producción.
- Lighthouse móvil sobre la tienda real (objetivo ≥ 85).
- Quita la contraseña de la tienda.

---

## Pendiente de hacer por ti (no lo he intentado)

1. [ ] **Crear la tienda Shopify y la cuenta de Printful, e instalar la app de Printful** en Shopify.
2. [ ] **Autenticar Shopify CLI** (`shopify theme dev --store …` te abre el navegador) y, si quieres los scripts, **crear el token de la API de Printful** y el token de Admin API de Shopify (solo para el contador).
3. [ ] **Pedir muestras de 2–3 productos** antes de lanzar. Propongo: camiseta AGUANTA (negra, DTG con mucho color), leggings PATRÓN A (sublimación + lima) y gorra MAÑANA TAMBIÉN (bordado pequeño). Printful tiene descuento en pedidos de muestra.
4. [ ] **Registrar el dominio** y **comprobar que AGUANTA está libre como marca** en la OEPM (España) y la EUIPO (UE), clases 25 (ropa) y 35 (venta online) como mínimo, **antes de gastar en publicidad**. «Aguanta» es una palabra común: es probable que haya marcas parecidas; mira también variantes como «Aguanta Sport».
5. [ ] **Configurar pagos, impuestos y datos fiscales**: Shopify Payments (o el que elijas), IVA 21 % con precios IVA incluido, alta en el ROI/VIES para que Printful no te cobre IVA (ver `DECISIONES.md` punto 22), ventanilla única OSS cuando vendas a otros países de la UE, aviso legal, privacidad y condiciones (Shopify tiene generador; revísalos).
6. [ ] **Revisar con tu gestoría o un abogado** la política de devoluciones (14 días de desistimiento, `copy/paginas/envios-y-devoluciones.html`).
7. [ ] **Sustituir los costes estimados** por los reales (paso 4) antes de publicar precios.
8. [ ] **Fotos reales** para «Imagen con texto» y redes cuando tengas las muestras. No hay fotos inventadas ni reseñas en la tienda.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run generar` | 12 diseños (claro/oscuro), patrones, archivos por producto, logos, favicon, imágenes de la vista previa |
| `npm run generar:rapido` | Igual, con láminas de patrón más pequeñas |
| `npm run precios` | Recalcula `catalogo/precios.csv` |
| `npm run documentos` | Regenera `subida-manual.md`, `shopify-ejemplo.csv`, `copy/productos.md` y la FAQ del tema |
| `npm run todo` | Las tres cosas |
| `npm run preview` | Vista previa local en http://localhost:4545 |
| `npm run theme:check` | `shopify theme check` |
| `npm run theme:dev` / `theme:push` | Shopify CLI sobre `theme/` |
| `npm run printful:verificar` / `envios` / `mockups` | Printful (necesita `PRINTFUL_TOKEN`) |
| `npm run contador` | Contador del drop con ventas reales |

Para cambiar un diseño: edita su función en `designs/designs.mjs` y `npm run generar`. Para cambiar un producto, precio objetivo o umbral de envío: `catalogo/productos.mjs` y `npm run todo`.
