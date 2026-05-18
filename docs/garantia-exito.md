# Garantía de Éxito FiestaGo — Borrador v0.2

> Este documento es el contrato emocional con el cliente. Define qué prometemos, qué no prometemos, y cómo lo cumplimos sin arruinarnos. Lo retomamos antes de programar nada.
>
> **Alcance del producto**: FiestaGo no es solo bodas. Cubre cualquier celebración o evento privado — bodas, bautizos, comuniones, cumpleaños (infantiles y adultos), aniversarios, despedidas, eventos corporativos privados, fiestas temáticas, baby showers, etc. La garantía aplica igual a todos los tipos, ajustando importes según el ticket de la reserva.

---

## Por qué existe esta garantía

Bodas.net y las grandes plataformas compiten por **catálogo y precio**, y solo cubren el segmento boda. Nosotros no podemos ganarles a precio en menos de 5 años, pero podemos ofrecer:

1. **Cobertura de todo tipo de eventos**, no solo bodas (los grandes están especializados y los clientes no saben dónde reservar un mago para un cumple).
2. **Respaldo económico real** si algo sale mal, que ellos no se atreven a dar.

La promesa pública es:

> **Garantía de Éxito FiestaGo**
> Sea cual sea tu celebración, si tu proveedor te falla, lo arreglamos nosotros o te devolvemos el dinero. Sin letra pequeña abusiva, sin esperas en teléfonos de soporte.

---

## Qué cubre — Fase 1 (lanzamiento, mes 1-3)

Empezamos **acotado** para poder cumplir 100% de las veces. Crecemos cuando tengamos datos.

| Escenario | Acción FiestaGo | Coste para FiestaGo |
|---|---|---|
| Proveedor cancela con **+7 días** del evento | Sustituto equivalente en 48h **o** devolución del 110% del importe pagado | Hasta 10% del booking |
| Proveedor **no aparece** el día del evento | Reembolso del 100% + compensación fija (escalonada según ticket, ver tabla abajo) | 100% + extra fijo |
| Fuerza mayor del cliente (fallecimiento familiar 1er grado, hospitalización) | Aplazar el evento sin coste hasta 12 meses | 0€ (acuerdo con proveedor) |

### Compensación fija por no-show escalonada según ticket

Para que la compensación sea proporcional al estrés y al tipo de evento:

| Ticket de la reserva | Compensación extra por no-show |
|---|---|
| < 300 €  | 50 € |
| 300–1 500 € | 150 € |
| 1 500–5 000 € | 300 € |
| > 5 000 € (típico bodas) | 500 € |

### Lo que NO cubre (explícito, en home y emails)

- ❌ Lluvia, viento o clima en eventos al aire libre
- ❌ Insatisfacción subjetiva del cliente ("no me gustó cómo bailó el DJ", "el mago no era gracioso")
- ❌ Cambios pedidos por el cliente fuera del alcance contratado
- ❌ Daños causados por invitados
- ❌ Reclamaciones posteriores a 14 días del evento
- ❌ Eventos sin reserva confirmada y pagada por FiestaGo

---

## Qué cubre — Fase 2 (mes 4-6, si todo va bien)

Añadimos cuando tengamos al menos 50 eventos completados sin incidencias mal gestionadas:

| Escenario nuevo | Acción FiestaGo |
|---|---|
| Proveedor cancela con **<7 días** del evento | Sustituto urgente + 50% extra de compensación al cliente |
| Calidad **objetivamente inferior** a lo prometido (no entrega producto, llega tarde >2h, no tiene los items contratados) | Compensación calculada según el incumplimiento, con prueba documental |

---

## Qué cubre — Fase 3 (mes 7+)

Cuando estemos generando ~50k€/mes de comisión:

- Cobertura completa con seguro de responsabilidad civil contratado con broker (Hiscox / Caser).
- Garantía aumentada a 150-200% para casos extremos.
- Concierge de evento opcional (persona humana asignada a celebraciones de >3 000€).

---

## Cómo se ejecuta — operativa

### Lo que el cliente hace
1. Reporta la incidencia en su panel `/mi-cuenta` → botón **"Reportar incidencia"** en la reserva.
2. Sube prueba si aplica (foto, mensajes del proveedor, factura externa).
3. FiestaGo revisa en **24h** (4h si es la semana del evento).

### Lo que FiestaGo hace
1. Verifica la incidencia contra los criterios objetivos.
2. Comunica con el proveedor implicado (chat in-app + email + llamada si toca).
3. **Si aplica garantía**: ejecuta la acción automáticamente (Stripe refund, búsqueda de sustituto en el pool de emergencia, transferencia compensatoria).
4. Cierra el caso con email final al cliente y al proveedor.

### Pool de proveedores de emergencia
- **Por cada categoría × ciudad principal** (Madrid, Barcelona, Valencia, Sevilla, Bilbao, Málaga) — y por cada tipo de evento principal — mínimo **3 proveedores marcados como `emergency_backup`**.
- Categorías más críticas por tipo de evento:
  - **Bodas**: fotografía, catering, espacios, música.
  - **Comuniones / bautizos**: catering, fotografía, espacios, animación.
  - **Cumpleaños infantil**: animación, catering, decoración, magos.
  - **Cumpleaños adulto / despedidas**: música, catering, cocteleros.
  - **Eventos corporativos privados**: catering, espacios, técnico de audio.
  - **Fiestas en casa**: catering pequeño, DJ, decoración, fotomatón.
- Estos proveedores aceptan tarifa premium (+30%) por encargo last-minute, asumida por FiestaGo.
- Verificación reforzada antes de incluir uno (DNI + CIF + RC + 5 eventos previos sin incidencia).

---

## Coste financiero estimado

