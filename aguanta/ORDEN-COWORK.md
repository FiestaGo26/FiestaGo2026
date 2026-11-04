# ORDEN PARA CLAUDE COWORK: terminar y poner en marcha AGUANTA

Eres quien termina la puesta en marcha de **AGUANTA**, una marca de ropa deportiva con diseños propios que se vende en **Shopify** y se fabrica bajo demanda en **Printful**. La marca, los diseños, el catálogo, el tema de la tienda y todos los textos ya están hechos. Te queda lo que necesita acceso a **Printful** y al **panel de Shopify**, que la sesión anterior no tenía.

Trabaja en español (España). Sigue el orden. No me pidas confirmación en cada paso, **salvo en lo marcado con 🛑**: ahí paras y me preguntas.

---

## 0. Material de partida

- **Proyecto:** carpeta `aguanta/` de la rama `claude/aguanta-tienda` del repositorio GitHub `FiestaGo26/FiestaGo2026`.
  Si no lo tienes en local, descárgalo: `https://github.com/FiestaGo26/FiestaGo2026/archive/refs/heads/claude/aguanta-tienda.zip` y descomprímelo.
- **Lee primero:** `aguanta/LEEME.md` y `aguanta/DECISIONES.md`.
- **Fuente de verdad del catálogo:** `aguanta/catalogo/productos.mjs`. Ahí están los 10 productos base de Printful, sus costes, envíos, áreas de impresión, tallas, y las 14 fichas (producto base × diseño × colores).
- **Archivos listos para subir a Printful:** `aguanta/designs/export/printful/*.png`, uno por ficha y ya ajustado a la plantilla (índice en `indice.json`). Másteres en `aguanta/designs/export/`.
- **Checklist de subida por ficha:** `aguanta/catalogo/subida-manual.md`.
- **Textos:** `aguanta/copy/` (`productos.md`, `paginas/*.html`, `emails.md`, `titulares.md`, `faq.md`, `redes.md`).
- **Tema de la tienda (ZIP para subir sin terminal):** `aguanta/dist/aguanta-theme.zip`.
- **Logo:** solo la letra **A** con el pie izquierdo recortado en diagonal. Archivos en `aguanta/brand/logo/`. El nombre AGUANTA no forma parte del logo.

**Reglas que no se rompen**
- **Cero inventario y cero compra por adelantado.** Todo bajo demanda.
- **No inventes nada:** ni reseñas, ni cifras de ventas, ni testimonios, ni fotos. Mockups solo los del generador de Printful.
- **Donde haya diferencia entre los archivos del proyecto y Printful, manda Printful.** Anota cada diferencia.
- Tono de la marca: tuteo, frases cortas, humor seco. Prohibido "beast mode", "no pain no gain" y similares.
- 🛑 **No gastes dinero ni aceptes cargos** (muestras, dominio, apps de pago, plan de Shopify) sin preguntarme antes con el importe exacto.
- 🛑 **No publiques la tienda ni quites la contraseña** sin que yo lo diga.
- No toques pagos, impuestos ni datos fiscales: eso es mío (lo dejo en la lista del final).

---

## 1. Comprobar que tengo lo necesario

Antes de empezar, confirma que existe y está accesible:
1. Una tienda Shopify (dime cuál: `xxxx.myshopify.com`).
2. Una cuenta de Printful con la **app de Printful instalada y conectada a esa tienda**.

Si falta alguno, 🛑 para y dímelo. No los crees tú.

---

## 2. Verificar el catálogo en Printful (lo más importante)

Para **cada uno de los 10 productos base** de `BASES` en `catalogo/productos.mjs`, busca el producto en el catálogo **actual** de Printful (panel o API, con el mercado/moneda de España, EUR) y anota:

| Dato | Qué comprobar |
|---|---|
| Producto exacto | Nombre y modelo de Printful (p. ej. *Bella + Canvas 3001 Unisex Staple T-Shirt*). Si no existe o está descatalogado, propón el sustituto más parecido en calidad y anótalo. |
| Disponibilidad UE | Si se fabrica en Europa (España/Letonia) para envíos a España. Prioriza los que sí. |
| Coste base | Precio Printful **sin IVA** en EUR para la talla más barata, y si 2XL o más cuesta extra. |
| Técnica | DTG, sublimación integral, bordado… |
| Plantilla de impresión | Tamaño del archivo en px y DPI de cada posición que usamos (frontal, patrón integral, bordado frontal, envolvente). |
| Colores | Que existan los colores de cada ficha (`FICHAS[].colores`): Black, White, Heather Dust, Dark Grey Heather, Ivory, Bone, Sport Grey, Athletic Heather… Si no, el más parecido. |
| Tallas | Las de `tallas`. |
| Envío a España | Tarifa estándar de 1 unidad y de 2 unidades (Madrid, 28013) y plazo. |

