# Tips

**Plataforma de reconocimiento para hospitality.**
Reconocé el servicio · Capturá la relación · Generá el regreso.

Tips convierte una buena atención en propinas, reseñas y clientes recurrentes.
Principio fundacional: **cada banda NFC pertenece a una persona (un miembro del
staff), nunca a una mesa.**

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4**
- **Supabase** (Postgres + Auth + Storage) vía `@supabase/ssr`
- Fuente **Inter** · Design tokens de marca en `src/app/globals.css`

## Setup

```bash
npm install
cp .env.example .env.local   # completá las claves de Supabase
npm run dev                  # http://localhost:3000
```

### Base de datos

Aplicá las migraciones contra tu proyecto Supabase (SQL Editor o CLI):

```bash
# con Supabase CLI
supabase db push
# o pegá supabase/migrations/0001_recognition_layer.sql en el SQL Editor
```

Regenerar tipos tras cambios de schema:

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

## Estructura

```
src/
  app/
    layout.tsx          # Inter + metadata
    globals.css         # Design system Tips (colores, tokens)
    page.tsx            # Landing
  lib/
    brand.ts            # Copy y colores de marca
    database.types.ts   # Tipos de la DB (Sprint 01)
    supabase/
      client.ts         # Cliente browser (Client Components)
      server.ts         # Cliente server (RSC / Route Handlers / Actions)
      middleware.ts     # Refresh de sesión
  proxy.ts              # Edge proxy (ex middleware) → refresca sesión
supabase/
  migrations/           # SQL versionado
docs/                   # PRD, deck MVP, specs de sprint
```

## Roadmap de sprints

- **Sprint 01 — Recognition Layer** _(actual)_: restaurants, staff, NFC, perfiles
  públicos, visits, dashboard básico. Sin tips/reviews/CRM/rewards.
- Sprint 02 — Tips + Reviews
- Sprint 03 — CRM + Rewards
- Sprint 04 — Wallet + Dashboard

Ver `docs/Sprint_01_Recognition_Layer.docx` y `docs/Tips_Master_PRD_V2.pdf`.
