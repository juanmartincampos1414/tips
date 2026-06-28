# Tips — Friction Log

> El registro más importante del piloto. Acá se anota **en el momento** toda
> fricción real observada. Gobernado por
> [PILOT_SUCCESS_DEFINITION.md](PILOT_SUCCESS_DEFINITION.md): el aprendizaje vale
> más que cualquier feature.

## Cómo usarlo
- **Anotá en el momento**, no de memoria al final del día.
- Una fila por fricción observada (aunque parezca menor).
- Etiquetá la **etapa del loop** y clasificá **Bug vs Aprendizaje**.

### Etapas del loop
`tap` · `recognition` · `review` · `capture` · `reward` · `wallet` · `dashboard`
· `físico` (banda/NFC) · `staff` (el camarero) · `otro`

### Severidad
- **Alta** — rompe el loop (el cliente no puede avanzar / dato cruzado / nadie puede validar).
- **Media** — el loop avanza pero con fricción real (confusión, abandono parcial).
- **Baja** — molestia menor / cosmético.

### Bug vs Aprendizaje (cómo se rutea)
- **Bug** → es un defecto del producto. Se arregla bajo la regla de freeze
  (el código se toca **solo** para esto). Anotar y priorizar por severidad.
- **Aprendizaje** → no es un defecto; es una señal de comportamiento humano
  (el camarero se olvida de ofrecer, el reward no engancha, el cliente no entiende).
  **NO se arregla con código ahora.** Va al backlog de Productization. Es lo que
  estamos acá para descubrir.

> Tip: una fricción en etapa `capture` es **evidencia directa sobre el supuesto más
> riesgoso** (que el cliente complete rating + contacto). Marcala con cuidado.

---

## Log

| Fecha | Quién observó | Etapa | Qué pasó | Severidad | Bug / Aprendizaje | Acción |
|---|---|---|---|---|---|---|
| _ej_ 2026-07-01 | Operador | capture | El cliente dejó el rating pero cerró al pedirle el email | Media | Aprendizaje | Observar si se repite; ¿el copy del form pide demasiado? |
|  |  |  |  |  |  |  |

---

## Resumen rotativo (se completa al cierre del piloto)

- **Top 3 fricciones de adopción (Horizonte 1):**
- **Top 3 fricciones de valor (Horizonte 2):**
- **Bugs encontrados / resueltos:**
- **Aprendizajes que alimentan Productization:**
