# Tips — Pilot Success Definition v1 (congelado)

> **Documento gobernante del piloto.** Todo lo demás —runbook, preflight, métricas
> diarias, decisiones de código— se subordina a esto. Congelado como v1: los
> criterios de éxito no se vuelven a discutir durante la operación. Solo se
> recalibran los umbrales marcados explícitamente como *provisionales*.

**El cambio de etapa.** Hasta el cierre del Block A trabajamos como arquitectos:
validábamos que el código funcione. Eso quedó resuelto. Ahora trabajamos como
startup: validamos que **una persona quiera usar el producto** y que ese uso
**cambie el comportamiento del cliente**. Ya no se mide en tests; se mide en
comportamiento humano.

---

## 1. ¿Qué hipótesis queremos validar?

**Hipótesis central.** Cuando un camarero ofrece su banda NFC personal en el
momento de un buen servicio, un cliente real **completa voluntariamente** el loop

> **Tap → Recognition → Review → Guest Capture → Reward → Return Visit**

y eso produce **reseñas públicas** y **visitas repetidas** que el restaurante no
habría tenido de otra forma.

**El supuesto más riesgoso (el que, si es falso, mata todo):** que el cliente
**se enganche del todo** — que no solo toque la banda, sino que deje su rating
*y* su dato de contacto. Todo lo de abajo depende de ese primer engagement. Si el
cliente toca y se va sin capturarse, no hay loop.

**Distinción clave — por qué el riesgo #1 es del cliente, no del camarero:** que
el camarero ofrezca la banda es un **riesgo operativo entrenable** (se resuelve con
onboarding del equipo, recordatorios, material de apoyo). La **voluntad del cliente**
de completar el recorrido es la **hipótesis de producto**: no se entrena, se valida
o se invalida. Por eso los ojos van puestos, primero que nada, en el cliente.

Sub-hipótesis dependientes:
- **H-staff** — el camarero ofrece la banda (riesgo operativo, entrenable).
- **H-review** — un rating alto se convierte en reseña real en Google.
- **H-return** — el reward es suficientemente atractivo para traer al cliente de vuelta.

---

## 2. ¿Qué significa que Tips genera valor?

Que el restaurante obtiene, **sin nuestra intervención**, cosas que antes no tenía:

- **Reseñas** en Google que no existían.
- **Clientes que vuelven** gracias al reward (repeat customers).
- Una **lista propia de clientes capturados** (CRM) que antes no tenía.
- Como señal adelantada del próximo bloque: **demanda explícita de propinas**
  (clientes preguntando frente al módulo "Próximamente disponible").

El valor no es que la app ande. Es que el **dueño y el camarero** reciban algo
tangible sin que se los expliquemos.

---

## Los dos relojes del piloto

El piloto valida **dos cosas distintas, en dos tiempos distintos**. Mezclarlas
sería un error: una visita repetida tiene lag natural (un cliente capturado el día
6 no puede volver dentro de la primera semana).

- **Horizonte 1 — Adopción y funcionamiento (primeros 7 días):** ¿la gente *usa*
  el producto?
- **Horizonte 2 — Propuesta de valor del negocio (2–3 semanas):** ¿el producto
  *cambia el comportamiento* del cliente?

---

## 3. ¿Qué métricas CONFIRMAN la hipótesis?

### Horizonte 1 — Adopción (7 días)
- **Taps** (`visits`) por día y por camarero.
- **Recognitions** completadas (`recognition_events`).
- **Capture rate** (guests ÷ recognitions) — *umbral provisional > 30%, a
  recalibrar con los primeros días (ver §5).*
- **Split de review routing**: % rating ≥4 (→ Google) vs ≤3 (→ feedback privado).
- **Reviews completadas** en Google (public_review → completed).
- **Uso distribuido** entre camareros (más de uno, sostenido en la semana).
- **Cero incidentes** operativos / de aislamiento.
- *(señal lateral)* **demanda de tips** frente al módulo "Próximamente".

