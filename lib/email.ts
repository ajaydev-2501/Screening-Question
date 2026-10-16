/**
 * Email normalization for candidate identity.
 *
 * Normalization decides whether two inputs are the same person, so it is deliberately
 * conservative: transformations that every provider agrees on are applied universally, and
 * provider-specific folding is applied only where that provider is known to route the addresses
 * to the same mailbox. Folding a provider that does not support it would merge two genuinely
 * different people and lock one of them out of a single-attempt assessment.
 */

/** Providers that ignore everything after a `+` in the local part. */
const SUBADDRESS_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "fastmail.com",
  "fastmail.fm",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "hey.com",
]);

/** Providers that additionally ignore `.` in the local part. */
const DOT_INSENSITIVE_PROVIDERS = new Set(["gmail.com", "googlemail.com", "protonmail.com"]);

/**
 * Local-part lengths above 64 violate RFC 5321; total lengths above 254 violate RFC 5322.
 * Checked before normalization so a pathological input cannot be folded into a valid address.
 */
const MAX_LOCAL_PART_LENGTH = 64;
const MAX_EMAIL_LENGTH = 254;

const LOCAL_PART_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;

export type NormalizedEmail = {
  /** The folded address used for lookup and uniqueness. */
  normalized: string;
  /** The address as the candidate typed it, trimmed — used for display. */
  display: string;
  domain: string;
};

export class InvalidEmailError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidEmailError";
  }
}

export function normalizeEmail(raw: string): NormalizedEmail {
  const display = raw.trim();

  if (display.length === 0) {
    throw new InvalidEmailError("Enter your email address.");
  }
  if (display.length > MAX_EMAIL_LENGTH) {
    throw new InvalidEmailError("That email address is too long to be valid.");
  }
  if (/\s/.test(display)) {
    throw new InvalidEmailError("Email addresses cannot contain spaces.");
  }

  // NFKC collapses homoglyphs and full-width characters that would otherwise let one mailbox
  // register as two distinct strings.
  const folded = display.normalize("NFKC").toLowerCase();

  const atIndex = folded.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === folded.length - 1) {
    throw new InvalidEmailError("Enter a complete email address, like you@example.com.");
  }

  let localPart = folded.slice(0, atIndex);
  // Strip a trailing dot on the domain and reject domains with no dot or an invalid label.
  const domain = folded.slice(atIndex + 1).replace(/\.+$/, "");

  if (localPart.length === 0 || localPart.length > MAX_LOCAL_PART_LENGTH) {
    throw new InvalidEmailError("That email address is not valid.");
  }
  if (!LOCAL_PART_PATTERN.test(localPart)) {
    throw new InvalidEmailError("That email address contains characters we cannot accept.");
  }
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    throw new InvalidEmailError("That email address is not valid.");
  }
  if (!isValidDomain(domain)) {
    throw new InvalidEmailError("Enter a complete email address, like you@example.com.");
  }

  if (SUBADDRESS_PROVIDERS.has(domain)) {
    localPart = localPart.split("+", 1)[0] ?? localPart;
  }
  if (DOT_INSENSITIVE_PROVIDERS.has(domain)) {
    localPart = localPart.replace(/\./g, "");
  }

  if (localPart.length === 0) {
    throw new InvalidEmailError("That email address is not valid.");
  }

  return {
    normalized: `${localPart}@${domain}`,
    display,
    domain,
  };
}

function isValidDomain(domain: string): boolean {
  if (domain.length < 4 || domain.length > 253) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;

  for (const label of labels) {
    if (label.length === 0 || label.length > 63) return false;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) return false;
  }

  const tld = labels[labels.length - 1]!;
  // A TLD must be alphabetic (or an IDN already converted to punycode, hence alphanumeric) and
  // at least two characters; this rejects `name@localhost` and `name@host.1`.
  return /^[a-z]{2,}$/.test(tld);
}

/** Redacts an email for logs: keeps the first character and the domain, drops the rest. */
export function redactEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) return "[redacted]";
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  return `${local[0]}***@${domain}`;
}
