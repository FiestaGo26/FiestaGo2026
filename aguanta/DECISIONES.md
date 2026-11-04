# DECISIONES

Lo que no venía definido en el encargo y he decidido yo, con el motivo. Si no estás de acuerdo con algo, casi todo se cambia en un solo sitio (lo indico).

## Proyecto y entorno

1. **Todo vive en `aguanta/` dentro del repositorio `fiestago2026`, en la rama `claude/aguanta-tienda`.** El repo ya contenía otro proyecto (FiestaGo, Next.js). Mezclar `/theme`, `/brand`… en su raíz habría ensuciado los dos. La estructura pedida (`/brand /designs /catalogo /theme /copy DECISIONES.md LEEME.md`) está tal cual, un nivel más abajo. Si prefieres un repo propio: `git subtree split -P aguanta -b aguanta-solo` y lo empujas a un repo nuevo.
2. **Printful no era accesible desde este entorno** (la red bloquea `printful.com` y `api.printful.com`). No he podido consultar el catálogo, los precios ni las plantillas en vivo. Por eso:
   - Los costes base, envíos y tamaños de plantilla de `catalogo/productos.mjs` son **estimaciones** según la guía pública de Printful tal como la conocía, y van marcados como `ESTIMADO - verificar con Printful` en `precios.csv`.
   - He dejado `catalogo/printful.mjs verificar`, que con tu token consulta el catálogo real, compara y te avisa de cada diferencia. **Manda Printful**: actualizas `productos.mjs`, y `precios.mjs` + `generate.mjs` recalculan todo.
3. **Shopify CLI 5.0.0** instalado globalmente para `shopify theme check` (0 incidencias). `shopify theme dev` necesita una tienda autenticada, así que no lo he podido ejecutar. Para revisar el tema sin tienda he hecho `preview/server.mjs`, que renderiza **los mismos archivos Liquid** con LiquidJS y datos de ejemplo.

## Marca y diseño

4. **Corte de la A:** chaflán recto que elimina el pie izquierdo (del 66 % de la altura al 30 % del ancho). Probé una franja que atravesaba la letra y, a tamaño pequeño, se confundía con el hueco de la A. El chaflán se lee bien desde 16 px.
5. **Isotipo para favicon:** A en lima sobre tinta (es la combinación con más contraste, 16,6:1, y la más reconocible a 16 px).
6. **Texto en trazados.** Todos los SVG de logo y diseños llevan las letras convertidas a trazados (opentype.js): no dependen de tener las fuentes instaladas y Printful los ve exactamente igual. Las fuentes (OFL) están en `fonts/` para regenerar.
7. **Másteres a 4500 × 5400 px (15 × 18 in a 300 DPI)** como pediste, y además **un archivo por producto ya encajado en la plantilla de Printful** (`designs/export/printful/`). Las plantillas reales de Printful suelen ser más pequeñas (p. ej. 3600 × 4800 en camisetas): el máster se reduce sin deformar, centrado y pegado arriba, que es como lo coloca Printful.
8. **Versión claro/oscuro:** «claro» = para prenda clara (tinta + rojo); «oscuro» = para prenda oscura (hueso + rojo; lima en patrones). En estampados integrales (patrones, bolsa) el fondo va incluido porque no hay prenda que se vea debajo.
9. **Patrones:** módulo sin costuras (1500 px el A, 1800 px el B) + lámina de 6000 × 6000. Comprobado que empalman en horizontal y vertical.
10. **Detalles de humor añadidos a los diseños:** «(Y LUEGO OTRO.)» en UN RATO MÁS; marcador AGUANTA 03 – SOFÁ 00 en DOMINGO DE SERIES; «PRODUCTO DEL ESFUERZO · COSECHA 2026 · CONSUMIR TRAS LA DUCHA» en SUDOR LOCAL; «FUNDADO UN DOMINGO CUALQUIERA» en FC AGUANTA; «*mentira, sí lo era.» en NO ERA TAN DURO. Coordenadas de KILÓMETRO CERO: Puerta del Sol, Madrid (40.4168° N, 3.7038° O).
11. **Rojo para texto pequeño:** el rojo de marca sobre hueso da 3,2:1 (no llega a AA en texto pequeño). Añadí `--rojo-texto: #C9270D` (4,9:1) solo para etiquetas y textos pequeños sobre claro. El rojo de marca se mantiene en titulares, fondos y sobre tinta.

## Catálogo

