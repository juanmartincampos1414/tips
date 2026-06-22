"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRestaurant } from "@/lib/queries";
import { slugify } from "@/lib/utils";

const MEDIA_BUCKET = "tips-media";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  return (formData.get(key) as string | null)?.trim() ?? "";
}

/** Upload an optional image file and return its public URL (or null). */
async function uploadMedia(
  file: FormDataEntryValue | null,
  prefix: string,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// FR-001 · Restaurant creation
// ---------------------------------------------------------------------------
export async function createRestaurant(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = str(formData, "name");
  const email = str(formData, "email");
  const phone = str(formData, "phone");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "El nombre es obligatorio.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "Email inválido.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = createAdminClient();

  // Ensure a unique slug derived from the name.
  const base = slugify(name) || "restaurante";
  let slug = base;
  for (let i = 2; ; i++) {
    const { data: taken } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  let logoUrl: string | null = null;
  try {
    logoUrl = await uploadMedia(formData.get("logo"), "logos");
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Tag the restaurant with the logged-in owner for future per-owner scoping.
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  const { error } = await supabase.from("restaurants").insert({
    name,
    slug,
    email: email || null,
    phone: phone || null,
    logo_url: logoUrl,
    owner_id: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// FR-002 · Staff creation
// ---------------------------------------------------------------------------
export async function createStaff(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/setup");

  const name = str(formData, "name");
  const role = str(formData, "role");
  const email = str(formData, "email");
  const phone = str(formData, "phone");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "El nombre es obligatorio.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "Email inválido.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  let photoUrl: string | null = null;
  try {
    photoUrl = await uploadMedia(formData.get("photo"), "staff");
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("staff").insert({
    restaurant_id: restaurant.id,
    name,
    role: role || null,
    email: email || null,
    phone: phone || null,
    photo_url: photoUrl,
  });

  if (error) return { error: error.message };

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  redirect("/staff");
}

// ---------------------------------------------------------------------------
// FR-002 · Archive staff (R10 — never hard-delete domain data)
// ---------------------------------------------------------------------------
export async function archiveStaff(formData: FormData): Promise<void> {
  const id = str(formData, "id");
  if (!id) return;

  const supabase = createAdminClient();
  await supabase.from("staff").update({ status: "archived" }).eq("id", id);

  revalidatePath("/staff");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// FR-003 · NFC assignment (R1 one tag→one staff · R2 one active tag per staff)
// ---------------------------------------------------------------------------
export async function assignNfc(
  staffId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = str(formData, "nfc_code");
  if (!code) return { fieldErrors: { nfc_code: "El código NFC es obligatorio." } };

  const supabase = createAdminClient();

  // R1 · the code can't already belong to another (active) tag.
  const { data: existing } = await supabase
    .from("nfc_tags")
    .select("id, staff_id, status")
    .eq("nfc_code", code)
    .eq("status", "active")
    .maybeSingle();
  if (existing && existing.staff_id !== staffId)
    return { fieldErrors: { nfc_code: "Ese código ya está asignado a otro miembro." } };

  // R2 · deactivate any current active band for this staff before activating.
  await supabase
    .from("nfc_tags")
    .update({ status: "inactive" })
    .eq("staff_id", staffId)
    .eq("status", "active");

  const { error } = await supabase
    .from("nfc_tags")
    .insert({ staff_id: staffId, nfc_code: code, status: "active" });

  if (error) {
    if (error.code === "23505")
      return { fieldErrors: { nfc_code: "Ese código ya está en uso." } };
    return { error: error.message };
  }

  revalidatePath("/staff");
  redirect("/staff");
}