**Casos concretos que hay que resolver:**
- **Camiseta técnica:** usamos algodón premium (Bella + Canvas 3001) porque el DTG en poliéster queda peor. Mira si Printful tiene ahora una camiseta deportiva de buena calidad que admita bien la impresión; si la hay, anótala como opción, pero no cambies la decisión sin consultarme.
- **Oversize:** Shaka Wear o Comfort Colors teñida en prenda; la que esté disponible y se fabrique en la UE.
- **Shaker:** comprueba si Printful vende ahora un **shaker de proteína**. Si existe, anótalo como alternativa a la botella. Si no, se queda la botella de acero.
- **Bolsa:** confirma la bolsa de cuerdas (drawstring) de impresión integral y su plantilla.

**Entregable de este paso:** `aguanta/catalogo/printful-verificado.md` con una tabla por producto (dato estimado → dato real) y la lista de sustituciones.

> Si puedes ejecutar comandos en mi ordenador (Node 20+): en `aguanta/` haz `npm install` y luego `PRINTFUL_TOKEN=<token> npm run printful:verificar` y `npm run printful:envios`. Hacen esta comprobación automáticamente y dejan `catalogo/printful-verificado.json`. Para el token: https://developers.printful.com/tokens 🛑 (pídeme que lo cree yo si hace falta iniciar sesión con mis credenciales).

---

## 3. Actualizar costes y precios

1. En `aguanta/catalogo/productos.mjs`, actualiza en cada base `costeBase`, `envio`, `areas`, y en las fichas los `colores` que cambien. Añade `verificado: true` a cada base comprobada. Si hay sustitución de producto, cambia también `printful.buscar`, `nombre` y `tejido`.
2. Recalcula precios:
   - **Con Node:** `npm run todo`. Regenera diseños, `precios.csv`, `subida-manual.md` y textos.
   - **Sin Node:** aplica la fórmula de `catalogo/precios.mjs` y actualiza `catalogo/precios.csv` a mano:
     - IVA 21 %, comisión de pago 1,5 % + 0,25 € (sobre el total cobrado), **margen neto objetivo ≥ 40 %** sobre el ingreso sin IVA.
     - Si el PVP queda por debajo de 70 €, el envío lo paga el cliente (4,95 €). Si el PVP llega a 70 € o más, el envío lo absorbemos y entra en el coste.
     - Redondea **hacia arriba** a euros enteros que acaben en 5 o en 9.
     - Fórmula: `PVP_sin_IVA = (coste + envío_absorbido + 0,25) / (1 − 0,40 − 0,015 × 1,21)` y `PVP = PVP_sin_IVA × 1,21`. Después comprueba que el margen real ≥ 40 %.
3. Si alguna **plantilla de impresión** de Printful no coincide con `areas`, los archivos de `designs/export/printful/` hay que regenerarlos (`npm run generar`, unos 2 min). Sin Node, sube el máster de `designs/export/` del diseño y escálalo **en el editor de Printful** sin deformar, centrado y pegado arriba del área. Anótalo.

---

## 4. Crear las 14 fichas en Printful y enviarlas a Shopify

Sigue `aguanta/catalogo/subida-manual.md` ficha a ficha. Para cada una:
1. Producto base correcto → **Add product** en la tienda Shopify conectada.
2. Sube el PNG indicado en la posición indicada. Comprueba que Printful **no da aviso de baja resolución** y que el diseño queda centrado arriba. En leggings y shorts, aplica el patrón a todas las piezas y comprueba que empalma en las costuras.
3. Solo los colores y tallas de la ficha.
4. Título = el de la ficha. **Descripción** = la de `copy/productos.md` (línea del diseño en negrita + descripción del producto base). **Precio** = PVP actualizado del paso 3, igual en todas las tallas salvo que Printful cobre más por 2XL o más (en ese caso, +2 € en esas tallas).
5. **Mockups:** genera en Printful un frontal sobre la prenda y uno de detalle o de modelo. Guárdalos también en `aguanta/designs/mockups/<handle>-1.jpg`, `-2.jpg`. Texto alternativo = el "Alt" de la ficha en `copy/productos.md`.
6. Envíalo a la tienda. En Shopify, revisa que el **handle** sea el de la ficha (p. ej. `camiseta-aguanta`) y pon el **tipo de producto** indicado (Camiseta, Camiseta oversize, Sudadera, Tirantes, Leggings, Shorts, Gorra, Bolsa, Botella): la guía de tallas desplegable del tema depende de eso.
7. Las fichas se quedan en **borrador** hasta el paso 8.