12. **14 fichas para 10 productos base.** Los productos con varios diseños (camiseta ×3, oversize ×2, sudadera con capucha ×2) se publican como fichas separadas. Así es como Printful sincroniza con Shopify (un producto de Printful por diseño), cada diseño tiene su URL para SEO y la rejilla tiene más que enseñar.
13. **Camiseta: algodón premium (Bella + Canvas 3001), no técnica.** El DTG sobre poliéster técnico sale apagado y se cuartea; en algodón queda mucho mejor. Para sudar en serio están leggings y shorts (poliéster elástico sublimado). La FAQ lo explica sin rodeos.
14. **Oversize:** Shaka Wear / Comfort Colors teñida en prenda (la que esté disponible). Verificar con `printful.mjs`.
15. **Shaker → botella de acero.** Printful no tenía shaker de proteína en su catálogo que yo conociera. Lo sustituyo por la botella de acero inoxidable con el diseño 2 en versión de una línea (envolvente).
16. **Bolsa → bolsa de cuerdas (gymsack) de impresión integral**, porque el formato vertical encaja con RESPIRA (diseño para espalda). Si prefieres mochila o bolsa de deporte, cambia `BASES.bolsa`.
17. **Gorra bordada sin rojo:** el bordado de MAÑANA TAMBIÉN va a un solo hilo (hueso) para que sea limpio y barato; el punto rojo se queda en la versión de pecho.
18. **Colores de prenda** (Black, White, Heather Dust, Ivory, Bone, Sport Grey…) elegidos por fondo de diseño. Una ficha = una versión del diseño, para no depender de "diseño distinto por color" en Printful.

## Precios

19. **Fórmula** (`catalogo/precios.mjs`): margen neto = (PVP sin IVA − coste Printful − envío absorbido − comisión de pago) / PVP sin IVA ≥ 40 %. IVA 21 %. Comisión Shopify Payments UE estimada 1,5 % + 0,25 € (compruébala en tu plan). Redondeo hacia arriba a euros con final 5 o 9.
20. **Envío:** el cliente paga 4,95 € por debajo de 70 €; desde 70 €, gratis. Si un PVP supera el umbral por sí solo, el precio absorbe el envío. `precios.csv` muestra también el **margen en el peor caso** (envío gratis de un pedido de una unidad), que baja al 25–37 %: es el coste de ofrecer envío gratis. Si quieres proteger más el margen, sube el umbral en `AJUSTES.envioGratisDesde` y en la configuración del tema (los dos sitios).
21. **Umbral de envío gratis: 70 €.** Con camisetas a 29 € obliga a 3 piezas o a una sudadera + algo, que es lo que sube el ticket medio sin regalar el envío en pedidos pequeños.
22. **Costes sin IVA.** Asumo que te das de alta en el ROI (VIES) para que Printful (Letonia) te facture sin IVA por inversión del sujeto pasivo. Si no lo haces, Printful te cobra el IVA y el margen real baja: consúltalo con tu gestoría.

## Tienda

23. **Contador del drop sin cifras inventadas.** Lee dos metacampos de la colección: `custom.unidades_vendidas` (y opcional `custom.unidades_objetivo`). Si no tienen valor, el contador no se pinta. Se alimenta con `catalogo/contador-drop.mjs`, que suma las unidades de pedidos pagados reales vía Admin API y nunca resta (lo ejecutas a mano o programado; ver `LEEME.md`). Elegí script en vez de Shopify Flow porque Flow no tiene una acción nativa sencilla para incrementar metacampos de colección. La vista previa local no muestra cifras salvo que se lancen a mano para revisar el diseño (`DROP_VENDIDAS=…`).
24. **Carrito lateral con la Section Rendering API** (`/cart/add.js` + `sections=cart-drawer`): sin librerías, se actualiza el HTML del panel con el render real de Shopify. Si se desactiva JS, todo funciona como formulario normal hacia `/cart`.
25. **Guía de tallas:** prioridad al metacampo de producto `custom.guia_tallas` (texto enriquecido); si no existe, tabla genérica según el *tipo de producto* (Camiseta, Sudadera, Leggings, Shorts…). Las medidas son orientativas y hay que confirmarlas con la ficha de cada producto en Printful.
26. **Plazos mostrados:** 2–5 días de producción, 3–5 envío España, 4–8 UE. Editables por bloque en la ficha.
27. **Canarias, Ceuta y Melilla fuera de momento** (fuera del IVA UE: aduanas e IGIC/IPSI). Lo dice la FAQ y la página de envíos. Cuando quieras abrirlo, es una zona de envío más en Shopify y un párrafo de texto.
28. **Devoluciones: 14 días de desistimiento.** Los productos no son personalizados por el cliente (todos llevan el mismo diseño), así que no aplica la excepción de productos personalizados del art. 103 de la Ley de Consumidores. Printful no acepta devoluciones por talla, así que la devolución va a tu dirección: el envío de vuelta lo paga el cliente salvo error nuestro. Que lo revise un abogado o tu gestoría antes de publicar.
29. **Idioma:** solo español (es.default). La UE llegará después: añadir `en.json` y Shopify Translate & Adapt.
30. **Sin apps de reseñas ni testimonios.** No hay sección de reseñas hasta que haya reseñas reales.
31. **Rendimiento:** CSS 27 KB y JS 11 KB sin minificar, cero librerías, fuentes autoalojadas (4 woff2, latín), imágenes con `srcset` y `loading=lazy` salvo la del hero (con `fetchpriority=high`). En la vista previa local, Lighthouse móvil: 97–100 en rendimiento, 100 en accesibilidad, 100 en buenas prácticas y SEO. **En Shopify bajará algo** por los scripts que inyecta `content_for_header` (analítica, apps): vuelve a medirlo con la tienda real.
32. **Imágenes de la vista previa:** son el diseño sobre el color de la prenda, no fotos ni mockups. En la tienda real van los mockups del generador de Printful (`printful.mjs mockups` o el panel).
