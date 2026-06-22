/**
 * Tips brand constants — single source of truth for copy and color tokens.
 * Reference: TIPS Master PRD V2.0 — Parte V (Brand & Design System).
 */
export const BRAND = {
  name: "Tips",
  category: "Plataforma de reconocimiento para hospitality",
  mantra: ["Reconocé el servicio.", "Capturá la relación.", "Generá el regreso."],
  promise: "Transformamos una buena atención en propinas, reseñas y clientes recurrentes.",
  colors: {
    pink: "#EC3F7A",
    dark: "#0F172A",
    background: "#FDF8FA",
    success: "#22C55E",
    warning: "#F59E0B",
  },
} as const;
