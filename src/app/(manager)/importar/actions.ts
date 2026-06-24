"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit, requireManager } from "@/lib/auth";
import { countryNameToIso, normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ImportRowAction, Json } from "@/lib/database.types";
import {
  mapHeaders,
  mapRow,
  parseFile,
  phoneKey,
  type MappedGuest,
} from "@/lib/import";

export type ImportState = { error?: string };

// Vercel: large imports need more than the default 10s.
export const maxDuration = 300;

/** Fetch every row, paging past PostgREST's 1000-row cap. */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data } = await page(from, from + size - 1);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Phase 1 — Preview: parse + classify rows, no writes to guests.
// ---------------------------------------------------------------------------
export async function previewImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const member = await requireManager();
  const file = formData.get("file");
  const source = (formData.get("source") as string | null)?.trim() || null;
  if (!(file instanceof File) || file.size === 0)
    return { error: "Subí un archivo CSV o Excel." };

  let parsed;
  try {
    parsed = await parseFile(file);
  } catch {
    return { error: "No se pudo leer el archivo. ¿Es un CSV o .xlsx válido?" };
  }
  if (parsed.rows.length === 0) return { error: "El archivo no tiene filas." };

  const hmap = mapHeaders(parsed.headers);
  if (hmap.name == null && hmap.email == null && hmap.phone == null)
    return {
      error: "No se detectaron columnas de nombre/email/teléfono en el archivo.",
    };

  const supabase = createAdminClient();

  // Existing guests for dedup (email + phone digits → id). Paginated so dedup
  // covers the WHOLE base, not just the first 1000.
  const existing = await fetchAllRows<{
    id: string;
    email: string | null;
    phone: string | null;
  }>((f, t) =>
    supabase
      .from("guests")
      .select("id, email, phone")
      .eq("restaurant_id", member.restaurantId)
      .range(f, t),
  );
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const g of existing ?? []) {
    if (g.email) byEmail.set(g.email.toLowerCase(), g.id);
    const pk = g.phone ? phoneKey(g.phone) : null;
    if (pk) byPhone.set(pk, g.id);
  }

  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  let created = 0,
    updated = 0,
    skipped = 0;

  const rows = parsed.rows.map((raw, i) => {
    const m = mapRow(raw, hmap);
    const pk = m.phone ? phoneKey(m.phone) : null;
    let action: ImportRowAction = "create";
    let matched: string | null = null;
    let error: string | null = null;

    if (!m.name || (!m.email && !pk)) {
      action = "invalid";
      error = "Faltan campos mínimos (nombre + email o teléfono).";
    } else if ((m.email && seenEmail.has(m.email)) || (pk && seenPhone.has(pk))) {
      action = "skip";
      error = "Duplicado dentro del archivo.";
    } else {
      const match =
        (m.email && byEmail.get(m.email)) || (pk && byPhone.get(pk)) || null;
      if (match) {
        action = "update";
        matched = match;
      } else {
        action = "create";
      }
    }

    if (m.email) seenEmail.add(m.email);
    if (pk) seenPhone.add(pk);
    if (action === "create") created++;
    else if (action === "update") updated++;
    else skipped++;

    return {
      row_number: i + 1,
      raw: raw.map((c) => (c instanceof Date ? c.toISOString() : c)) as Json,
      mapped: m as unknown as Json,
      action,
      matched_guest_id: matched,
      error,
    };
  });

  const { data: imp, error: impErr } = await supabase
    .from("guest_imports")
    .insert({
      restaurant_id: member.restaurantId,
      filename: file.name,
      source,
      status: "previewed",
      total_rows: rows.length,
      created_count: created,
      updated_count: updated,
      skipped_count: skipped,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (impErr || !imp) return { error: impErr?.message ?? "Error" };

  // Batch insert rows (chunked).
  for (let i = 0; i < rows.length; i += 500) {
    await supabase.from("guest_import_rows").insert(
      rows.slice(i, i + 500).map((r) => ({
        import_id: imp.id,
        restaurant_id: member.restaurantId,
        ...r,
      })),
    );
  }
  await supabase.from("import_logs").insert({
    import_id: imp.id,
    restaurant_id: member.restaurantId,
    level: "info",
    message: `Preview: ${rows.length} filas (${created} nuevas, ${updated} a actualizar, ${skipped} omitidas).`,
  });

  redirect(`/importar/${imp.id}`);
}

// ---------------------------------------------------------------------------
// Phase 2 — Commit: apply create/update rows (merge by email/phone).
// ---------------------------------------------------------------------------
export async function commitImport(formData: FormData): Promise<void> {
  const member = await requireManager();
  const importId = (formData.get("import_id") as string | null)?.trim();
  if (!importId) return;

  const supabase = createAdminClient();
  const { data: imp } = await supabase
    .from("guest_imports")
    .select("id, status, restaurant_id")
    .eq("id", importId)
    .eq("restaurant_id", member.restaurantId)
    .maybeSingle();
  if (!imp || imp.status !== "previewed") return;

  // All create/update rows, paginated past the 1000-row cap.
  const rows = await fetchAllRows<{
    row_number: number;
    mapped: Json;
    matched_guest_id: string | null;
  }>((f, t) =>
    supabase
      .from("guest_import_rows")
      .select("row_number, mapped, matched_guest_id")
      .eq("import_id", importId)
      .in("action", ["create", "update"])
      .order("row_number")
      .range(f, t),
  );

  // Full existing base for dedup (email + phone-digits → id).
  const existing = await fetchAllRows<{
    id: string;
    email: string | null;
    phone: string | null;
  }>((f, t) =>
    supabase
      .from("guests")
      .select("id, email, phone")
      .eq("restaurant_id", member.restaurantId)
      .range(f, t),
  );
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const g of existing) {
    if (g.email) byEmail.set(g.email.toLowerCase(), g.id);
    const pk = g.phone ? phoneKey(g.phone) : null;
    if (pk) byPhone.set(pk, g.id);
  }

  const meta = (m: MappedGuest) => ({
    country: m.country,
    imported_visits: m.visits,
    imported_last_visit: m.last_visit,
    imported_segment: m.segment,
    imported_notes: m.notes,
  });

  // Partition rows into creates vs updates (dedup within the run + against the
  // full base), then apply in batches — no per-row round-trips, so it scales to
  // tens of thousands of rows without capping or timing out.
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  const phoneErrors: string[] = [];
  type Pending = { m: MappedGuest; ph: ReturnType<typeof normalizePhone> };
  const toCreate: Pending[] = [];
  const toUpdate: ({ id: string } & Pending)[] = [];

  for (const r of rows) {
    const m = r.mapped as unknown as MappedGuest;
    const region = countryNameToIso(m.country) ?? "AR";
    const ph = normalizePhone(m.phone, region);
    if (m.phone && !ph.phone_normalized)
      phoneErrors.push(`Fila ${r.row_number}: "${m.phone}" no se pudo normalizar.`);

    const emailKey = m.email ? m.email.toLowerCase() : null;
    const pk = m.phone ? phoneKey(m.phone) : null;
    if ((emailKey && seenEmail.has(emailKey)) || (pk && seenPhone.has(pk))) continue;
    if (emailKey) seenEmail.add(emailKey);
    if (pk) seenPhone.add(pk);

    const matchId =
      (emailKey && byEmail.get(emailKey)) ||
      (pk && byPhone.get(pk)) ||
      r.matched_guest_id ||
      null;
    if (matchId) toUpdate.push({ id: matchId, m, ph });
    else toCreate.push({ m, ph });
  }

  let created = 0;
  let updated = 0;

  // CREATE in chunks; attach notes/tags to the freshly-inserted ids.
  for (let i = 0; i < toCreate.length; i += 500) {
    const chunk = toCreate.slice(i, i + 500);
    const { data: ins } = await supabase
      .from("guests")
      .insert(
        chunk.map((c) => ({
          restaurant_id: member.restaurantId,
          name: c.m.name,
          email: c.m.email,
          phone: c.ph.phone_raw,
          phone_normalized: c.ph.phone_normalized,
          country_code: c.ph.country_code,
          birth_date: c.m.birth_date,
          source: "import" as const,
          metadata: meta(c.m) as Json,
        })),
      )
      .select("id");
    created += ins?.length ?? 0;

    const notes: { guest_id: string; restaurant_id: string; body: string; created_by: string }[] = [];
    const tags: { guest_id: string; restaurant_id: string; tag: string; created_by: string }[] = [];
    (ins ?? []).forEach((g, idx) => {
      const c = chunk[idx];
      if (c.m.notes)
        notes.push({ guest_id: g.id, restaurant_id: member.restaurantId, body: c.m.notes, created_by: member.userId });
      for (const tag of c.m.tags)
        tags.push({ guest_id: g.id, restaurant_id: member.restaurantId, tag, created_by: member.userId });
    });
    if (notes.length) await supabase.from("guest_notes").insert(notes);
    if (tags.length) await supabase.from("guest_tags").insert(tags);
  }

  // UPDATE: bulk-fetch matched guests, merge (fill missing), upsert in chunks.
  const updateIds = [...new Set(toUpdate.map((u) => u.id))];
  const existingById = new Map<
    string,
    {
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      phone_normalized: string | null;
      country_code: string | null;
      birth_date: string | null;
      metadata: Json | null;
    }
  >();
  for (let i = 0; i < updateIds.length; i += 500) {
    const { data } = await supabase
      .from("guests")
      .select("id, name, email, phone, phone_normalized, country_code, birth_date, metadata")
      .in("id", updateIds.slice(i, i + 500));
    for (const g of data ?? []) existingById.set(g.id, g);
  }
  const upserts: Record<string, unknown>[] = [];
  const mergedAlready = new Set<string>();
  for (const u of toUpdate) {
    if (mergedAlready.has(u.id)) continue; // one merge per existing guest
    mergedAlready.add(u.id);
    const g = existingById.get(u.id);
    if (!g) continue;
    upserts.push({
      id: u.id,
      restaurant_id: member.restaurantId,
      name: g.name ?? u.m.name,
      email: g.email ?? u.m.email,
      phone: g.phone ?? u.ph.phone_raw,
      phone_normalized: g.phone_normalized ?? u.ph.phone_normalized,
      country_code: g.country_code ?? u.ph.country_code,
      birth_date: g.birth_date ?? u.m.birth_date,
      metadata: { ...((g.metadata as Record<string, unknown>) ?? {}), ...meta(u.m) },
    });
  }
  for (let i = 0; i < upserts.length; i += 500) {
    await supabase
      .from("guests")
      .upsert(upserts.slice(i, i + 500) as never, { onConflict: "id" });
    updated += Math.min(500, upserts.length - i);
  }

  await supabase
    .from("guest_imports")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      created_count: created,
      updated_count: updated,
    })
    .eq("id", importId);
  await supabase.from("import_logs").insert({
    import_id: importId,
    restaurant_id: member.restaurantId,
    level: "info",
    message: `Importación completada: ${created} creados, ${updated} actualizados.`,
  });
  if (phoneErrors.length)
    await supabase.from("import_logs").insert({
      import_id: importId,
      restaurant_id: member.restaurantId,
      level: "warn",
      message: `Teléfonos no normalizados (${phoneErrors.length}): ${phoneErrors.slice(0, 20).join(" ")}`,
    });
  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "guests.imported",
    entityType: "guest_import",
    entityId: importId,
    metadata: { created, updated },
  });

  revalidatePath(`/importar/${importId}`);
  revalidatePath("/clientes");
}
