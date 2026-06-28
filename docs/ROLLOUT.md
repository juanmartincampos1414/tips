# Tips — Rollout Strategy

> La **secuencia de entornos** del Go-Live. Subordinado a
> [PILOT_SUCCESS_DEFINITION.md](PILOT_SUCCESS_DEFINITION.md): los criterios e
> hipótesis no cambian — esto es la capa de *en qué orden y dónde* validamos.

**Principio.** No estamos buscando clientes. Estamos buscando **entornos donde
aprender lo máximo posible**, con riesgo decreciente. Llegamos al primer cliente
pago con un producto que ya sobrevivió dos entornos reales — no de un salto.

---

## Las 4 etapas

| # | Entorno | Valida | Cuándo |
|---|---|---|---|
| 1 | **Trufa** | **el producto** (laboratorio operativo) | ahora |
| 2 | **Massey Familia** | **la autonomía** (validación externa controlada) | tras graduar Trufa |
| 3 | **Primer restaurante independiente** | **la venta** (validación comercial) | tras graduar Massey |
| 4 | **Escalamiento comercial** | crecimiento | tras validar el stage 3 |

> Trufa valida que el producto *funciona*. Massey valida que funciona *sin
> nosotros*. El stage 3 valida que alguien *lo adopta sin relación previa*. Son
> tres hipótesis distintas, no la misma repetida.

---

## Etapa 1 — Trufa (laboratorio operativo)

**Qué valida:** *¿qué se rompe? ¿cuál es toda la superficie de fricción real?* + *¿el
loop ocurre?* Exhaustivo, cualitativo, nosotros presentes todos los días.

**Por qué Trufa:** conocemos la operación, acceso total al dueño y al equipo,
observación diaria del salón, iteración de un día para el otro, sin barreras de
confianza. **No es un cliente — es nuestro laboratorio.**

**⚠️ La regla del laboratorio (crítica):**

> **Durante el servicio observamos y documentamos. No intervenimos.**
> Toda intervención ocurre **después del turno, nunca durante.**

No le recordamos al camarero ni le explicamos al cliente en el momento. Si durante
el servicio empezamos a explicar, recordar o empujar el uso, dejamos de observar el
producto y empezamos a **reemplazarlo nosotros** → falso positivo, y Massey nos
sorprende feo. La ventaja de Trufa es **velocidad de aprendizaje** (vemos todo,
iteramos de un día para el otro), **no** una barra de éxito más baja. *"El loop solo
corre cuando lo empujamos nosotros" = invalidación* (Success Definition §4).

**Setup:** Trufa se provisiona **limpio desde cero** (slug propio, datos en cero)
para baseline real. (`tano` es solo dev/test — no se usa para el piloto.)

**Graduación Trufa → Massey:**
- El loop corre **orgánico N días seguidos sin intervención nuestra.**
- Superficie de fricción **mapeada** (Friction Log).
- **Bugs críticos resueltos** (bajo la regla de freeze).

---

## Etapa 2 — Massey Familia (validación de autonomía)

**Qué valida (distinto a Trufa):** la **autonomía** del producto.
- ¿Funciona con **mucha menos presencia nuestra**?
- ¿El equipo **incorpora el producto sin depender de nosotros**?
- ¿El **onboarding empieza a ser repetible**?

Es la prueba de que el producto se sostiene **sin que estemos en el salón** — la
graduación natural del riesgo después de Trufa.

**Graduación Massey → independientes:**
- El producto funciona con **mínima intervención nuestra**.
- **Al menos un return visit real** (H2 confirmado afuera).
- El **onboarding ya es repetible** (ver caveat abajo).

---

## Etapa 3 — Primer restaurante independiente (validación comercial)

**Acá empieza la validación de la venta — no antes.** Ni Trufa ni Massey son
clientes fríos: hay confianza previa. Por eso un piloto exitoso en esos dos
**valida el producto, NO la venta.** La validación comercial recién empieza cuando
un restaurante independiente decide adoptar Tips **sin esa relación previa.** El
stage 3 es un hito propio, no una consecuencia automática de los dos primeros.

**Caveat de onboarding:** en Trufa y Massey **el onboarding lo hacemos nosotros**
(cargar staff/NFC/reward/settings, codificar bandas). El **self-serve onboarding
nunca se testea de verdad hasta el stage 3.** Esa es una fricción propia del stage 3,
no antes.

---

## Etapa 4 — Escalamiento comercial

Recién después de dos pilotos + el primer independiente exitoso tiene sentido la
etapa comercial. Antes, no.

---

## Cómo se conecta con el resto

- **Criterios de éxito:** [PILOT_SUCCESS_DEFINITION.md](PILOT_SUCCESS_DEFINITION.md)
  (frozen, mismo para todos los entornos).
- **Cómo operar cada entorno:** [PILOT.md](PILOT.md) (runbook, parametrizado por slug).
- **Pre-flight de cada entorno:** `node scripts/preflight.mjs <slug>` antes del primer tap.
- **Observación:** [FRICTION_LOG.md](FRICTION_LOG.md) + [DAILY_PILOT_REVIEW.md](DAILY_PILOT_REVIEW.md).

---

## El cambio de naturaleza del proyecto

Por primera vez desde que empezó Tips, **la principal incertidumbre ya no está en el
software.** Block A la sacó de ahí. La incertidumbre pasó al **comportamiento
humano**: ¿el cliente completa el flujo? ¿el camarero ofrece la banda? ¿el reward
mueve a alguien a volver?

Consecuencia directa: **el próximo gran activo que construimos ya no es código — es
conocimiento.** Y eso reordena el trabajo:

- El [FRICTION_LOG.md](FRICTION_LOG.md) y el [DAILY_PILOT_REVIEW.md](DAILY_PILOT_REVIEW.md)
  **dejan de ser documentos de apoyo: son *el entregable*.** La calidad del piloto se
  mide en lo que aprendemos y escribimos, no en commits.
- El conocimiento **solo compone si se captura con disciplina.** Anotar *en el
  momento* (no de memoria al final del día) es lo que convierte la observación en un
  activo durable, en vez de aprendizaje que se evapora en la cabeza de alguien.
- El código se toca **solo** para bugs de operación (freeze). Todo lo demás es
  observar, documentar y aprender.
