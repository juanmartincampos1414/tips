import type { CampaignChannel, ConversionType } from "@/lib/database.types";
import type { Segment } from "@/lib/segments";

// -----------------------------------------------------------------------------
// Pure campaign helpers — no DB, no server-only. Safe to import from client
// components (the builder) and server code alike.
// -----------------------------------------------------------------------------

/** Targetable segments — mirror the operational lists in /clientes. */
export const SEGMENT_OPTIONS: { key: string; label: string }[] = [
  { key: "vip", label: "VIP" },
  { key: "returning", label: "Recurrentes" },
  { key: "new", label: "Nuevos" },
  { key: "at_risk", label: "En riesgo" },
  { key: "lost", label: "Perdidos" },
  { key: "active_rewards", label: "Con reward activa" },
  { key: "no_return", label: "Sin return visit" },
  { key: "imported", label: "Importados" },
  { key: "tips", label: "Por Tips" },
];

export function segmentLabel(key: string): string {
  return SEGMENT_OPTIONS.find((s) => s.key === key)?.label ?? key;
}

export const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

export const CONVERSION_LABEL: Record<ConversionType, string> = {
  reward_claim: "Reward reclamada",
  return_visit: "Return visit",
  review: "Review",
  recognition: "Recognition",
};

/** Minimal guest shape the audience filter needs — CrmGuest satisfies it. */
export type AudienceGuest = {
  id: string;
  segment: Segment;
  activeRewards: number;
  returnVisits: number;
  hasEmail: boolean;
  hasWhatsapp: boolean;
  marketing_consent: boolean;
  source: string;
};

/** Members of a targeting segment (before channel reachability). */
export function resolveAudience<T extends AudienceGuest>(
  guests: T[],
  segment: string,
): T[] {
  switch (segment) {
    case "vip":
    case "returning":
    case "new":
    case "at_risk":
    case "lost":
      return guests.filter((g) => g.segment === segment);
    case "active_rewards":
      return guests.filter((g) => g.activeRewards > 0);
    case "no_return":
      return guests.filter((g) => g.returnVisits === 0);
    case "imported":
      return guests.filter((g) => g.source === "import");
    case "tips":
      return guests.filter((g) => g.source !== "import");
    default:
      return [];
  }
}

/** Contactability: reachable on this channel AND consented. */
export function isReachable(g: AudienceGuest, channel: CampaignChannel): boolean {
  if (!g.marketing_consent) return false;
  return channel === "email" ? g.hasEmail : g.hasWhatsapp;
}

export type CampaignKpis = {
  audience: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number | null; // opened / delivered
  clickRate: number | null; // clicked / delivered
  rewardClaims: number;
  returnVisits: number;
  reviews: number;
  recognitions: number;
  conversions: number; // distinct converting guests
  conversionRate: number | null; // converting guests / audience
};

type RecipientLike = { status: string };
type ConversionLike = { guest_id: string; conversion_type: ConversionType };

export function computeCampaignKpis(
  audienceCount: number,
  recipients: RecipientLike[],
  conversions: ConversionLike[],
): CampaignKpis {
  const delivered = recipients.filter((r) =>
    ["delivered", "opened", "clicked"].includes(r.status),
  ).length;
  const opened = recipients.filter((r) =>
    ["opened", "clicked"].includes(r.status),
  ).length;
  const clicked = recipients.filter((r) => r.status === "clicked").length;
  const failed = recipients.filter((r) =>
    ["failed", "skipped"].includes(r.status),
  ).length;

  const byType = (t: ConversionType) =>
    conversions.filter((c) => c.conversion_type === t).length;
  const convertingGuests = new Set(conversions.map((c) => c.guest_id)).size;

  return {
    audience: audienceCount,
    delivered,
    opened,
    clicked,
    failed,
    openRate: delivered ? opened / delivered : null,
    clickRate: delivered ? clicked / delivered : null,
    rewardClaims: byType("reward_claim"),
    returnVisits: byType("return_visit"),
    reviews: byType("review"),
    recognitions: byType("recognition"),
    conversions: convertingGuests,
    conversionRate: audienceCount ? convertingGuests / audienceCount : null,
  };
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  sending: "Enviando",
  completed: "Completada",
  archived: "Archivada",
};

export const STATUS_CLS: Record<string, string> = {
  draft: "bg-muted/15 text-muted",
  scheduled: "bg-amber-100 text-amber-700",
  sending: "bg-amber-100 text-amber-700",
  completed: "bg-success/15 text-success",
  archived: "bg-dark/10 text-dark/60",
};
