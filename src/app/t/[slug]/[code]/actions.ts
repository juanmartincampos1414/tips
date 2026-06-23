"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewRoute } from "@/lib/database.types";
import { normalizePhone } from "@/lib/phone";
import { DEFAULT_TEMPLATE, rewardValueLabel } from "@/lib/rewards";

export type RecognitionState = {
  ok?: boolean;
  error?: string;
  route?: ReviewRoute;
  reviewRequestId?: string;
  recognitionEventId?: string;
};

/**
 * Public guest recognition (Sprint 02A/B). Records an optional tip + a required
 * rating, links them in a Recognition Event, then opens a Review Request routed
 * by rating: >=4 → public_review, <=3 → private_feedback. No auth — anonymous.
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
  const { data: event, error: reErr } = await supabase
    .from("recognition_events")
    .insert({
      restaurant_id: restaurantId,
      staff_id: staffId,
      tip_id: tipId,
      rating_id: ratingRow.id,
      source: "nfc",
    })
    .select("id")
    .single();
  if (reErr) return { error: reErr.message };

  // Review routing (FR-009).
  const route: ReviewRoute = rating >= 4 ? "public_review" : "private_feedback";
  const { data: reviewRequest, error: rrErr } = await supabase
    .from("review_requests")
    .insert({
      recognition_event_id: event.id,
      restaurant_id: restaurantId,
      staff_id: staffId,
      route,
    })
    .select("id")
    .single();
  if (rrErr) return { error: rrErr.message };

  return {
    ok: true,
    route,
    reviewRequestId: reviewRequest.id,
    recognitionEventId: event.id,
  };
}

/** Guest tapped "leave a Google review": mark the request completed. */
export async function completeReview(reviewRequestId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("review_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", reviewRequestId);
}

export type FeedbackState = { done?: boolean; error?: string };

/** Guest submitted private feedback (rating <= 3). */
export async function submitFeedback(
  reviewRequestId: string,
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const feedback = (formData.get("feedback") as string | null)?.trim() ?? "";
  if (!feedback) return { error: "Contanos brevemente qué podríamos mejorar." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("review_requests")
    .update({
      status: "completed",
      feedback,
      completed_at: new Date().toISOString(),
    })
    .eq("id", reviewRequestId);
  if (error) return { error: error.message };

  return { done: true };
}

/** Guest dismissed the review/feedback step. */
export async function ignoreReview(reviewRequestId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("review_requests")
    .update({ status: "ignored", completed_at: new Date().toISOString() })
    .eq("id", reviewRequestId);
}

export type EmittedReward = {
  title: string;
  valueLabel: string;
  expiration: string;
  passIdentifier: string;
};

export type CaptureState = {
  done?: boolean;
  error?: string;
  reward?: EmittedReward;
};

/** Emit a reward for a guest from the restaurant's template (FR-014). */
async function emitReward(
  supabase: ReturnType<typeof createAdminClient>,
  restaurantId: string,
  guestId: string,
): Promise<EmittedReward | undefined> {
  // Use the restaurant's active template, or create a default one if none.
  let { data: template } = await supabase
    .from("reward_templates")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) {
    const { data: created } = await supabase
      .from("reward_templates")
      .insert({ restaurant_id: restaurantId, ...DEFAULT_TEMPLATE })
      .select("*")
      .single();
    template = created;
  }
  if (!template) return undefined;

  const expiration = new Date(
    Date.now() + template.expiration_days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: reward, error } = await supabase
    .from("rewards")
    .insert({
      guest_id: guestId,
      restaurant_id: restaurantId,
      template_id: template.id,
      title: template.title,
      reward_type: template.reward_type,
      value: template.value,
      source: "recognition",
      status: "active",
      expiration_date: expiration,
    })
    .select("id")
    .single();
  if (error || !reward) return undefined;

  // FR-019: generate a wallet pass (web provider) with a dynamic QR token.
  const passIdentifier = crypto.randomUUID();
  await supabase.from("wallet_passes").insert({
    guest_id: guestId,
    reward_id: reward.id,
    restaurant_id: restaurantId,
    wallet_provider: "web",
    wallet_pass_url: `/w/${passIdentifier}`,
    pass_identifier: passIdentifier,
    qr_code: `/w/${passIdentifier}/v`,
    status: "active",
  });

  return {
    title: template.title,
    valueLabel: rewardValueLabel(template.reward_type, template.value),
    expiration,
    passIdentifier,
  };
}

/**
 * Guest Capture (Sprint 03 · FR-011/012/015/021). Upserts a guest by email
 * within the restaurant, links them to the recognition event, and records the
 * serving staff as last_staff_id. Runs after recognition — never before.
 */
export async function captureGuest(
  recognitionEventId: string,
  restaurantId: string,
  staffId: string,
  _prev: CaptureState,
  formData: FormData,
): Promise<CaptureState> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const phone = (formData.get("phone") as string | null)?.trim() ?? "";
  const consent = formData.get("consent") === "on";

  if (!name) return { error: "Ingresá tu nombre." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Ingresá un email válido." };

  // Normalize the phone to E.164 (omnichannel-ready). Default AR for the pilot.
  const ph = normalizePhone(phone);

  const supabase = createAdminClient();

  // FR-012: create if new, update if the email already exists in this restaurant.
  const { data: existing } = await supabase
    .from("guests")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("email", email)
    .maybeSingle();

  let guestId: string;
  if (existing) {
    guestId = existing.id;
    await supabase
      .from("guests")
      .update({
        name,
        phone: ph.phone_raw,
        phone_normalized: ph.phone_normalized,
        country_code: ph.country_code,
        marketing_consent: consent,
        last_staff_id: staffId,
      })
      .eq("id", guestId);
  } else {
    const { data: created, error: insErr } = await supabase
      .from("guests")
      .insert({
        restaurant_id: restaurantId,
        name,
        email,
        phone: ph.phone_raw,
        phone_normalized: ph.phone_normalized,
        country_code: ph.country_code,
        marketing_consent: consent,
        last_staff_id: staffId,
        source: "recognition",
      })
      .select("id")
      .single();
    if (insErr) return { error: insErr.message };
    guestId = created.id;
  }

  // AC-021: associate the guest with the recognition event.
  await supabase
    .from("recognition_events")
    .update({ guest_id: guestId })
    .eq("id", recognitionEventId);

  // FR-014: emit a reward automatically.
  const reward = await emitReward(supabase, restaurantId, guestId);

  return { done: true, reward };
}
