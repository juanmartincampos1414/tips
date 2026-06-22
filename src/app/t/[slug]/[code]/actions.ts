"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type RecognitionState = {
  ok?: boolean;
  error?: string;
};

/**
 * Public guest recognition (Sprint 02A). Records an optional tip + a required
 * rating, then links them in a Recognition Event. No auth — the guest is
 * anonymous (guest_id stays null until the CRM sprint).
 */
export async function createRecognition(
  staffId: string,
  restaurantId: string,
  _prev: RecognitionState,
  formData: FormData,
): Promise<RecognitionState> {
  const rating = Number(formData.get("rating"));
  const amountRaw = (formData.get("amount") as string | null)?.trim() ?? "";
  const amount = amountRaw ? Number(amountRaw) : 0;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Elegí una valoración de 1 a 5 estrellas." };
  }
  if (Number.isNaN(amount) || amount < 0) {
    return { error: "El monto de la propina no es válido." };
  }

  const supabase = createAdminClient();

  // Optional tip.
  let tipId: string | null = null;
  if (amount > 0) {
    const { data: tip, error: tipErr } = await supabase
      .from("tips")
      .insert({ staff_id: staffId, amount, currency: "ARS" })
      .select("id")
      .single();
    if (tipErr) return { error: tipErr.message };
    tipId = tip.id;
  }

  // Required rating.
  const { data: ratingRow, error: ratingErr } = await supabase
    .from("ratings")
    .insert({ staff_id: staffId, rating })
    .select("id")
    .single();
  if (ratingErr) return { error: ratingErr.message };

  // Recognition Event linking both.
  const { error: reErr } = await supabase.from("recognition_events").insert({
    restaurant_id: restaurantId,
    staff_id: staffId,
    tip_id: tipId,
    rating_id: ratingRow.id,
    source: "nfc",
  });
  if (reErr) return { error: reErr.message };

  return { ok: true };
}
