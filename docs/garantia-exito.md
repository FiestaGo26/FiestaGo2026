# Garantía de Éxito FiestaGo — Borrador v0.3

> Este documento es el contrato emocional con el cliente. Define qué prometemos, qué no prometemos, y cómo lo cumplimos de forma económicamente sostenible.
>
> **Cambio clave v0.3**: el dinero de la compensación lo paga el proveedor que falla, no FiestaGo. FiestaGo solo media, adelanta al cliente y descuenta del payout del proveedor. Antes asumíamos demasiado de nuestro bolsillo y era insostenible.
>
> **Alcance del producto**: FiestaGo cubre cualquier celebración o evento privado — bodas, bautizos, comuniones, cumpleaños, aniversarios, despedidas, eventos corporativos privados, fiestas temáticas, baby showers, etc.

---

## Principio rector

**Paga el que falla**. Si el proveedor incumple, el proveedor asume el coste de reparar al cliente. FiestaGo adelanta el dinero al cliente para que no espere, y luego descuenta del payout del proveedor (o cobra directamente si no tiene payouts suficientes). Esto es lo que hace Airbnb con sus hosts, Booking con sus hoteles y Uber con sus drivers — es el único modelo que escala.

FiestaGo solo asume pérdida en dos casos:
1. **Proveedor desaparece o se niega a pagar**. Entonces adelantamos al cliente para preservar la marca y perseguimos al proveedor por vía legal.
2. **Coste operativo** de mediación, búsqueda de sustituto, etc. (no incluye compensaciones económicas).

---

## Cobertura — Fase 1 (lanzamiento, mes 1-3)

| Escenario | Cliente recibe | Proveedor paga | FiestaGo pone |
|---|---|---|---|
| Proveedor cancela con **+7 días** y encontramos sustituto | Su evento gestionado | El no cobra (no devengado) | 0 € + gestión |
| Proveedor cancela con **+7 días** y NO encontramos sustituto | Reembolso 100% del importe pagado | El no cobra | 0 € + gestión |
| Proveedor cancela con **<7 días** | Reembolso 100% + compensación fija (ver tabla) | 100% + compensación entera | 0 € + gestión |
| Proveedor **no se presenta** el día del evento | Reembolso 100% + compensación fija (ver tabla) | 100% + compensación entera | 0 € + gestión |
| Fuerza mayor del cliente (fallecimiento familiar 1er grado, hospitalización) | Aplazar evento sin coste 12 meses | Acuerdo de fechas con el proveedor | 0 € |

### Tabla de compensación fija (no-show o cancelación <7d)

La paga íntegramente el proveedor. El cliente la recibe encima del reembolso del 100%.

| Ticket de la reserva | Compensación al cliente |
|---|---|
| Hasta 500 €    | **300 €** |
| 500–2 000 €    | **500 €** |
| 2 000–5 000 €  | **1 000 €** |
| 5 000–15 000 € | **2 000 €** |
| Más de 15 000 € | **3 000 €** |

### Ejemplo numérico (reserva de 1 000 €)

- Cliente paga al reservar: 1 080 € (precio 1 000 € + comisión FiestaGo 80 €).
- Si proveedor no se presenta:
  - Cliente recibe: **1 080 € (reembolso) + 500 € (compensación) = 1 580 €**.
  - Proveedor paga: **1 580 €**. No cobra los 1 000 € teóricos y encima paga 1 580 €.
  - FiestaGo pone: 0 € (solo gestión + adelanto temporal hasta cobrar).

### Lo que NO cubre (explícito, en home y emails)

- ❌ Lluvia, viento o clima en eventos al aire libre.
- ❌ Insatisfacción subjetiva del cliente ("no me gustó cómo bailó el DJ").
- ❌ Cambios pedidos por el cliente fuera del alcance contratado.
- ❌ Daños causados por invitados.
- ❌ Reclamaciones posteriores a 14 días del evento.
- ❌ Eventos sin reserva confirmada y pagada por FiestaGo.

---

## Cómo financiamos los adelantos al cliente

Aunque el coste es del proveedor, FiestaGo adelanta al cliente para que no espere. Eso requiere tener caja para esos adelantos hasta cobrar al proveedor.

**Mecanismos en orden de uso**:

1. **Escrow (cuando llegue Stripe Connect)**. El dinero del cliente está retenido por FiestaGo hasta `event_date + N días`. Si hay no-show, lo devolvemos al cliente desde ese mismo escrow, sin sacarlo de caja propia. La compensación se descuenta de futuros payouts del proveedor.

2. **Descuento del payout del proveedor**. Cuando el proveedor tenga reservas pendientes de cobro, le descontamos automáticamente la deuda.

