"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit, requireManager } from "@/lib/auth";
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

  // Existing guests for dedup (email + phone digits → id).
  const { data: existing } = await supabase
    .from("guests")
    .select("id, email, phone")
    .eq("restaurant_id", member.restaurantId);
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

  const { data: rows } = await supabase
    .from("guest_import_rows")
    .select("id, mapped, action, matched_guest_id")
    .eq("import_id", importId)
    .in("action", ["create", "update"])
    .order("row_number");

  let created = 0,
    updated = 0;

  for (const r of rows ?? []) {
    const m = r.mapped as unknown as MappedGuest;

    // Re-resolve by email at commit to avoid creating a duplicate of a guest
    // added since preview. Phone matches are already in matched_guest_id (the
    // preview normalizes phone digits; a raw ilike can't match formatted phones).
    let guestId = r.matched_guest_id as string | null;
    if (!guestId && m.email) {
      const { data: hit } = await supabase
        .from("guests")
        .select("id")
        .eq("restaurant_id", member.restaurantId)
        .ilike("email", m.email)
        .limit(1)
        .maybeSingle();
      guestId = hit?.id ?? null;
    }

    const importMeta = {
      imported_visits: m.visits,
      imported_last_visit: m.last_visit,
      imported_segment: m.segment,
    };

    if (guestId) {
      // Merge: fill missing identity fields, merge metadata.
      const { data: g } = await supabase
        .from("guests")
        .select("name, email, phone, birth_date, metadata")
        .eq("id", guestId)
        .single();
      await supabase
        .from("guests")
        .update({
          name: g?.name ?? m.name,
          email: g?.email ?? m.email,
          phone: g?.phone ?? m.phone,
          birth_date: g?.birth_date ?? m.birth_date,
          metadata: {
            ...((g?.metadata as Record<string, unknown>) ?? {}),
            ...importMeta,
          },
        })
        .eq("id", guestId);
      updated++;
    } else {
      const { data: ng } = await supabase
        .from("guests")
        .insert({
          restaurant_id: member.restaurantId,
          name: m.name,
          email: m.email,
          phone: m.phone,
          birth_date: m.birth_date,
          source: "import",
          metadata: importMeta as Json,
        })
        .select("id")
        .single();
      guestId = ng?.id ?? null;
      created++;
    }

    if (!guestId) continue;
    if (m.notes)
      await supabase.from("guest_notes").insert({
        guest_id: guestId,
        restaurant_id: member.restaurantId,
        body: m.notes,
        created_by: member.userId,
      });
    for (const tag of m.tags)
      await supabase
        .from("guest_tags")
        .insert({
          guest_id: guestId,
          restaurant_id: member.restaurantId,
          tag,
          created_by: member.userId,
        })
        .select("id")
        .maybeSingle();
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
