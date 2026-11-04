# Emails transaccionales (texto)

Para pegar en **Shopify > Ajustes > Notificaciones**. Cambia solo el texto: deja las variables Liquid (`{{ … }}`) y los bloques de productos/totales que trae la plantilla de Shopify. Tuteo siempre. Asuntos ≤ 50 caracteres.

---

## 1. Confirmación de pedido
**Asunto:** `Pedido {{ name }} recibido. Ahora toca esperar un poco`

**Previsualización:** Lo empezamos a fabricar ya mismo.

> Hola, {{ customer.first_name | default: "campeón de domingo" }}:
>
> Tenemos tu pedido **{{ name }}**. Gracias por fiarte de una marca que todavía no tiene almacén.
>
> **Qué pasa ahora**
> 1. **Se fabrica.** Tu ropa no existía hasta hace un minuto. Ahora se imprime (o se borda) solo para ti: 2–5 días laborables.
> 2. **Se envía.** Cuando salga del taller te llega otro correo con el número de seguimiento.
> 3. **Te llega.** 3–5 días laborables en España, 4–8 en el resto de la UE.
>
> Si pides varias cosas pueden llegar en paquetes separados: se fabrican donde mejor salen. No pagas más por eso.
>
> **¿Te has equivocado de talla?** Escríbenos *ya*, contestando a este correo. Mientras no haya entrado en producción, lo cambiamos.
>
> *[bloque de productos y totales de Shopify]*
>
> Aguanta un rato más.
> — AGUANTA

---

## 2. Pedido en producción (opcional, Shopify Flow o app de email)
**Asunto:** `Tu pedido ya está en el taller`

> {{ customer.first_name }}, ya están con lo tuyo. Esta parte no se puede acelerar, pero tampoco se puede parar: a partir de aquí, el cambio de talla es por devolución. Te avisamos cuando salga.

---

## 3. Envío confirmado
**Asunto:** `Ha salido. {{ name }} va de camino`

> Hola, {{ customer.first_name }}:
>
> Tu pedido **{{ name }}** ya ha salido del taller.
>
> **Seguimiento:** {{ fulfillment.tracking_company }} · {{ fulfillment.tracking_numbers | join: ", " }}
> *[botón de seguimiento de Shopify]*
>
> Suele tardar 3–5 días laborables en España. Si en 48 horas el seguimiento no se mueve, contesta a este correo.
>
> **Para que aguante:** lávala del revés, en frío y sin secadora. El estampado te lo agradecerá.
>
> — AGUANTA

---

## 4. Pedido entregado
**Asunto:** `¿Qué tal te queda?`

> Ya la tienes. Si te queda bien, estréname sudada. Si algo ha llegado mal (estampado, costura, talla equivocada por nuestra culpa), mándanos una foto contestando a este correo y te enviamos otra. Tienes 30 días.
>
> Y si te apetece enseñarla, etiqueta a @aguanta. Te la compartimos. Las fotos de gimnasio con mala luz son las mejores.

---

## 5. Carrito abandonado
**Asunto:** `Te has dejado algo. Aguanta, que ya casi`

> Lo dejaste en el carrito. No pasa nada: a todos nos ha pasado con la última serie.
>
> Sigue ahí, esperándote. Recuerda que se fabrica cuando lo pides, así que cuanto antes, antes te llega.
>
> *[bloque de productos + botón "Terminar el pedido"]*

---

## 6. Pedido cancelado
**Asunto:** `Pedido {{ name }} cancelado`

> Hecho: hemos cancelado el pedido **{{ name }}**{% if financial_status == 'refunded' %} y te devolvemos {{ total_price | money }} por el mismo medio de pago (de 5 a 10 días, depende de tu banco){% endif %}.
>
> Si no lo has pedido tú, contesta a este correo y lo miramos.

---

## 7. Reembolso
**Asunto:** `Te hemos devuelto el dinero`

> Ya está: hemos devuelto **{{ refund.amount | default: total_price | money }}** a tu método de pago. Puede tardar unos días en aparecer, según tu banco. Gracias por la paciencia. La próxima, a la primera.