3. **Factura directa al proveedor**. Si no tiene payouts suficientes en 30 días, factura electrónica. Plazo 15 días. Si no paga, baja del marketplace + reclamación legal.

4. **Adelanto de FiestaGo + persecución**. Solo si el proveedor desaparece o se niega: adelantamos al cliente para preservar la marca y demandamos al proveedor.

**Cap mensual de pérdidas asumidas por FiestaGo**: 3 000 €/mes durante los primeros 6 meses. Si se rebasa, paramos las garantías nuevas hasta investigar el patrón.

---

## Cobertura — Fase 2 (mes 4-6)

Añadimos cuando tengamos al menos 50 eventos completados y datos suficientes:

| Escenario nuevo | Acción |
|---|---|
| Calidad **objetivamente inferior** a lo prometido | Compensación parcial al cliente, descontada del payout del proveedor según el % de incumplimiento (10-50%). |

---

## Cobertura — Fase 3 (mes 7+)

Cuando estemos generando ~50 k€/mes de comisión:

- Cobertura adicional con seguro de responsabilidad civil contratado con broker (Hiscox / Caser).
- Concierge de evento opcional (persona humana asignada a celebraciones de >3 000 €).

---

## Sanciones operativas al proveedor (más allá del cargo económico)

Para que el incentivo sea real, además del pago:

- **1ª incidencia grave** (no-show o cancelación <7d): aviso formal + cobro + pierde sello "Verificado" durante 6 meses + visibilidad reducida en búsquedas 90 días.
- **2ª incidencia grave**: baja permanente del marketplace, sin posibilidad de re-registro.
- **Falsedad documental**: baja inmediata + reporte a Agencia Tributaria.

---

## Cómo se ejecuta — operativa

### Lo que el cliente hace
1. Reporta la incidencia en su panel `/mi-cuenta` → botón "Reportar incidencia".
2. Sube prueba si aplica.
3. FiestaGo revisa en **24 h** (4 h si es la semana del evento).

### Lo que FiestaGo hace
1. Verifica la incidencia contra los criterios objetivos.
2. Avisa al proveedor por email para que aporte su versión.
3. Si procede, ejecuta la garantía: reembolso al cliente + compensación según tabla.
4. Carga el importe al proveedor (descuento de payout o factura directa).
5. Cierra el caso con email final a las dos partes.

### Pool de proveedores de emergencia
Cada categoría × ciudad principal tiene mínimo **3 proveedores marcados como `emergency_backup`**, con verificación reforzada y compromiso de aceptar encargos last-minute con +30% sobre tarifa estándar (que asume el proveedor incumplidor, no FiestaGo).

---

## Roadmap técnico (orden de implementación)

### Hecho ✓
- Tabla `incidents` con workflow open → investigating → resolved/rejected.
- API + UI cliente para reportar.
- UI admin para gestionar con SLA visible.
- Emails a cliente y proveedor al abrir y cerrar.
- Página pública `/garantia` y `/proveedor/compromisos`.

### Pendiente
- [ ] Columna `provider_charge` en incidents, separada de `compensation_amount`.
- [ ] Cálculo automático sugerido en el modal de admin según el ticket.
- [ ] Stripe Connect con escrow real (mientras no, los descuentos se gestionan a mano).
- [ ] Pool de proveedores de emergencia (`emergency_backup boolean` en providers).
- [ ] Comunicación de la promesa en home y fichas (✓ ya hecho con la sección negra).

---

## Letra pequeña a redactar (consulta con abogado antes del launch)

- Definir "incidencia cubierta" con criterios objetivos.
- Plazo de reclamación: 14 días tras el evento.
- Procedimiento de prueba (testigos, fotografías, etc.).
- Limitación de responsabilidad por evento: cap del 200% del importe pagado por el cliente.
- Resolución de disputas (mediación → arbitraje → tribunales).
- Cláusula de fuerza mayor.
- **Cláusula de cargo al proveedor**: el proveedor acepta que FiestaGo le descuente del payout o le facture cualquier incidencia atribuible a él.

**Importante**: la garantía solo aplica si la reserva se ha hecho íntegramente a través de FiestaGo (canal, pago, comunicación). Si hay pagos por fuera, salta.

---

**Estado del documento**: borrador v0.3 — modelo financiero corregido para que FiestaGo sea sostenible desde día 1.
**Cambios respecto a v0.2**: el coste de la compensación pasa de FiestaGo al proveedor que incumple. Cap mensual de pérdidas asumidas reducido. Tabla de compensación más agresiva pero proporcional.

---