**Asunciones iniciales** (mes 1-3) con mix realista de tipos de evento:

| Tipo evento | % del volumen | Ticket medio | Tasa incidencia | Indemniz. media |
|---|---|---|---|---|
| Bodas              | 25% | 15 000 € | 2% | 3 000 € |
| Comuniones/bautizos| 20% | 3 500 €  | 2% | 700 € |
| Cumpleaños adulto  | 25% | 800 €    | 3% | 200 € |
| Cumpleaños infantil| 15% | 400 €    | 3% | 100 € |
| Despedidas/corp/otros | 15% | 1 200 € | 2% | 300 € |

- **Ticket medio ponderado**: ~4 200 €
- **Tasa media de incidencia**: ~2.4%
- **Indemnización media ponderada**: ~1 000 €

**Si hacemos 100 reservas/mes**:
- Volumen procesado: ~420 000 €/mes
- Coste medio en garantías: ~2 400 €/mes (~0.6% del volumen)
- Comisión bruta: 420k × 8% = 33 600 €/mes
- Margen neto antes de operativa: ~31 000 €/mes (93% sostenible)

> Nota: el ticket medio ponderado puede ser más bajo que estos 4 200 € si el mix se inclina a fiestas pequeñas. Las cifras se revisan trimestralmente con datos reales.

**Reserva de capital recomendada**: **10-12% del volumen procesado** en escrow durante los primeros 6 meses (más bajo que la estimación inicial porque la tasa de coste medio es ~0.6% del volumen).

**Plan B** desde el día 1: contratar **seguro de cancelación** con un broker. Coste fijo (~500-1000€/mes para arrancar) que cubre los casos catastróficos (no-show en evento de 25k€).

---

## Roadmap técnico (lo que programamos)

### Bloque A — Cobros y escrow (~3 días)
- [ ] Integrar Stripe Connect Express para que cada proveedor tenga su cuenta conectada
- [ ] Configurar `application_fee_amount` con la comisión FiestaGo
- [ ] Retención del payout al proveedor hasta `event_date + 7 días` (delayed transfer)
- [ ] Endpoint para emitir refund desde admin con un click

### Bloque B — Sistema de incidencias (~1.5 días)
- [ ] Tabla `incidents` con `booking_id`, `type`, `status`, `reported_at`, `evidence_urls`, `resolution`, `compensation_amount`
- [ ] UI en `/mi-cuenta` → botón **"Reportar incidencia"** por reserva
- [ ] UI en admin → tab **"Incidencias"** con SLA visible (verde <4h, ámbar <24h, rojo +24h)
- [ ] Email al admin al abrir incidencia + recordatorio cada 4h hasta resolver

### Bloque C — Pool de emergencia (~0.5 días)
- [ ] Columna `emergency_backup boolean` en `providers`
- [ ] UI en admin para marcar/desmarcar y filtrar por (categoría × ciudad × tipo de evento)
- [ ] Endpoint que devuelve los backups disponibles para `(category, city, date, event_type)`

### Bloque D — Comunicación de la promesa (~0.5 días)
- [ ] Sección destacada en home: hero secundario con la promesa
- [ ] Badge "🛡 Garantía de Éxito" en cada ficha de proveedor
- [ ] Línea en email de confirmación de reserva: *"Esta reserva está cubierta por la Garantía de Éxito"*
- [ ] Página dedicada `/garantia-exito` con detalles completos

---

## Copy de marketing

### Home (hero secundario)

```
🛡  Garantía de Éxito

Para tu boda, comunión, cumpleaños o cualquier celebración.
Si tu proveedor te falla, te encontramos otro o te devolvemos
el 110% del importe.

Sin letra pequeña. Sin esperas en soporte.

[Ver detalles] [Buscar proveedor]
```

### Badge en ficha (junto al sello "Verificado")

```
🛡 Cubierto por Garantía de Éxito FiestaGo
```

### Email de confirmación

```
✓ Tu reserva está cubierta por la Garantía de Éxito.
Si [Proveedor] cancela o no aparece, lo arreglamos
en 48h o te devolvemos el 110%.
```

---

## Letra pequeña a redactar (consulta con abogado antes del launch)

- Definir "incidencia cubierta" con criterios objetivos.
- Definir el plazo de reclamación (sugerencia: 14 días tras evento).
- Definir el procedimiento de prueba (testigos, fotografías, etc).
- Limitación de responsabilidad por evento (sugerencia: cap del 200% del importe).
- Resolución de disputas (mediación → arbitraje → tribunales).
- Cláusula de fuerza mayor (eventos imprevisibles).

**Importante**: la garantía solo aplica si la reserva se ha hecho **íntegramente a través de FiestaGo** (canal, pago, comunicación). Si hay pagos por fuera, salta. Esto es lo que protege el modelo.

---

## Preguntas abiertas para retomar mañana

1. ¿Empezamos con escrow vía Stripe Connect, o con cobro directo + reserva del 10-12% en cuenta separada de FiestaGo?
2. ¿Contratamos seguro desde el día 1 (~500€/mes fijos) o asumimos los primeros meses contra el balance?
3. ¿Tenemos abogado para revisar la letra pequeña antes del launch?
4. ¿Quién atiende las incidencias críticas la noche del sábado en el lanzamiento? (Sin alguien humano disponible, la garantía no es real.)
5. **Mix esperado de tipos de evento** en el lanzamiento: ¿el reparto que asumo (25% bodas, 20% comuniones, 25% cumple adulto, etc.) es realista, o el plan de captación se enfoca más a un nicho concreto al principio?

---

**Estado del documento**: borrador v0.2 — ampliado a todos los tipos de evento, no solo bodas. Para editar y consensuar antes de empezar a programar.
**Última revisión**: por confirmar.
