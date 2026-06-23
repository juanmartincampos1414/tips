import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type NormalizedPhone = {
  phone_raw: string | null;
  phone_normalized: string | null; // E.164, e.g. +541155551234
  country_code: string | null; // ISO-3166 alpha-2, e.g. AR
  error: string | null;
};

/** Map a country name (ES/EN) to an ISO-3166 alpha-2 code for phone parsing. */
const COUNTRY_TO_ISO: Record<string, CountryCode> = {
  argentina: "AR",
  uruguay: "UY",
  espana: "ES",
  spain: "ES",
  chile: "CL",
  brasil: "BR",
  brazil: "BR",
  mexico: "MX",
  peru: "PE",
  colombia: "CO",
  paraguay: "PY",
  bolivia: "BO",
  ecuador: "EC",
  "estados unidos": "US",
  usa: "US",
  "united states": "US",
  italia: "IT",
  francia: "FR",
  alemania: "DE",
  portugal: "PT",
};

export function countryNameToIso(name?: string | null): CountryCode | undefined {
  if (!name) return undefined;
  const k = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  return COUNTRY_TO_ISO[k];
}

/** Normalize a phone to E.164. defaultCountry is used when there is no "+". */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = "AR",
): NormalizedPhone {
  const trimmed = (raw ?? "").trim();
  if (!trimmed)
    return { phone_raw: null, phone_normalized: null, country_code: null, error: null };
  const pn = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!pn || !pn.isValid())
    return {
      phone_raw: trimmed,
      phone_normalized: null,
      country_code: null,
      error: "Teléfono no válido / no normalizable",
    };
  return {
    phone_raw: trimmed,
    phone_normalized: pn.number,
    country_code: pn.country ?? null,
    error: null,
  };
}

/** Display format: +54 11 5555 1234. Falls back to the given value. */
export function formatPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const pn = parsePhoneNumberFromString(value);
  return pn ? pn.formatInternational() : value;
}

export type PreferredChannel = "email" | "whatsapp" | "sms" | "unknown";

export type ContactChannels = {
  has_email: boolean;
  has_phone: boolean;
  has_whatsapp: boolean;
  preferred_channel: PreferredChannel;
};

/** Computed contactability (omnichannel-ready). WhatsApp = a valid phone. */
export function contactChannels(params: {
  email: string | null;
  phoneNormalized: string | null;
  marketingConsent: boolean;
}): ContactChannels {
  const has_email = !!params.email;
  const has_phone = !!params.phoneNormalized;
  const has_whatsapp = has_phone;
  const preferred_channel: PreferredChannel = has_whatsapp
    ? "whatsapp"
    : has_email
      ? "email"
      : has_phone
        ? "sms"
        : "unknown";
  return { has_email, has_phone, has_whatsapp, preferred_channel };
}
