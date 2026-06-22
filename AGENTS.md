<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tips — project context

Tips is a **recognition platform for hospitality**: it turns great service into
tips, reviews and repeat customers. Full spec lives in `docs/` (PRD + sprint
specs). Read those before adding product features.

**Core principle:** every NFC band belongs to a *person* (a staff member), never
to a table. This drives the whole data model.

## Conventions
- Next.js 16 App Router. The middleware convention is `proxy.ts` with a `proxy`
  export (not `middleware`).
- Supabase via `@supabase/ssr`: use `lib/supabase/server.ts` in Server
  Components / Route Handlers / Server Actions, `lib/supabase/client.ts` in
  Client Components. Never import the server client into client code.
- DB types live in `src/lib/database.types.ts` — keep them in sync with
  `supabase/migrations/`. Regenerate with `supabase gen types` once linked.
- Use brand tokens (`bg-pink`, `text-dark`, `bg-background`, etc.) from
  `globals.css`; brand copy/colors are centralized in `src/lib/brand.ts`.
- **Never hard-delete domain data** (PRD rule R10) — archive via `status`.

## Current scope: Sprint 01 — Recognition Layer
In scope: restaurants, staff, nfc_tags, visits, public staff profiles,
basic dashboard. **Out of scope** until later sprints: tips, ratings, reviews,
guests/CRM, rewards, wallet. Don't build ahead of the sprint.
