# Tips — Pilot Runbook

> Cómo poner Tips a funcionar en un restaurante real y operarlo durante el piloto.
> **Subordinado a [PILOT_SUCCESS_DEFINITION.md](PILOT_SUCCESS_DEFINITION.md)** — los
> criterios de éxito viven ahí y no se re-discuten acá. Este documento es el *cómo*.

**Regla que gobierna:** features congeladas. El código se toca solo para bugs que
aparezcan en la operación. El resto es observar, documentar y aprender.

**Decisiones del piloto (fijadas):** restaurante nuevo y limpio · tips OFF (visible
como "Próximamente disponible" para medir demanda) · email OFF · reward por wallet ·
un solo restaurante.

---

## Roles

| Rol | Quién | Responsabilidad |
|---|---|---|
| **Operador del piloto** | nosotros | Onboarding técnico, preflight, observación, friction log |
| **Dueño** | restaurador | Cuenta owner, define reward, mira el dashboard, valida canjes |
| **Camareros** | equipo | Ofrecen la banda en el momento del buen servicio |

---

## Fase 0 — Pre-onboarding (sin clientes)

1. [ ] Definir restaurante real + **slug** estable (va impreso en las bandas; no cambia).
2. [ ] **Dominio estable** decidido para las bandas (custom domain, no la URL de Vercel).
3. [ ] Cuenta **owner** real: signup → `/setup` (provisioning → crea el restaurante).
4. [ ] Branding: nombre, **logo**, slug (lo que ve el guest en el tap y el wallet).
5. [ ] Definir el **reward** del piloto (ej: "10% de descuento" / "postre de cortesía")
       y crear la **plantilla de reward ACTIVA** en `/recompensas`.
       *(Sin plantilla activa, `emitReward` crea una default — definirla a propósito.)*
6. [ ] Cargar **Google Review URL** real + Place ID en `/configuracion`.
       *(Esto dispara el funnel de reseña en rating ≥ 4.)*
7. [ ] `email_enabled = OFF`. Tips OFF (módulo "Próximamente disponible").

## Fase 1 — Staff + NFC (operación física)

8.  [ ] Cargar cada **camarero** en `/staff` (nombre, foto opcional).
9.  [ ] Crear cada **banda** en `/nfc` (serial + **UID único**).
10. [ ] **Asignar** cada banda a su camarero (`assignNfcBand`) → queda `assigned`.
        *(Sin esto, el tap devuelve 404.)*
11. [ ] **Codificar físicamente** cada banda con `https://<dominio>/t/<slug>/<UID>`
        (el UID debe coincidir exacto con el de `/nfc`).
12. [ ] Crear ≥1 cuenta **validador** (manager/owner) en `/equipo` (`createMember`).
        *(El que valida canjes en `/w/[pass]/v` debe estar logueado como miembro.)*

## Fase 2 — Pre-flight (antes del primer cliente real)

13. [ ] Correr **`scripts/preflight.mjs`** contra el restaurante → todo en ✅.
14. [ ] Tap real con teléfono sobre **cada** banda → resuelve al camarero correcto.
15. [ ] Recorrer el loop completo una vez con dato de prueba (5★ y 2★, captura,
        reward, wallet, validar canje) → y **borrar ese dato de prueba** después.
16. [ ] Confirmar dashboard en cero limpio.

## Fase 3 — Live

17. [ ] Entregar bandas al equipo + briefing de cómo ofrecerlas.
18. [ ] Dejar material de apoyo si hace falta (se descubre en la operación).
19. [ ] Arrancar la cadencia de **Daily Pilot Review** + **Friction Log**.

---

## Datos a cargar (resumen)

| Dato | Dónde | Piloto |
|---|---|---|
| Restaurante (nombre, slug, logo) | `/setup` | ✅ |
| Cuenta owner | signup | ✅ |
| Camareros (nombre, foto) | `/staff` | ✅ |
| Bandas NFC (serial + UID) | `/nfc` | ✅ |
| Asignación banda→camarero | `/nfc` | ✅ |
| Plantilla de reward activa | `/recompensas` | ✅ |
| Google Review URL + Place ID | `/configuracion` | ✅ |
| Cuenta validador | `/equipo` | ✅ |
| sender_email / email_enabled | `/configuracion` | ⛔ OFF |
| Credenciales Mercado Pago | env | ⛔ OFF |
| Integraciones / POS / PMS | `/integraciones` | ⛔ sandbox, fuera del piloto |

---

## Pruebas físicas con NFC (la mayor fuente de fricción)

- [ ] **Codificación:** cada banda abre la URL correcta en Android **y** iPhone
      (iOS a veces requiere el lector NFC nativo).
- [ ] **Resolución 1:1:** la banda de cada camarero resuelve a **esa** persona.
- [ ] **Edge cases que deben fallar bien (404 limpio, no 500):**
  - [ ] Banda no asignada / camarero archivado.
  - [ ] Slug equivocado.
  - [ ] UID inexistente.
- [ ] **Reusabilidad:** la misma banda funciona en taps repetidos.
- [ ] **Físico:** legibilidad a través de la funda/material; distancia de lectura.

---

## Operación diaria

- **Friction Log** (`docs/FRICTION_LOG.md`): se anota *en el momento* toda fricción
  real observada — el camarero se olvidó de ofrecer la banda, el cliente no entendió,
  el reward no enganchó, el manager no abrió el dashboard, problema físico con la
  banda, etc. El aprendizaje vale más que cualquier feature.
- **Daily Pilot Review** (`docs/DAILY_PILOT_REVIEW.md`): registro diario corto de
  las métricas del Horizonte 1 + lo aprendido del día.

### Qué mirar (referencia — los criterios viven en la Success Definition)
- **Horizonte 1 (7 días):** taps, recognitions, capture rate, split de review
  routing, reviews completadas, uso distribuido, cero incidentes, demanda de tips.
- **Horizonte 2 (2–3 semanas):** rewards canjeadas, return visits, repetición de
  clientes, valor percibido por el dueño.

---

## Pendiente de pilot-prep (cambio operativo, no feature)

- [ ] **Módulo de tips → "Próximamente disponible"**: hoy el flujo de recognition
      muestra los botones de propina (opcionales). Para el piloto los dejamos
      **visibles pero deshabilitados** con ese mensaje, para *medir demanda* sin
      habilitar plata real. Es un cambio chico de UI de gating (no una feature) y se
      hace antes de la Fase 3.

---

## Go / No-Go

**No-Go si:** alguna banda no resuelve a su camarero · el reward no se emite ·
el wallet no se muestra · un canje no se puede validar · `preflight.mjs` marca ❌ ·
hay cualquier dato cruzado entre restaurantes.

**Go si:** `preflight.mjs` todo ✅ + el loop completo corrió una vez de punta a punta
en la Fase 2 + dashboard limpio en cero.
