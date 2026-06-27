"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { unsafeAdminClient } from "@/lib/supabase/admin";
import { tenantDb } from "@/lib/tenant/db";
import { createClient } from "@/lib/supabase/server";
import { logAudit, requireManager, requireOwner } from "@/lib/auth";
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

  const supabase = unsafeAdminClient();
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

  const supabase = unsafeAdminClient();

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

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .insert({
      name,
      slug,
      email: email || null,
      phone: phone || null,
      logo_url: logoUrl,
      owner_id: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !restaurant) return { error: error?.message ?? "Error" };

  // The creator becomes the owner member (source of truth for access).
  if (user) {
    await supabase.from("restaurant_members").insert({
      restaurant_id: restaurant.id,
      user_id: user.id,
      role: "owner",
    });
    await logAudit({
      restaurantId: restaurant.id,
      userId: user.id,
      action: "restaurant.created",
      entityType: "restaurant",
      entityId: restaurant.id,
      metadata: { name },
    });
  }

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
  const member = await requireManager();
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

  const supabase = unsafeAdminClient();
  const { data: created, error } = await supabase
    .from("staff")
    .insert({
      restaurant_id: restaurant.id,
      name,
      role: role || null,
      email: email || null,
      phone: phone || null,
      photo_url: photoUrl,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    restaurantId: restaurant.id,
    userId: member.userId,
    action: "staff.created",
    entityType: "staff",
    entityId: created?.id ?? null,
    metadata: { name, role: role || null },
  });

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  redirect("/staff");
}

// ---------------------------------------------------------------------------
// FR-002 · Archive staff (R10 — never hard-delete domain data)
// ---------------------------------------------------------------------------
export async function archiveStaff(formData: FormData): Promise<void> {
  const member = await requireManager();
  const id = str(formData, "id");
  if (!id) return;

  const supabase = unsafeAdminClient();
  await supabase.from("staff").update({ status: "archived" }).eq("id", id);

  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "staff.archived",
    entityType: "staff",
    entityId: id,
  });

  revalidatePath("/staff");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Sprint 04A · Reward templates (FR-018)
// ---------------------------------------------------------------------------
export async function createRewardTemplate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const member = await requireManager();
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/setup");

  const title = str(formData, "title");
  const rewardType = str(formData, "reward_type");
  const value = Number(str(formData, "value") || "0");
  const expirationDays = Number(str(formData, "expiration_days") || "30");

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Poné un nombre al beneficio.";
  if (
    !["cashback_percentage", "cashback_fixed", "free_item", "special_benefit"].includes(
      rewardType,
    )
  )
    fieldErrors.reward_type = "Elegí un tipo.";
  if (Number.isNaN(value) || value < 0) fieldErrors.value = "Valor inválido.";
  if (!Number.isInteger(expirationDays) || expirationDays < 1)
    fieldErrors.expiration_days = "Días inválidos.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { data: tpl, error } = await tenantDb(restaurant.id)
    .insert("reward_templates", {
      title,
      reward_type: rewardType as
        | "cashback_percentage"
        | "cashback_fixed"
        | "free_item"
        | "special_benefit",
      value,
      expiration_days: expirationDays,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    restaurantId: restaurant.id,
    userId: member.userId,
    action: "reward_template.created",
    entityType: "reward_template",
    entityId: tpl?.id ?? null,
    metadata: { title, reward_type: rewardType, value },
  });

  revalidatePath("/recompensas");
  redirect("/recompensas");
}

// ---------------------------------------------------------------------------
// Sprint 04A · Reward claim → Return Visit (FR-021/022)
// ---------------------------------------------------------------------------
export async function claimReward(formData: FormData): Promise<void> {
  const member = await requireManager();
  const rewardId = str(formData, "reward_id");
  if (!rewardId) return;

  // Scoped to the manager's tenant — reading by id alone would let a manager
  // claim another restaurant's reward (closes that isolation gap).
  const db = tenantDb(member.restaurantId);
  const { data: reward } = (await db
    .select("rewards", "id, guest_id, status")
    .eq("id", rewardId)
    .maybeSingle()) as { data: { id: string; guest_id: string; status: string } | null };

  // R7: a redeemed reward can't be reused.
  if (!reward || reward.status !== "active") return;

  await db.update("rewards", { status: "claimed" }).eq("id", reward.id);
  await db.insert("reward_claims", {
    reward_id: reward.id,
    guest_id: reward.guest_id,
  });
  await db.insert("return_visits", {
    guest_id: reward.guest_id,
    reward_id: reward.id,
  });

  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "reward.claimed",
    entityType: "reward",
    entityId: reward.id,
    metadata: { via: "manager" },
  });

  revalidatePath("/recompensas");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Sprint 05A · Team management (owner-only) — create Manager/Staff accounts
