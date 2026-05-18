# Garantía de Éxito FiestaGo — Borrador v0.1

> Este documento es el contrato emocional con el cliente. Define qué prometemos, qué no prometemos, y cómo lo cumplimos sin arruinarnos. Lo retomamos antes de programar nada.

---

## Por qué existe esta garantía

Bodas.net y compañía compiten por **catálogo y precio**. Nosotros no podemos ganar ahí en menos de 5 años. Lo que sí podemos ofrecer y ellos no se atreven es **respaldo económico real** si algo sale mal. Esa es nuestra diferenciación.

La promesa pública es:

> **Garantía de Éxito FiestaGo**
> Si tu proveedor te falla, lo arreglamos nosotros o te devolvemos el dinero. Sin letra pequeña abusiva, sin tirarte a teléfonos de soporte que no responden.

---

## Qué cubre — Fase 1 (lanzamiento, mes 1-3)

Empezamos **acotado** para poder cumplir 100% de las veces. Crecemos cuando tengamos datos.

| Escenario | Acción FiestaGo | Coste para FiestaGo |
|---|---|---|
| Proveedor cancela con **+7 días** del evento | Sustituto equivalente en 48h **o** devolución del 110% del importe pagado | Hasta 10% del booking |
| Proveedor **no aparece** el día del evento | Reembolso del 100% + compensación fija de 200€ | 100% + 200€ |
| Fuerza mayor del cliente (fallecimiento familiar 1er grado, hospitalización) | Aplazar el evento sin coste hasta 12 meses | 0€ (acuerdo con proveedor) |

### Lo que NO cubre (explícito, en home y emails)

- ❌ Lluvia, viento o clima en eventos al aire libre
- ❌ Insatisfacción subjetiva del cliente ("no me gustó cómo bailó el DJ")
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
- Concierge de boda opcional (persona humana asignada al evento).

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
- Cada categoría × ciudad principal (Madrid, Barcelona, Valencia, Sevilla, Bilbao, Málaga) tiene mínimo **3 proveedores marcados como `emergency_backup`** en la base de datos.
- Estos proveedores aceptan tarifa premium (+30%) por encargo last-minute, asumida por FiestaGo.
- Verificación reforzada antes de incluir uno (DNI + CIF + RC + 5 eventos previos sin incidencia).

---

## Coste financiero estimado

**Asunciones iniciales** (mes 1-3):
- Volumen: 100 reservas/mes
- Ticket medio: 1500 €
- Volumen procesado: 150 000 €/mes
- Tasa esperada de incidencias con coste: **2%** (2 incidencias/mes)
- Indemnización media: 1500 € (entre reembolso 110%, no-shows con 200€ extra y sustitutos pagados)

**Coste mensual estimado**: ~3 000 €/mes en garantías ejecutadas (2% del volumen).
**Comisión bruta estimada**: 150 000 × 8% = 12 000 €/mes.
**Margen neto antes de operativa**: ~9 000 €/mes (75% sostenible).

**Reserva de capital recomendada**: **15% del volumen procesado en escrow** durante los primeros 6 meses. Para 150k/mes son 22 500 € parados. Esto puede vivir en la cuenta de FiestaGo o, mejor, gestionarse vía Stripe Connect con `application_fee_amount` y delayed payouts.

**Plan B** desde el día 1: contratar **seguro de cancelación** con un broker. Coste fijo (~500-1000€/mes para arrancar) que cubre los casos catastróficos.

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
- [ ] UI en admin para marcar/desmarcar y filtrar
- [ ] Endpoint que devuelve los backups disponibles para `(category, city, date)`

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

Si tu proveedor te falla, te encontramos otro
o te devolvemos el 110% del importe.

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

1. ¿Empezamos con escrow vía Stripe Connect, o con cobro directo + reserva del 15% en cuenta separada de FiestaGo?
2. ¿Contratamos seguro desde el día 1 (~500€/mes fijos) o asumimos los primeros meses contra el balance?
3. ¿Tenemos abogado para revisar la letra pequeña antes del launch?
4. ¿Quién atiende las incidencias críticas la noche del sábado en el lanzamiento? (Sin alguien humano disponible, la garantía no es real.)

---

**Estado del documento**: borrador. Para editar y consensuar antes de empezar a programar.
**Última revisión**: por confirmar.
