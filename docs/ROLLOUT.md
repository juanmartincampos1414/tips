# Tips — Rollout Strategy

> La **secuencia de entornos** del Go-Live. Subordinado a
> [PILOT_SUCCESS_DEFINITION.md](PILOT_SUCCESS_DEFINITION.md): los criterios e
> hipótesis no cambian — esto es la capa de *en qué orden y dónde* validamos.

**Principio.** No estamos buscando clientes. Estamos buscando **entornos donde
aprender lo máximo posible**, con riesgo decreciente. Llegamos al primer cliente
pago con un producto que ya sobrevivió dos entornos reales — no de un salto.

---

## Las 4 etapas

| # | Entorno | Rol | Cuándo |
|---|---|---|---|
| 1 | **Trufa** | **Laboratorio operativo** | ahora |
| 2 | **Massey Familia** | **Validación externa controlada** | tras graduar Trufa |
| 3 | **Restaurantes independientes** | **Primeros clientes (fríos)** | tras graduar Massey |
| 4 | **Escalamiento comercial** | crecimiento | tras validar el stage 3 |

---

## Etapa 1 — Trufa (laboratorio operativo)

**Qué valida:** *¿qué se rompe? ¿cuál es toda la superficie de fricción real?* + *¿el
loop ocurre?* Exhaustivo, cualitativo, nosotros presentes todos los días.

**Por qué Trufa:** conocemos la operación, acceso total al dueño y al equipo,
observación diaria del salón, iteración de un día para el otro, sin barreras de
confianza. **No es un cliente — es nuestro laboratorio.**

**⚠️ La regla del laboratorio (crítica):** en Trufa **observamos y documentamos, NO
intervenimos durante el servicio.** No le recordamos al camarero ni le explicamos al
cliente en el momento. La ventaja de Trufa es **velocidad de aprendizaje** (vemos
todo, iteramos rápido), **no** una barra de éxito más baja. Si empujamos el loop a
mano, fabricamos un falso positivo y Massey nos sorprende feo. *"El loop solo corre
cuando lo empujamos nosotros" = invalidación* (Success Definition §4).

**Setup:** Trufa se provisiona **limpio desde cero** (slug propio, datos en cero)
para baseline real. (`tano` es solo dev/test — no se usa para el piloto.)

**Graduación Trufa → Massey:**
- El loop corre **orgánico N días seguidos sin intervención nuestra.**
- Superficie de fricción **mapeada** (Friction Log).
- **Bugs críticos resueltos** (bajo la regla de freeze).

---

## Etapa 2 — Massey Familia (validación externa controlada)

**Qué valida (distinto a Trufa):** *¿funciona con MENOS de nosotros?* Es la prueba de
que el producto **se sostiene sin que estemos en el salón.** Presencia reducida,
menos hand-holding.

**Graduación Massey → independientes:**
- Funciona con nuestra presencia **bajada**.
- **H2 confirmado afuera** al menos una vez (un return visit real fuera de Trufa).
- El **onboarding empieza a ser repetible** (ver caveat abajo).

---

## Etapa 3 — Restaurantes independientes (primeros clientes fríos)

**El verdadero test sin colchón de confianza.** Ni Trufa ni Massey son clientes
*fríos* — hay relación. Recién acá el producto se prueba **sin atajo de confianza.**

**Caveat de onboarding:** en Trufa y Massey **el onboarding lo hacemos nosotros**
(cargar staff/NFC/reward/settings, codificar bandas). El **self-serve onboarding
nunca se testea de verdad hasta el stage 3.** Esa es una fricción propia del stage 3,
no antes — tenerlo presente para no sobre-leer el éxito de los dos primeros.

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