// ---------------------------------------------------------------------------
export async function createMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const owner = await requireOwner();

  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const role = str(formData, "role");
  const staffId = str(formData, "staff_id");

  const fieldErrors: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "Email inválido.";
  if (password.length < 8)
    fieldErrors.password = "Mínimo 8 caracteres.";
  if (!["manager", "staff"].includes(role))
    fieldErrors.role = "Elegí un rol.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = unsafeAdminClient();

  const { data: created, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created.user) {
    return { error: "No se pudo crear el usuario (¿email ya registrado?)." };
  }

  const { error: memErr } = await supabase.from("restaurant_members").insert({
    restaurant_id: owner.restaurantId,
    user_id: created.user.id,
    role: role as "manager" | "staff",
    staff_id: role === "staff" && staffId ? staffId : null,
  });
  if (memErr) return { error: memErr.message };

  await logAudit({
    restaurantId: owner.restaurantId,
    userId: owner.userId,
    action: "member.created",
    entityType: "member",
    entityId: created.user.id,
    metadata: { email, role },
  });

  revalidatePath("/equipo");
  redirect("/equipo");
}

// ---------------------------------------------------------------------------
// Sprint 05A · Restaurant settings (owner-only) — Google reviews config
// ---------------------------------------------------------------------------
export async function updateSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const owner = await requireOwner();
  const placeId = str(formData, "google_place_id");
  const reviewUrl = str(formData, "google_review_url");
  const senderName = str(formData, "sender_name");
  const senderEmail = str(formData, "sender_email");
  const replyTo = str(formData, "reply_to_email");
  const emailEnabled = formData.get("email_enabled") === "on";

  if (reviewUrl && !/^https?:\/\//.test(reviewUrl))
    return { fieldErrors: { google_review_url: "Tiene que empezar con http(s)://" } };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (senderEmail && !emailRe.test(senderEmail))
    return { fieldErrors: { sender_email: "Email inválido." } };
  if (replyTo && !emailRe.test(replyTo))
    return { fieldErrors: { reply_to_email: "Email inválido." } };

  const supabase = unsafeAdminClient();
  const { error } = await supabase
    .from("restaurant_settings")
    .upsert(
      {
        restaurant_id: owner.restaurantId,
        google_place_id: placeId || null,
        google_review_url: reviewUrl || null,
        sender_name: senderName || null,
        sender_email: senderEmail || null,
        reply_to_email: replyTo || null,
        email_enabled: emailEnabled,
      },
      { onConflict: "restaurant_id" },
    );
  if (error) return { error: error.message };

  await logAudit({
    restaurantId: owner.restaurantId,
    userId: owner.userId,
    action: "settings.updated",
    entityType: "restaurant_settings",
    entityId: owner.restaurantId,
  });

  revalidatePath("/configuracion");
  return { };
}

// ---------------------------------------------------------------------------
// Sprint 05B · NFC Operations (inventory + lifecycle + history)
// ---------------------------------------------------------------------------
async function logNfcEvent(
  nfcId: string,
  restaurantId: string,
  staffId: string | null,
  event: "created" | "assigned" | "replaced" | "unassigned" | "lost" | "damaged" | "archived",
  userId: string,
) {
  const supabase = unsafeAdminClient();
  await supabase.from("nfc_events").insert({
    nfc_id: nfcId,
    restaurant_id: restaurantId,
    staff_id: staffId,
    event,
    created_by: userId,
  });
}

export async function createNfc(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const member = await requireManager();
  const serial = str(formData, "serial_number");
  const uid = str(formData, "uid");

  const fieldErrors: Record<string, string> = {};
  if (!serial) fieldErrors.serial_number = "Serial obligatorio.";
  if (!uid) fieldErrors.uid = "UID obligatorio.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = unsafeAdminClient();
  const { data: band, error } = await supabase
    .from("nfc_inventory")
    .insert({ restaurant_id: member.restaurantId, serial_number: serial, uid, status: "stock" })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return { fieldErrors: { uid: "Ese UID ya existe en el inventario." } };
    return { error: error.message };
  }

  await logNfcEvent(band.id, member.restaurantId, null, "created", member.userId);
  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "nfc.created",
    entityType: "nfc_inventory",
    entityId: band.id,
    metadata: { serial_number: serial, uid },
  });

  revalidatePath("/nfc");
  redirect("/nfc");
}