Gorra bordada: un solo hilo blanco/hueso sobre negro. Revisa la vista previa de puntadas de Printful. Si avisa de que algún trazo es demasiado fino, dímelo.

---

## 5. Subir y configurar el tema

1. **Shopify > Tienda online > Temas > Añadir tema > Subir archivo ZIP** → `aguanta/dist/aguanta-theme.zip`. Déjalo **sin publicar** y ábrelo en **Personalizar**.
2. **Configuración del tema:**
   - Marca: eslogan «Aguanta un rato más.», favicon (si no, usa el que trae), imagen para compartir = `brand/logo/aguanta-avatar-redes.png`, metadescripción por defecto (ya viene puesta).
   - Carrito y envíos: **envío gratis desde 70 €**, carrito tipo panel lateral.
   - Redes: Instagram/TikTok si ya existen las cuentas. Si no existen, déjalo vacío.
3. **Colección:** crea **Drop 01 — Aguanta** con handle `drop-01-aguanta` y plantilla **`collection.drop`**, añade las 14 fichas y pon la descripción: «Doce diseños para gente que entrena entre semana y lo cuenta el domingo. Se fabrican cuando los pides.». Metadescripción: la de «Drop 01» en `copy/titulares.md`.
4. **Páginas** (Tienda online > Páginas), con el contenido HTML de `copy/paginas/`:

   | Título | Handle | Plantilla | Contenido |
   |---|---|---|---|
   | Sobre AGUANTA | `sobre-aguanta` | `page.sobre` | `sobre-aguanta.html` |
   | Envíos y devoluciones | `envios-y-devoluciones` | `page.envios` | `envios-y-devoluciones.html` |
   | Guía de tallas | `guia-de-tallas` | `page.tallas` | `guia-de-tallas.html` |
   | Contacto | `contacto` | `page.contacto` | `contacto.html` |
   | Preguntas frecuentes | `preguntas-frecuentes` | `page.faq` | `preguntas-frecuentes.html` |

   Metadescripción de cada página: `copy/titulares.md`.
5. **Menús** (Tienda online > Navegación):
   - `main-menu`: Drop 01 → colección `drop-01-aguanta`; Todo → `/collections/all`; Sobre AGUANTA; FAQ.
   - `footer`: Envíos y devoluciones; Guía de tallas; Preguntas frecuentes; Contacto.
6. **Portada en el editor:**
   - Hero: producto destacado `camiseta-aguanta` y como imagen su mockup frontal de Printful, con el alt indicado.
   - Rejilla, Drop y «También aguanta» en la ficha: colección `drop-01-aguanta`.
   - «Imagen con texto»: sin foto real todavía, así que **ocúltala** o déjala sin imagen. No pongas fotos de stock.
7. **Guía de tallas:** compara las tablas de la plantilla `page.tallas` y de `theme/snippets/size-guide.liquid` con las medidas reales que da Printful para cada producto. Si difieren, corrige las de la página en el editor (bloques de la sección «Guía de tallas») y anota las diferencias del snippet para cambiarlas en código.
8. **Plazos** del bloque «Se fabrica para ti» (2–5 días producción, 3–5 envío España, 4–8 UE): ajústalos a lo que diga Printful para estos productos.

---

## 6. Envíos y notificaciones en Shopify

1. **Ajustes > Envío y entrega**, perfil general (o el de Printful si la app lo crea):
   - España (península y Baleares): **4,95 €** por debajo de 70 €, **gratis desde 70 €**.
   - **Canarias, Ceuta y Melilla: excluidas** de momento.
   - Resto de la UE: tarifas calculadas por Printful o una tarifa plana que cubra el envío real que anotaste en el paso 2. 🛑 Propónmela antes de activarla.
   - Si la app de Printful ofrece «tarifas en vivo», no la actives sin consultarme: rompe el «gratis desde 70 €».
