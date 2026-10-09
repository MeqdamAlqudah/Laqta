import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalizes a phone number to E.164 (+962790000000).
 * Local Jordanian numbers like "0790000000" are interpreted with the default country.
 * Arabic-Indic digits (٠-٩) are converted first, since Arabic keyboards produce them.
 */
export function normalizePhone(raw: string, defaultCountry: CountryCode = "JO"): string | null {
  const ascii = toAsciiDigits(raw).replace(/[^\d+]/g, "");
  if (!ascii) return null;
  const withPlus = ascii.startsWith("00") ? `+${ascii.slice(2)}` : ascii;
  const parsed = parsePhoneNumberFromString(withPlus, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  return v ? v : null;
}

export function toAsciiDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Strips control characters and HTML-ish tags; trims and collapses whitespace. */
export function sanitizeText(s: string | null | undefined, max = 500): string | null {
  if (!s) return null;
  const cleaned = s
    .replace(/<[^>]*>/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || null;
}

/** Display mask for logs/UI where full contact data must not appear: +9627****000 */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  return e164.length > 7 ? `${e164.slice(0, 5)}****${e164.slice(-3)}` : "****";
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [user, domain] = email.split("@");
  return `${user?.slice(0, 1) ?? ""}***@${domain ?? ""}`;
}
