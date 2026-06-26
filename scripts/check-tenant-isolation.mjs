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

// Legacy files still on createAdminClient — drained tier by tier. (Populated at
// the mechanical rename; empty in Phase 0 since nothing uses unsafeAdminClient.)
const LEGACY = [];

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
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (allowed.has(rel)) continue;
  if (IMPORT_RE.test(readFileSync(file, "utf8"))) violations.push(rel);
}

if (violations.length) {
  console.error("\n✖ Tenant Isolation check failed — unsafeAdminClient imported outside the allowlist:");
  for (const v of violations) console.error(`  - ${v}`);
  console.error("\n  Use tenantDb(restaurantId) instead. If this is a legitimate resolve-by-token /");
  console.error("  membership / provisioning path, add it to the allowlist in this script.\n");
  process.exit(1);
}
console.log(`✓ Tenant Isolation check passed (${allowed.size} allowlisted).`);
