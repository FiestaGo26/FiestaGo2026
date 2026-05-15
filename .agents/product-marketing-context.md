# Product Marketing Context — FiestaGo

> Este archivo es leído por todos los skills de marketing antes de ejecutar cualquier tarea.
> Actualízalo cuando cambie el producto, el público objetivo o el posicionamiento.

---

## Producto

**Nombre:** FiestaGo (también escrito FIEGAGO internamente)
**URL:** https://fiestago.es
**Tipo:** Marketplace B2B2C de proveedores de eventos en España
**Estado:** En desarrollo activo, lanzamiento en curso

**Descripción en una frase:**
FiestaGo conecta a personas que organizan eventos (bodas, comuniones, cumpleaños, eventos corporativos) con proveedores de calidad verificados en España.

**Descripción larga:**
FiestaGo es un marketplace donde los organizadores de eventos pueden descubrir, comparar y contratar proveedores de servicios para todo tipo de celebraciones. Los proveedores se registran en la plataforma, crean su perfil con servicios y precios, y reciben solicitudes de clientes directamente. El modelo es freemium: el registro es gratuito y la primera transacción no tiene comisión; a partir de la segunda venta se aplica un 8% de comisión.

---

## Modelo de negocio

- **Freemium con comisión:** registro gratis + 0% en la primera transacción + 8% desde la segunda
- **Dos lados del marketplace:**
  - **Proveedores (supply):** negocios de eventos que quieren más clientes
  - **Clientes (demand):** particulares y empresas que organizan eventos
- **Ingresos:** comisión sobre transacciones completadas

---

## Audiencias

### Lado proveedor (captación activa ahora)
**Quién es:** Fotógrafos, catering, DJ, floristas, animadores, wedding planners, espacios, food trucks, magos, orquestas, decoradores, etc. en España.
**Pain points:**
- Dependen del boca a boca y de directorios genéricos (Google, Instagram)
- Alta estacionalidad y dificultad para llenar agenda en temporada baja
- Sin herramientas digitales para gestionar solicitudes y pagos
- Inversión en marketing cara e incierta (Google Ads, redes sociales)

**Lo que ganan con FiestaGo:**
- Visibilidad ante clientes que están activamente buscando
- Primera transacción sin comisión (sin riesgo para probar)
- Panel de gestión de solicitudes y perfil profesional
- Red de confianza con reseñas verificadas

**Canales de captación actuales:** email outreach (Resend), búsqueda de agente IA en internet

### Lado cliente (a trabajar próximamente)
**Quién es:** Parejas planificando bodas, padres organizando comuniones, empresas buscando catering/espacio para eventos corporativos, particulares con cumpleaños o celebraciones.
**Pain points:**
- Proceso de búsqueda de proveedores disperso y lento
- Difícil comparar precios y calidad
- Miedo a contratar sin referencias de confianza

**Lo que ganan con FiestaGo:**
- Todos los proveedores en un solo lugar, filtrados por categoría y ciudad
- Precios transparentes y perfiles verificados
- Contacto directo y sin intermediarios

---

## Propuesta de valor única (UVP)

**Para proveedores:**
> "Consigue clientes de eventos sin gastar en publicidad. Regístrate gratis y cobra tu primera venta sin comisión."

**Para clientes:**
> "Encuentra y contrata al proveedor perfecto para tu evento en minutos, con precios claros y sin sorpresas."

---

## Posicionamiento competitivo

**Competidores indirectos en España:**
- Bodas.net (enfocado solo en bodas, modelo de suscripción cara para proveedores)
- Zankyou (bodas, internacional)
- Thumbtack / TaskRabbit (servicios generales, no especializados en eventos)
- Google Maps + Instagram (no es un marketplace, sin gestión)

**Ventaja diferencial de FiestaGo:**
- Cubre todos los tipos de eventos (no solo bodas)
- Modelo sin riesgo para el proveedor (0% primera transacción)
- Agente IA integrado para captación y gestión de proveedores
- Plataforma española, en español, para el mercado español

---

## Stack técnico (relevante para marketing)

- **Web:** Next.js 14, desplegado en Netlify
- **Base de datos:** Supabase
- **Email:** Resend (SMTP: smtp.resend.com:465, desde contacto@fiestago.es)
- **IA:** Claude (Anthropic) — agente de captación de proveedores en el panel admin
- **Repo:** FiestaGo26/FiestaGo2026

---

## Tono de marca

- **Cercano y profesional:** hablamos de tú, sin ser informales en exceso
- **Español de España:** vosotros, vale, genial (no latinoamericanismos)
- **Optimista y orientado a resultados:** hablamos de lo que el proveedor/cliente gana, no de características técnicas
- **Sin jerga de startup:** nada de "disruptivo", "ecosistema", "sinergias"

---

## Categorías de proveedores (actuales)

Fotografía y vídeo · Catering y comida · Música y DJ · Animación e infantil · Decoración y flores · Espacios y venues · Wedding planning · Belleza y estilismo · Transporte · Espectáculos · Photocall y atrezo · Otros servicios

---

## Ciudades objetivo (por orden de prioridad)

Madrid · Barcelona · Valencia · Sevilla · Málaga · Bilbao · Zaragoza · Murcia · Palma de Mallorca · Las Palmas

---

## Métricas clave

- Proveedores registrados y aprobados
- Tasa de conversión outreach → registro de proveedor
- Categorías con más proveedores
- Emails de outreach enviados / respuestas recibidas

---

## Estado actual del proyecto (Mayo 2026)

- ✅ Homepage publicada en fiestago.es
- ✅ Listado de proveedores (`/proveedores`)
- ✅ Perfiles individuales de proveedor
- ✅ Formulario de registro de proveedor (`/registro-proveedor`)
- ✅ Panel admin con agente IA de captación (busca proveedores + genera emails de outreach)
- ✅ Portal proveedor (`/proveedor/login` y `/proveedor/panel`)
- ✅ Emails de aprobación automáticos via Resend
- 🔄 Dominio fiestago.es propagándose
- 🔄 Nuevo diseño frontend (tipografía serif + hero con vídeo) pendiente de implementar
- 🔄 Fix de login de proveedor (OTP de 6 dígitos, reemplazando magic link)

---

## Contacto / Partnerships

Email: contacto@fiestago.es
Partnerships: partnerships@fiestago.es