### Horizonte 2 — Valor de negocio (2–3 semanas)
- **Rewards canjeadas.**
- **Return visits reales** (la prueba del repeat-customer).
- **Repetición de clientes** (clientes que aparecen más de una vez).
- **Valor percibido por el restaurante** — el dueño mira el dashboard y *ve algo*
  sin que se lo expliquemos.

---

## 4. ¿Qué métricas la INVALIDAN?

### Horizonte 1 — invalida la adopción
- **Taps sin captura** — la gente toca pero el capture rate es ~0 (tocan, rebotan,
  no dejan dato). *(invalida el supuesto más riesgoso)*
- **El camarero no ofrece la banda** — taps por camarero ~0 estando en turno.
- **Ratings altos sin reseñas** — nadie completa el paso de Google.
- **El loop solo corre cuando lo empujamos nosotros** — no hay comportamiento orgánico.

### Horizonte 2 — invalida el valor de negocio
- **Cero return visits** pese a rewards emitidas — el reward no mueve a nadie a volver.
- **El manager nunca abre el dashboard** — el comprador no percibe valor.

---

## 5. ¿Cuándo damos el piloto por exitoso?

Dos relojes, dos veredictos. El piloto es exitoso solo si **ambos** se cumplen.

### Horizonte 1 (7 días) — "la gente lo usa"
- ✅ El loop completo ocurrió **de forma orgánica varias veces** (no inducido por
  nosotros).
- ✅ **Capture rate razonable** — barra inicial **provisional > 30%**. No es una
  meta rígida: hoy no tenemos benchmark propio. Se **recalibra** con los datos de
  los primeros días; lo que importa es la *tendencia* y que no sea ~0.
- ✅ **Reseñas reales** empezando a aparecer en Google.
- ✅ Uso por **más de un camarero.**
- ✅ **Cero incidentes** de seguridad o aislamiento entre datos.

### Horizonte 2 (2–3 semanas) — "el producto cambia el comportamiento"
- ✅ Al menos **un reward canjeado = un return visit real.**
- ✅ Señales de **repetición de clientes.**
- ✅ El **dueño percibe valor** mirando el dashboard, sin que se lo expliquemos.

**Lectura del resultado:**
- **H1 ✅ + H2 ✅** → ya no validamos una aplicación, validamos el **modelo de
  negocio** → pasamos a Productization guiada por las fricciones reales documentadas.
- **H1 ✅ + H2 ❌** → la gente lo usa pero no cambia su comportamiento → la fricción
  está en el **reward / la propuesta de valor**, no en el producto. Se itera ahí.
- **H1 ❌** → no hay valor posible sin uso → se itera sobre la **fricción de
  adopción** (cliente o camarero) antes de mirar el Horizonte 2.

En ningún caso se agregan features para "tapar" una falla.

---

## 6. ¿Qué NO vamos a optimizar todavía?

- **Tips / pagos / settlement** — visible solo como "Próximamente disponible",
  únicamente para medir demanda.
- **Email / entregabilidad / campañas / CRM marketing.**
- **Conversión del formulario de captura** — lo observamos, no lo optimizamos.
- **Economía del reward** — elegimos uno, observamos; sin A/B ni tuning.
- **Multi-restaurante / escalado / pulido del self-serve onboarding.**
- **Profundidad analítica del dashboard.**

> Estamos midiendo **si el loop crea valor**, no maximizando cada paso. La
> optimización viene **después** de confirmar la hipótesis.

---

## Regla que gobierna el piloto

**Features congeladas.** El código se toca **solo** para resolver bugs que
aparezcan durante la operación. Todo el resto del trabajo es **observar personas,
documentar fricción y aprender.**

El éxito no se declara desde el código. Se declara desde el comportamiento de las
personas reales que usan —o no usan— Tips.