2. **Ajustes > Notificaciones:** cambia el texto de *Confirmación de pedido*, *Confirmación de envío*, *Pedido entregado*, *Carrito abandonado*, *Pedido cancelado* y *Reembolso* por los de `copy/emails.md`. Solo el texto: no borres las variables `{{ … }}` ni los bloques de productos y totales. Envíate una prueba de cada una.

---

## 7. Comprobaciones antes de abrir

1. **Pedido de prueba:** crea un descuento del 100 % de un solo uso, haz un pedido de 1 camiseta, comprueba que **llega a Printful** con el archivo y la posición correctos y **cancélalo en Printful antes de que pase a producción**. 🛑 Si Printful pide pagar algo para procesarlo, para y pregúntame.
2. Recorre en el móvil: portada → colección → ficha (cambia de talla, abre la guía de tallas) → añadir → carrito lateral (sube y baja cantidad, mira la barra de envío gratis) → pago (sin pagar). Anota cualquier fallo.
3. **Lighthouse móvil** (PageSpeed Insights sobre la URL de vista previa del tema) en portada, colección y una ficha. Objetivo ≥ 85 en rendimiento. Apunta las cuatro notas.
4. Revisa que no haya ninguna cifra, reseña o testimonio inventado en ningún sitio.

---

## 8. Muestras 🛑

Propónme el pedido de muestras con el **coste exacto** (Printful suele tener descuento en muestras) y la dirección de envío, y espera mi OK:
- Camiseta AGUANTA, negra, talla M (DTG con mucho color).
- Leggings PATRÓN A, talla S o M (sublimación y el lima).
- Gorra MAÑANA TAMBIÉN (bordado pequeño).

---

## 9. Investigación de marca y dominio (solo informar, no registrar) 🛑

1. Busca **AGUANTA** en la **OEPM** (España) y en **TMview/EUIPO** (UE), clases **25** (ropa) y **35** (venta), y también variantes como «Aguanta Sport». Hazme un resumen: marcas parecidas, titular, clases, estado y riesgo que ves (bajo/medio/alto). No es asesoría legal: dilo así.
2. Comprueba si están libres `aguanta.es`, `aguanta.com`, `aguanta.shop`, `aguantaunratomas.com` y dos alternativas que propongas, con precio. **No compres nada.**
3. Comprueba si están libres `@aguanta` (o la variante más cercana) en Instagram y TikTok. **No crees cuentas.**

---

## 10. Contador del drop (opcional, solo con ventas reales)

El contador «Unidades vendidas» de la colección solo aparece si el metacampo de colección `custom.unidades_vendidas` tiene un valor real. No lo rellenes a mano con cifras inventadas. Cuando haya pedidos reales: con Node, `SHOPIFY_STORE=… SHOPIFY_ADMIN_TOKEN=… npm run contador` (instrucciones del token en `catalogo/contador-drop.mjs`); sin Node, mira las unidades vendidas de los productos de la colección en *Analíticas* y pon esa cifra en el metacampo.

---

## 11. Entrega

Cuando termines, deja **`aguanta/INFORME-COWORK.md`** con:
1. Lo que has hecho, paso a paso, con ✅ / ⚠️ / ❌.
2. La tabla de verificación de Printful (estimado → real) y las sustituciones.
3. Precios finales por ficha (coste, envío, PVP, margen).
4. Diferencias que has encontrado y cómo las has resuelto.
5. Notas de Lighthouse y fallos encontrados en la prueba.
6. Informe de marca/dominio/redes (paso 9).
7. **Lo que queda pendiente para mí**, como mínimo:
   - Configurar pagos (Shopify Payments), impuestos (IVA 21 % con precios IVA incluido, OSS para la UE) y datos fiscales; alta en ROI/VIES para que Printful no cobre IVA.
   - Textos legales: aviso legal, privacidad, condiciones, cookies.
   - Revisar la política de devoluciones con gestoría o abogado.
   - Aprobar muestras, dominio y, si procede, el registro de la marca.
   - Fotos reales para «Imagen con texto» y redes cuando lleguen las muestras.
   - Dar el OK para publicar la tienda y quitar la contraseña.

Si has cambiado archivos del proyecto (`productos.mjs`, `precios.csv`, `subida-manual.md`, mockups…), dime cuáles para subirlos al repositorio.
