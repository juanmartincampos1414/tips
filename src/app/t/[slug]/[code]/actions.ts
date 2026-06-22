"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewRoute } from "@/lib/database.types";

export type RecognitionState = {
  ok?: boolean;
  error?: string;
  route?: ReviewRoute;
  reviewRequestId?: string;
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

  return { ok: true, route, reviewRequestId: reviewRequest.id };
}

/** Guest tapped "leave a Google review": mark completed, then go to Google. */
export async function completeReview(reviewRequestId: string, url: string) {
  const supabase = createAdminClient();
  await supabase
    .from("review_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", reviewRequestId);
  redirect(url);
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
