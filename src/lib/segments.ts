export type Segment = "new" | "returning" | "vip" | "at_risk" | "lost";

export const SEGMENT_LABEL: Record<Segment, string> = {
  new: "Nuevo",
  returning: "Recurrente",
  vip: "VIP",
  at_risk: "En riesgo",
  lost: "Perdido",
};

export const SEGMENT_CLS: Record<Segment, string> = {
  new: "bg-background text-muted",
  returning: "bg-pink/10 text-pink",
  vip: "bg-success/10 text-success",
  at_risk: "bg-warning/10 text-warning",
  lost: "bg-dark/10 text-dark",
};

export type GuestStats = {
  recognitionEvents: number;
  reviews: number;
  avgRating: number | null;
  rewardsIssued: number;
  rewardsClaimed: number;
  returnVisits: number;
  lastActivity: string | null;
};

const daysSince = (iso: string | null) =>
  iso == null
    ? Infinity
    : (new Date().getTime() - new Date(iso).getTime()) / 86_400_000;

/**
 * Simple, configurable-later segmentation rules (Sprint 06A).
 * VIP > Lost > At Risk > Returning > New.
 */
export function computeSegment(stats: GuestStats): Segment {
  const inactive = daysSince(stats.lastActivity);
  if (stats.returnVisits >= 3) return "vip";
  if (inactive > 90) return "lost";
  if (inactive > 30) return "at_risk";
  if (stats.returnVisits >= 1) return "returning";
  return "new";
}

/** Internal guest score (0–100). Weighted by loyalty signals. Tunable. */
export function computeScore(stats: GuestStats): number {
  const raw =
    stats.returnVisits * 15 +
    stats.recognitionEvents * 5 +
    stats.rewardsClaimed * 10 +
    Math.round((stats.avgRating ?? 0) * 4);
  return Math.min(100, raw);
}
