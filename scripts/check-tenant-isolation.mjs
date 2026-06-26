#!/usr/bin/env node
// =============================================================================
// Tenant Isolation build check. Product code must access data through
// tenantDb() — never the raw service-role client. This fails the build if
// `unsafeAdminClient` is imported outside the allowlist.
//
// Phase 0: only the new canonical name is guarded (nothing legacy uses it yet).
// The legacy `createAdminClient` alias stays open until the mechanical rename
// (Commit 2), at which point this list grows into a draining legacy exemption.
// =============================================================================

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Files allowed to import the raw service-role client.
const ALLOWLIST = [
  "src/lib/supabase/admin.ts", // defines it
  "src/lib/tenant/db.ts", // the DAL wraps it
  "src/lib/tenant/context.ts",
  "src/lib/tenant/resolve.ts", // resolve-by-token (added per tier)
  "src/lib/tenant/provision.ts", // tenant creation (added per tier)
  "src/lib/auth.ts", // membership resolution
];

// Legacy files still using the raw client directly — to be migrated to tenantDb
// tier by tier. This list ONLY shrinks. (Populated at the mechanical rename.)
const LEGACY = [
  "src/app/actions.ts",
  "src/app/t/[slug]/[code]/actions.ts",
  "src/app/w/[pass]/v/actions.ts",
  "src/app/pay/[ref]/actions.ts",
  "src/app/pay/[ref]/page.tsx",
  "src/app/pay/[ref]/return/page.tsx",
  "src/app/api/export/[type]/route.ts",
  "src/app/api/webhooks/[provider]/route.ts",
  "src/app/api/webhooks/resend/route.ts",
  "src/app/(manager)/campanas/actions.ts",
  "src/app/(manager)/emails/actions.ts",
  "src/app/(manager)/emails/activacion/actions.ts",
  "src/app/(manager)/importar/actions.ts",
  "src/app/(manager)/integraciones/actions.ts",
  "src/app/(manager)/pagos/actions.ts",
  "src/lib/queries.ts",
  "src/lib/email/readiness.ts",
  "src/lib/email/send.ts",
  "src/lib/email/webhook.ts",
  "src/lib/integrations/events.ts",
  "src/lib/integrations/manager.ts",
  "src/lib/integrations/sync.ts",
  "src/lib/payments/events.ts",
  "src/lib/payments/queries.ts",
  "src/lib/payments/service.ts",
];

const IMPORT_RE = /import\s+[^;]*\bunsafeAdminClient\b[^;]*from\s+["']@\/lib\/supabase\/admin["']/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const allowed = new Set([...ALLOWLIST, ...LEGACY]);
const violations = [];
const reappeared = []; // the legacy name must never come back
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  if (/\bcreateAdminClient\b/.test(src)) reappeared.push(rel);
  if (allowed.has(rel)) continue;
  if (IMPORT_RE.test(src)) violations.push(rel);
}

if (reappeared.length) {
  console.error("\n✖ Tenant Isolation check failed — `createAdminClient` must not exist anymore (use unsafeAdminClient via tenantDb):");
  for (const r of reappeared) console.error(`  - ${r}`);
  console.error("");
  process.exit(1);
}

if (violations.length) {
  console.error("\n✖ Tenant Isolation check failed — unsafeAdminClient imported outside the allowlist:");
  for (const v of violations) console.error(`  - ${v}`);
  console.error("\n  Use tenantDb(restaurantId) instead. If this is a legitimate resolve-by-token /");
  console.error("  membership / provisioning path, add it to the allowlist in this script.\n");
  process.exit(1);
}
console.log(`✓ Tenant Isolation check passed (${allowed.size} allowlisted).`);
