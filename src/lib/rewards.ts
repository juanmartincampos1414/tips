import type { RewardStatus, RewardType } from "@/lib/database.types";

/** Effective reward status, applying lazy expiration against the current time. */
export function effectiveRewardStatus(
  status: RewardStatus,
  expirationIso: string,
): RewardStatus {
  if (status === "claimed") return "claimed";
  if (status === "expired") return "expired";
  return new Date(expirationIso).getTime() < new Date().getTime()
    ? "expired"
    : "active";
}

export const REWARD_TYPES: { value: RewardType; label: string }[] = [
  { value: "cashback_percentage", label: "Cashback %" },
  { value: "cashback_fixed", label: "Cashback fijo" },
  { value: "free_item", label: "Producto gratis" },
  { value: "special_benefit", label: "Beneficio especial" },
];

export function rewardTypeLabel(type: RewardType) {
  return REWARD_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Headline value of a reward (the big number/word on the pass / success screen). */
export function rewardValueLabel(type: RewardType, value: number) {
  switch (type) {
    case "cashback_percentage":
      return `${value}%`;
    case "cashback_fixed":
      return "$" + Number(value).toLocaleString("es-AR");
    case "free_item":
      return "Gratis";
    default:
      return "Beneficio";
  }
}

/** A restaurant with no configured template still emits this. */
export const DEFAULT_TEMPLATE = {
  title: "10% de descuento",
  reward_type: "cashback_percentage" as RewardType,
  value: 10,
  expiration_days: 30,
};