export async function assignNfcBand(formData: FormData): Promise<void> {
  const member = await requireManager();
  const nfcId = str(formData, "nfc_id");
  const staffId = str(formData, "staff_id");
  if (!nfcId || !staffId) return;

  const supabase = unsafeAdminClient();
  const { data: band } = await supabase
    .from("nfc_inventory")
    .select("id, status, restaurant_id")
    .eq("id", nfcId)
    .maybeSingle();
  if (!band || band.status !== "stock") return;

  // Replace: free the staff's current assigned band (back to stock).
  const { data: current } = await supabase
    .from("nfc_inventory")
    .select("id")
    .eq("assigned_staff_id", staffId)
    .eq("status", "assigned")
    .maybeSingle();
  if (current) {
    await supabase
      .from("nfc_inventory")
      .update({ status: "stock", assigned_staff_id: null, assigned_at: null })
      .eq("id", current.id);
    await logNfcEvent(current.id, band.restaurant_id, staffId, "replaced", member.userId);
    await logAudit({
      restaurantId: band.restaurant_id,
      userId: member.userId,
      action: "nfc.replaced",
      entityType: "nfc_inventory",
      entityId: current.id,
      metadata: { staff_id: staffId },
    });
  }

  await supabase
    .from("nfc_inventory")
    .update({
      status: "assigned",
      assigned_staff_id: staffId,
      assigned_at: new Date().toISOString(),
    })
    .eq("id", nfcId);
  await logNfcEvent(nfcId, band.restaurant_id, staffId, "assigned", member.userId);
  await logAudit({
    restaurantId: band.restaurant_id,
    userId: member.userId,
    action: "nfc.assigned",
    entityType: "nfc_inventory",
    entityId: nfcId,
    metadata: { staff_id: staffId },
  });

  revalidatePath("/nfc");
  revalidatePath("/staff");
}

export async function markNfcStatus(formData: FormData): Promise<void> {
  const member = await requireManager();
  const nfcId = str(formData, "nfc_id");
  const status = str(formData, "status");
  if (!nfcId || !["lost", "damaged", "archived"].includes(status)) return;

  const supabase = unsafeAdminClient();
  const { data: band } = await supabase
    .from("nfc_inventory")
    .select("id, restaurant_id, assigned_staff_id")
    .eq("id", nfcId)
    .maybeSingle();
  if (!band) return;

  await supabase
    .from("nfc_inventory")
    .update({ status: status as "lost" | "damaged" | "archived" })
    .eq("id", nfcId);
  await logNfcEvent(
    nfcId,
    band.restaurant_id,
    band.assigned_staff_id,
    status as "lost" | "damaged" | "archived",
    member.userId,
  );
  await logAudit({
    restaurantId: band.restaurant_id,
    userId: member.userId,
    action: `nfc.${status}`,
    entityType: "nfc_inventory",
    entityId: nfcId,
  });

  revalidatePath("/nfc");
  revalidatePath("/staff");
}

// ---------------------------------------------------------------------------
// Sprint 06A · Guest notes & tags
// ---------------------------------------------------------------------------
export async function addGuestNote(formData: FormData): Promise<void> {
  const member = await requireManager();
  const guestId = str(formData, "guest_id");
  const body = str(formData, "body");
  if (!guestId || !body) return;

  await tenantDb(member.restaurantId).insert("guest_notes", {
    guest_id: guestId,
    body,
    created_by: member.userId,
  });
  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "guest.note_added",
    entityType: "guest",
    entityId: guestId,
  });
  revalidatePath(`/clientes/${guestId}`);
}

export async function addGuestTag(formData: FormData): Promise<void> {
  const member = await requireManager();
  const guestId = str(formData, "guest_id");
  const tag = str(formData, "tag");
  if (!guestId || !tag) return;

  await tenantDb(member.restaurantId)
    .insert("guest_tags", {
      guest_id: guestId,
      tag,
      created_by: member.userId,
    })
    .select("id")
    .maybeSingle();
  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "guest.tag_added",
    entityType: "guest",
    entityId: guestId,
    metadata: { tag },
  });
  revalidatePath(`/clientes/${guestId}`);
}

export async function removeGuestTag(formData: FormData): Promise<void> {
  const member = await requireManager();
  const tagId = str(formData, "tag_id");
  const guestId = str(formData, "guest_id");
  if (!tagId) return;

  await tenantDb(member.restaurantId).delete("guest_tags").eq("id", tagId);
  if (guestId) revalidatePath(`/clientes/${guestId}`);
}
