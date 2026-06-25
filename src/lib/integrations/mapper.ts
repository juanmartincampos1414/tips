import type { ExternalGuest } from "./types";

// =============================================================================
// Mapping Layer — never assume a provider's field names. Every provider ships a
// Mapper that translates its raw shape into Tips' domain shapes. The Core only
// ever sees the normalized output; transformations live HERE, never in the Core.
//
//   Fudo: customer_name · Maitre: guest · Opera: profile_name  →  guest.name
// =============================================================================

export interface Mapper<TRaw> {
  toGuest(raw: TRaw): ExternalGuest;
}

/** A field-name map: which raw keys hold name/email/phone for this provider. */
export type GuestFieldMap = {
  id: string[];
  name: string[];
  email: string[];
  phone: string[];
  tags?: string[];
};

const pick = (raw: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
};

/** Build a guest mapper from a provider's field-name map. */
export function guestMapper(fields: GuestFieldMap): Mapper<Record<string, unknown>> {
  return {
    toGuest(raw) {
      const tags = fields.tags
        ? fields.tags.flatMap((k) => {
            const v = raw[k];
            return Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
          })
        : [];
      return {
        externalId: pick(raw, fields.id) ?? "",
        name: pick(raw, fields.name),
        email: pick(raw, fields.email),
        phone: pick(raw, fields.phone),
        tags,
        raw,
      };
    },
  };
}

// Example field maps per provider — proof the same Core handles different
// schemas with zero Core changes (just a different map).
export const GUEST_FIELD_MAPS: Record<string, GuestFieldMap> = {
  fudo: { id: ["id", "customer_id"], name: ["customer_name", "name"], email: ["email"], phone: ["phone", "telefono"] },
  maitre: { id: ["id"], name: ["guest", "nombre"], email: ["mail", "email"], phone: ["telefono", "phone"], tags: ["tags"] },
  opera: { id: ["profile_id"], name: ["profile_name"], email: ["email_address"], phone: ["phone_number"] },
  cloudbeds: { id: ["guestID"], name: ["guestName"], email: ["guestEmail"], phone: ["guestPhone"] },
  hubspot: { id: ["vid", "id"], name: ["firstname"], email: ["email"], phone: ["phone"] },
};
