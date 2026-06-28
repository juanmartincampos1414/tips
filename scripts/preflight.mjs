#!/usr/bin/env node
// =============================================================================
// Pilot pre-flight — Go/No-Go readiness check for a restaurant before its first
// real tap. READ-ONLY: never mutates. Verifies the operational prerequisites
// from docs/PILOT.md against the live DB.
//
//   node scripts/preflight.mjs <slug>
//
// Exit 0 = GO (no ❌). Exit 1 = NO-GO (at least one ❌) or usage error.
// =============================================================================

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/preflight.mjs <slug>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const ok = (label, detail = "") => results.push({ level: "ok", label, detail });
const warn = (label, detail = "") => results.push({ level: "warn", label, detail });
const fail = (label, detail = "") => results.push({ level: "fail", label, detail });
// need → blocking (ok | fail). want → advisory (ok | warn).
const need = (pass, label, passDetail, failDetail) =>
  pass ? ok(label, passDetail) : fail(label, failDetail);
const want = (pass, label, passDetail, warnDetail) =>
  pass ? ok(label, passDetail) : warn(label, warnDetail);

// 1) Restaurant exists + active
const { data: r } = await sb
  .from("restaurants")
  .select("id, name, slug, status, logo_url")
  .eq("slug", slug)
  .maybeSingle();

if (!r) {
  fail(`Restaurante con slug "${slug}"`, "no existe");
  report();
} else {
  const RID = r.id;
  need(r.status === "active", "Restaurante activo", `${r.name} (${r.slug})`, `status = ${r.status}`);
  want(!!r.logo_url, "Branding: logo", "", "logo_url vacío");

  // 2) Active reward template
  const { count: tpls } = await sb
    .from("reward_templates")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", RID)
    .eq("status", "active");
  need(tpls >= 1, "Plantilla de reward activa", `${tpls} activa(s)`, "ninguna activa → emitReward usaría una default");

  // 3) Google Review URL
  const { data: settings } = await sb
    .from("restaurant_settings")
    .select("google_review_url, email_enabled")
    .eq("restaurant_id", RID)
    .maybeSingle();
  need(!!settings?.google_review_url, "Google Review URL", "", "vacía → el funnel de reseña no tiene a dónde mandar");

  // 4) Active staff
  const { data: staff } = await sb
    .from("staff")
    .select("id")
    .eq("restaurant_id", RID)
    .eq("status", "active");
  const staffIds = new Set((staff ?? []).map((s) => s.id));
  need(staffIds.size >= 1, "Camareros activos", `${staffIds.size}`, "ninguno");

  // 5) Assigned bands + no orphans (assigned band must point to an active staff)
  const { data: bands } = await sb
    .from("nfc_inventory")
    .select("uid, assigned_staff_id")
    .eq("restaurant_id", RID)
    .eq("status", "assigned");
  const assigned = bands ?? [];
  const orphans = assigned.filter((b) => !b.assigned_staff_id || !staffIds.has(b.assigned_staff_id));
  need(assigned.length >= 1, "Bandas asignadas", `${assigned.length}`, "ninguna banda en estado 'assigned' → el tap da 404");
  need(
    orphans.length === 0,
    "Bandas sin huérfanas",
    "toda banda asignada apunta a un camarero activo",
    `${orphans.length} banda(s) apuntan a staff inexistente/archivado: ${orphans.map((b) => b.uid).join(", ")}`,
  );

  // 6) Validator account (any member can validate a claim)
  const { count: members } = await sb
    .from("restaurant_members")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", RID);
  need(members >= 1, "Cuenta validador", `${members} miembro(s)`, "sin miembros → nadie puede validar un canje");

  // 7) Pilot config expectation (email OFF)
  want(settings?.email_enabled !== true, "Email OFF (piloto)", "", "email_enabled = true (el piloto espera OFF)");

  report();
}

function report() {
  const icon = { ok: "✅", warn: "⚠️ ", fail: "❌" };
  console.log(`\nPre-flight · slug "${slug}"\n`);
  for (const { level, label, detail } of results)
    console.log(`${icon[level]} ${label}${detail ? ` — ${detail}` : ""}`);
  const fails = results.filter((x) => x.level === "fail").length;
  const warns = results.filter((x) => x.level === "warn").length;
  console.log(
    `\n${fails === 0 ? "🟢 GO" : "🔴 NO-GO"} — ${fails} bloqueante(s), ${warns} advertencia(s)\n`,
  );
  process.exit(fails === 0 ? 0 : 1);
}
