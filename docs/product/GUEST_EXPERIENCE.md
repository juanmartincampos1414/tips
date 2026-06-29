# Tips — GUEST_EXPERIENCE.md · Product Master Document (v1)

> **El documento más importante del producto.** No describe pantallas: describe la
> **experiencia completa** que vive un cliente desde el primer tap hasta que se va
> del restaurante. Es el north star de la capa guest — gobierna el desarrollo y debe
> ser suficiente para que cualquier persona o IA continúe sin reconstruir contexto.

## Cómo leer este documento

Este doc convive con el framework del piloto
([../PILOT_SUCCESS_DEFINITION.md](../PILOT_SUCCESS_DEFINITION.md),
[../ROLLOUT.md](../ROLLOUT.md)). La **visión** es canónica; la **ejecución** aprende
de Trufa. Por eso cada decisión está etiquetada:

- 🔒 **Principio** — decisión de producto **comprometida**. No se mueve con cada
  dato; es parte de la identidad de Tips.
- 🧪 **Hipótesis (Trufa)** — decisión de **comportamiento del guest** a validar en el
  piloto. Es vision-de-trabajo, no hecho. Se confirma/ajusta con datos reales y se
  registra en [§11](#11-hipótesis-abiertas--registro-vivo-trufa).

> **v1 se gana su v2 con lo que Trufa nos enseñe.** *Lo que no se registra en el
> momento, se pierde.*

**Boundary con [EXPERIENCE_SYSTEM.md](EXPERIENCE_SYSTEM.md) (doc 02):** acá vive el
*qué vive el guest y por qué* (journey, pantallas, copy, decisiones). El *cómo se
siente* a nivel primitivo (motion system, timing, paleta, tipografía, componentes)
vive en el doc 02. Cuando este doc dice "transición suave", el *cómo exactamente* lo
define 02.

---

## Índice
1. [Filosofía UX](#1-filosofía-ux)
2. [Principios de diseño](#2-principios-de-diseño)
3. [Customer Journey](#3-customer-journey)
4. [Psicología y estados emocionales](#4-psicología-y-estados-emocionales)
5. [El flujo, pantalla por pantalla](#5-el-flujo-pantalla-por-pantalla)
6. [Copywriting — voz, tono y copy canónico](#6-copywriting)
7. [Estados vacíos, error y edge cases](#7-estados-vacíos-error-y-edge-cases)
8. [Accesibilidad](#8-accesibilidad)
9. [Responsive](#9-responsive)
10. [Estado actual vs. visión](#10-estado-actual-vs-visión)
11. [Hipótesis abiertas — registro vivo (Trufa)](#11-hipótesis-abiertas--registro-vivo-trufa)

---

## 1. Filosofía UX

Tips convierte un **momento humano** —el reconocimiento a una persona que dio buen
servicio— en valor para el cliente, el camarero y el restaurante. La experiencia del
guest tiene que estar a la altura de ese momento: cálida, rápida, premium.

🔒 **Principio rector de la experiencia:**
> El usuario nunca debe sentir que está **llenando un formulario**.
> Debe sentir que está **viviendo una experiencia premium.**

Tres tensiones que la experiencia resuelve:
- **Cálida, no transaccional.** El guest acaba de tener una buena experiencia humana;
  la app la amplifica, no la enfría con burocracia.
- **Rápida, no apurada.** Ocurre de pie, con el celular, mientras paga o se va. Cada
  segundo cuenta — pero sin sensación de prisa.
- **Generosa, no extractiva.** Primero damos (reconocer al camarero, un reward),
  después pedimos (el dato, la reseña). El guest siente que recibe, no que lo ordeñan.

---

## 2. Principios de diseño

🔒 **Una decisión por pantalla.** Cada pantalla pide *una sola cosa*. Nunca dos
preguntas compitiendo por la atención.

🔒 **Mostrar antes de pedir.** Generamos expectativa y entregamos valor antes de pedir
datos (el teaser del Loyalty Club aparece *antes* del formulario; el reward se
entrega como parte de unirse, no como anzuelo posterior).

🔒 **Progreso sin fricción percibida.** El guest avanza por pasos cortos que se sienten
inevitables, no como un wizard largo. Las transiciones encadenan; no hay "siguiente
→ siguiente → siguiente" visible.

🔒 **Personalización por nombre.** El camarero tiene **nombre y cara** (la cara llega
después de v1). El guest reconoce *a una persona*, no a "el restaurante". Esto es el
corazón del modelo: cada banda pertenece a una persona, nunca a una mesa.

🔒 **Lo premium está en el detalle.** Mucho espacio, tipografía grande, jerarquía
clara, animaciones muy suaves. Minimalismo, no vacío.

🔒 **Honestidad emocional.** Si el guest tuvo una mala experiencia (rating bajo), no lo
empujamos a una reseña pública. Lo escuchamos en privado. La confianza es el activo.

🧪 **Hipótesis (Trufa) — orden generoso primero:** entregar el reward + wallet *antes*
de pedir la reseña (reciprocidad) mejora tanto la tasa de captura como la de reseñas.
*(Ver §10 y §11 — difiere del orden actualmente construido.)*

---

## 3. Customer Journey

El recorrido completo, de punta a punta:

```
1. Tap NFC
2. Bienvenida          → "Gracias por visitar Trufa"
3. Pantalla Principal  → camarero + rating + CTA propina + teaser Loyalty
4. Propina (si activo) → montos → pago     [piloto: OFF, se saltea]
5. Loyalty Club        → unirse gratis → Nombre + Email → alta
6. Reward              → "¡Reward desbloqueado!"
7. Wallet Pass         → Apple / Google Wallet
8. Review Routing      → ≥4 Google · ≤3 feedback privado
9. Final               → "Esperamos volver a verte muy pronto ❤️"
```

🧪 **Hipótesis (Trufa) — secuencia.** El orden 5→6→7 (captura → reward → wallet)
ocurre **antes** del review routing (8). Es la apuesta de reciprocidad. El producto
construido hoy hace el routing *antes* de la captura — el piloto decide cuál convierte
mejor sin lastimar el supuesto más riesgoso (que el guest complete la captura).

**Duración objetivo:** 🔒 todo el recorrido feliz, **bajo ~60 segundos** de pie. Cada
pantalla extra se justifica o se elimina.

---

## 4. Psicología y estados emocionales

Mapa de lo que **siente** el guest en cada etapa — la experiencia se diseña para
*sostener* o *elevar* ese estado, nunca enfriarlo:

| Etapa | Estado emocional | Lo que la experiencia debe lograr |
|---|---|---|
| Tap | curiosidad / sorpresa | "¿qué es esto?" → deleite inmediato, cero carga |
| Bienvenida | reconocimiento | "me reciben" → calidez, sensación de lugar |
| Principal | protagonismo del camarero | "puedo reconocer a Juan" → claridad de una acción |
| Rating | expresión | dar la opinión es liviano, satisfactorio |
| Propina (teaser) | generosidad / agencia | "puedo dejar algo" — sin presión |
| Loyalty teaser | anticipación | "viene algo bueno" → expectativa, no transacción |
| Captura | pertenencia | "me uno a algo", no "doy mis datos" |
| Reward | recompensa / sorpresa | deleite — recibió antes de que se lo pidan |
| Wallet | permanencia | "me lo llevo" → el vínculo persiste |
| Review | reciprocidad | devolver algo bueno se siente natural |
| Final | cierre cálido | "quiero volver" |

🔒 **Principio:** el momento de **pedir el dato** (captura) tiene que caer en el estado
de *pertenencia/anticipación*, nunca en uno de *fricción*. Por eso se enmarca como
"unirse al Loyalty Club", no como "dejanos tus datos".

---

## 5. El flujo, pantalla por pantalla

> Copy entre ``` ``` = **canónico** (texto exacto del producto). `<>` = variable.

### 5.1 — Tap NFC
- **Propósito:** entrada física. El guest apoya la pulsera en el teléfono.
- **Estado:** curiosidad.
- **Comportamiento:** abre `https://<dominio>/t/<slug>/<uid>` (band `assigned` a un
  camarero `active`; si no resuelve → 404 limpio, ver §7).
- 🔒 **Principio:** cero pantalla de carga visible si se puede evitar; el guest cae
  directo en la bienvenida.

### 5.2 — Bienvenida
- **Propósito:** dar la bienvenida, situar al guest en el lugar (Trufa).
- **Estado:** reconocimiento, calidez.
- **Copy canónico:**
  ```
  Gracias por visitar

  TRUFA
  ```
- **Motion:** 🔒 pequeña animación de entrada + **transición suave** hacia la pantalla
  principal (timing/curva exactos → EXPERIENCE_SYSTEM). No es un splash con spinner;
  es un *momento*, no una espera.
- 🧪 **Hipótesis (Trufa):** la bienvenida dedicada (vs. caer directo en la principal)
  suma calidez sin costar abandono. Medir si alarga de más.

### 5.3 — Pantalla Principal
- **Propósito:** el corazón. Reconocer al camarero. 🔒 **Todo ocurre en una sola
  pantalla** — una decisión visible (el rating), con dos CTAs secundarios.
- **Estado:** protagonismo del camarero.
- **Bloques (jerarquía de arriba hacia abajo):**

  **Header**
  ```
  Gracias por visitar Trufa
  ```

  **Presentación del camarero** — 🔒 nombre + rol; **sin foto en v1.**
  ```
  Juan Pérez

  Camarero
  ```

  **Pregunta principal**
  ```
  ¿Cómo fue tu experiencia con Juan?
  ```

  **Rating** — 🔒 1 a 5 estrellas, la única acción primaria.
  ```
  ⭐ ⭐ ⭐ ⭐ ⭐
  ```

  **CTA Propina** (secundario)
  ```
  💝

  Dejar una propina para Juan

  [ Dejar Propina ]
  ```
  - 🔒 **En el piloto:** visible pero **deshabilitado** con `Próximamente disponible`.
    Sirve para **medir demanda** (un guest preguntando "¿puedo dejar propina?" es señal
    de confirmación — ver framework del piloto). No se oculta.

  **CTA Loyalty** (debajo del botón de propina) — 🔒 genera expectativa, **no pide
  ningún dato todavía.**
  ```
  ✨

  En el próximo paso

  podrás unirte al

  Loyalty Club de Trufa

  y desbloquear beneficios exclusivos.
  ```
- **Microinteracciones:** las estrellas responden al toque con feedback inmediato
  (relleno + micro-escala); seleccionar el rating habilita el avance.
- 🧪 **Hipótesis (Trufa):** la pantalla única con rating + teaser de Loyalty +
  propina-deshabilitada no genera parálisis de decisión. Si confunde ("¿tengo que
  pagar?"), se ajusta jerarquía.

### 5.4 — Propina  *(si Tips está activo)*
- 🔒 **En el piloto Tips está OFF → esta pantalla se saltea automáticamente.**
- **Copy canónico (cuando activo):**
  ```
  Elegí cuánto querés dejar

  $1.000

  $2.000

  $5.000

  Otro importe
  ```
  → pago.
- 🧪/roadmap: montos, "otro importe", UX de pago → detalle en
  [PAYMENTS_ARCHITECTURE.md](PAYMENTS_ARCHITECTURE.md) (doc 03).

### 5.5 — Loyalty Club
- **Propósito:** convertir la captura del dato en **unirse a algo**.
- **Estado:** pertenencia / anticipación.
- **Copy canónico:**
  ```
  Unite gratis

  al Loyalty Club

  de Trufa
  ```
  **Beneficios** (mostrados antes del form):
  - Rewards
  - Promociones
  - Eventos
  - Beneficios exclusivos

  **Formulario** — 🔒 mínimo viable: dos campos.
  ```
  Nombre

  Email
  ```
  → alta del cliente.
- 🔒 **Principio:** se muestran los beneficios **antes** de pedir el dato (mostrar
  antes de pedir). El form son dos campos, nunca más de lo necesario.
- 🧪 **Hipótesis (Trufa) — la más crítica del documento:** este es el **supuesto más
  riesgoso** del framework (que el guest deje su contacto). El framing "Loyalty Club"
  + beneficios visibles convierte mejor que "dejanos tus datos". **Capture rate es la
  métrica clave** (umbral provisional >30%). Si la gente abandona acá, todo el modelo
  pierde sentido — por eso esta pantalla es la de máxima observación en Trufa.

### 5.6 — Reward
- **Propósito:** entregar valor inmediato — deleite.
- **Estado:** recompensa / sorpresa.
- **Copy canónico:**
  ```
  🎉

  ¡Reward desbloqueado!

  Gracias por formar parte del

  Loyalty Club.
  ```
- **Motion:** 🔒 momento de celebración (sutil, premium — no confeti chillón).
- El reward concreto sale de la plantilla activa del restaurante (ej: 10% / postre).

### 5.7 — Wallet Pass
- **Propósito:** que el vínculo **persista** fuera de la app.
- **Estado:** permanencia.
- **Copy canónico:**
  ```
  Agregar a Apple Wallet

  Agregar a Google Wallet
  ```
  → wallet creada (pass con el reward + QR de canje).
- 🧪 **Hipótesis (Trufa):** ¿cuántos efectivamente agregan el pass? El wallet es el
  canal de retorno; baja adopción de wallet = riesgo para el return visit (H2).

### 5.8 — Review Routing
- **Propósito:** capturar reputación pública sin exponerse a reseñas negativas.
- 🔒 **Principio (no negociable):** rating bajo **nunca** va a Google.

  **Rating 4 o 5:**
  ```
  Muchas gracias.

  ¿Nos dejás una reseña?
  ```
  → Google Reviews (URL del restaurante).

  **Rating 1, 2 o 3:**
  ```
  ¿Cómo podemos mejorar?
  ```
  → feedback privado. **Nunca Google.**
- 🧪 **Hipótesis (Trufa):** poner el routing *después* del reward (reciprocidad) eleva
  la tasa de reseñas completadas vs. pedirla antes.

### 5.9 — Pantalla Final
- **Propósito:** cierre cálido.
- **Estado:** ganas de volver.
- **Copy canónico:**
  ```
  Gracias.

  Esperamos volver a verte muy pronto.

  ❤️
  ```
- 🔒 **Principio:** termina en calidez humana, no en un CTA. La última sensación es
  emocional, no transaccional.

---

## 6. Copywriting

🔒 **Voz:** cálida, cercana, argentina (vos), nunca corporativa. Habla *una persona*,
no *una marca*.
🔒 **Tono:** generoso y liviano. Frases cortas. Cero jerga, cero "complete el
formulario". Emojis con moderación y propósito (💝 ✨ 🎉 ❤️).
🔒 **Personalización:** siempre que se pueda, el **nombre del camarero** y del
**restaurante** en el copy ("tu experiencia con Juan", "Loyalty Club de Trufa").

Reglas:
- Nunca "usuario", "cliente", "formulario", "registro". Sí: "unite", "sumate".
- Pedir disculpas o pedir datos siempre con una razón visible ("para reconocerte y
  enviarte beneficios").
- El copy canónico de cada pantalla está en §5 y es la fuente de verdad.

---

## 7. Estados vacíos, error y edge cases

🔒 **Toda falla del flujo público resuelve en un 404/estado limpio, nunca un 500
crudo.**

| Caso | Comportamiento esperado |
|---|---|
| Banda no asignada / sin staff activo | 404 limpio ("este link no está disponible") |
| Slug o UID inexistente | 404 limpio |
| Camarero archivado | 404 limpio |
| Sin plantilla de reward activa | el sistema emite una default (no rompe el flujo) — *evitar en pre-flight* |
| Email inválido en el form | validación inline, copy amable, no bloqueo agresivo |
| Wallet no soportada (navegador) | mostrar solo la opción disponible / fallback a "ver mi beneficio" |
| Sin conexión a mitad del flujo | preservar el progreso donde sea posible; mensaje cálido |
| Tips OFF | la pantalla de propina se saltea sin que el guest lo note |

🧪 **Hipótesis (Trufa):** los edge cases físicos (banda que no lee, iOS sin lector
NFC) son la mayor fuente de fricción real — se registran en el Friction Log.

---

## 8. Accesibilidad

🔒 **Principios:**
- Contraste suficiente (la paleta negro/rosa/blanco debe cumplir AA en texto).
- Targets táctiles grandes (estrellas, botones) — uso de pie, con una mano.
- Texto grande por defecto (es parte de la estética, también es accesibilidad).
- Estados de foco visibles; navegable sin depender solo del color.
- Copy claro y literal; no depender de iconos para entender la acción.
- Tiempos de animación que no provoquen mareo; respetar `prefers-reduced-motion`.

---

## 9. Responsive

🔒 **Mobile-first absoluto.** El 100% del flujo guest ocurre en el teléfono del
cliente (entró por un tap NFC). El diseño se optimiza para una mano, vertical,
distintos tamaños de pantalla y notches. Desktop no es un caso de uso del guest.

---

## 10. Estado actual vs. visión

Honestidad para que cualquiera continúe sin sorpresas. El **producto construido hoy**
difiere de esta visión en puntos concretos:

| Aspecto | Construido hoy | Visión (este doc) |
|---|---|---|
| Orden del flujo | rating → **review routing** → captura → reward → wallet | rating → captura (Loyalty) → reward → wallet → **review routing** |
| Framing de captura | "Dejanos tus datos" | "Unite al Loyalty Club" |
| Pantallas | flujo más compacto | bienvenida + pantallas dedicadas (premium) |
| Foto del camarero | — | sin foto en v1 (igual) |
| Estética | funcional | premium (RUN72 / Apple Wallet / Stripe / Linear / Airbnb) |

🔒 La **visión** de esta tabla es el destino. 🧪 El **reordenamiento del flujo** y el
**framing Loyalty** son hipótesis que Trufa valida antes de invertir en construirlos.
Ningún cambio de código se hace todavía (freeze): primero se valida, después se
construye.

---

## 11. Hipótesis abiertas — registro vivo (Trufa)

> Cada hipótesis 🧪 de este doc, lista para confrontar con datos reales. Se actualiza
> con lo que el Friction Log + Daily Review enseñen. *Esto es lo que convierte la
> visión en producto que ya aprendió.*

| # | Hipótesis | Cómo se valida (objetivo) | Estado |
|---|---|---|---|
| H1 | El guest **completa la captura** (Loyalty) — el supuesto más riesgoso | capture rate > ~30% (provisional) | abierta |
| H2 | El framing **"Loyalty Club"** convierte mejor que "dejanos tus datos" | capture rate + observación de abandono en 5.5 | abierta |
| H3 | Entregar **reward antes** de la reseña eleva reseñas completadas | % reviews completadas (Google) | abierta |
| H4 | La **secuencia** captura→reward→wallet→review no lastima el capture rate | comparar abandono por etapa | abierta |
| H5 | La **bienvenida dedicada** suma calidez sin costar abandono | abandono entre tap y pantalla principal | abierta |
| H6 | Alta **adopción de wallet** (canal de retorno) | % que agrega el pass | abierta |
| H7 | **Demanda de tips** frente al módulo "Próximamente" | menciones registradas en Friction Log | abierta |
| H8 | Los **edge cases físicos de NFC** son la principal fricción | conteo de taps fallidos / 404 | abierta |

---

> **v1 — north star de la experiencia guest.** La visión gobierna; Trufa enseña.
> Próximo: [EXPERIENCE_SYSTEM.md](EXPERIENCE_SYSTEM.md) (el *cómo se siente*).
