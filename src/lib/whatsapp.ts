/**
 * WhatsApp linking: pure helpers shared by the API route, the profile card and
 * the confirm page.
 *
 * Why this shape: there is no "Log in with WhatsApp". The proof of phone
 * possession is inverted — the member receives an 8-character code on that
 * phone and confirms it inside their authenticated AP-Lab session. Neither half
 * is forgeable by the other, so the number is never typed into a form and never
 * has to be trusted as input.
 *
 * Everything here is deliberately dependency-free so a client component can
 * import it without dragging Prisma into the browser bundle.
 */

/** How long a pairing code stays valid, per Hermes. Copy must state it. */
export const CODE_TTL_MINUTES = 60;

/** Minimum gap between code requests, per Hermes rate limiting. */
export const CODE_REQUEST_COOLDOWN_MINUTES = 10;

/**
 * The LUMA bot number, digits only. Configured, never hardcoded: this is an
 * environment fact, not a property of the code.
 */
export function lumaWhatsappNumber(): string | null {
  const raw = (process.env.LUMA_WHATSAPP_NUMBER || "").replace(/\D/g, "");
  if (raw.length < 10) return null;
  return raw;
}

/**
 * The `wa.me` deep link with the message prefilled. Tapping it opens WhatsApp
 * with "link" already in the composer; the member only has to press Send.
 */
export function whatsappDeepLink(message = "link"): string | null {
  const number = lumaWhatsappNumber();
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Hermes codes are 8 characters from an unambiguous alphabet and are shown to
 * the member with a dash (`QWHC-R2WF`). Normalising here means the dash, spaces
 * and case a human types can never cause a mismatch against the store.
 */
export function normalizePairingCode(raw: string | null | undefined): string {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidPairingCode(raw: string | null | undefined): boolean {
  return /^[A-Z0-9]{8}$/.test(normalizePairingCode(raw));
}

/**
 * Pretty-print a digits-only number for display. Display only — never compare
 * against this, always compare the digits.
 */
export function formatPhone(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("62")) {
    const rest = digits.slice(2);
    // 851-3954-0316 reads more clearly than 85139540316 for a 10-digit local part.
    const groups = rest.length >= 10 ? [rest.slice(0, 3), rest.slice(3, 7), rest.slice(7)] : [rest];
    return `+62 ${groups.filter(Boolean).join("-")}`;
  }
  return `+${digits}`;
}

export type WhatsappLinkStatus = "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";

export type WhatsappState =
  | "not_configured"
  | "not_linked"
  | "awaiting_message"
  | "verifying"
  | "ready"
  | "failed"
  | "expired";

export type WhatsappLinkInfo = {
  state: WhatsappState;
  label: string;
  detail: string;
  phone: string | null;
  verifiedAt: string | null;
  lastError: string | null;
};

export function resolveWhatsappLink(input: {
  configured: boolean;
  status: WhatsappLinkStatus | null;
  phone: string | null;
  requestId: string | null;
  createdAt: Date | null;
  verifiedAt: Date | null;
  lastError: string | null;
  /** Injected so this stays pure and testable. */
  now?: Date;
}): WhatsappLinkInfo {
  const { configured, status, phone, requestId, createdAt, verifiedAt, lastError } = input;
  const now = input.now ?? new Date();

  const base = {
    phone: formatPhone(phone),
    verifiedAt: verifiedAt ? verifiedAt.toISOString() : null,
    lastError: lastError ?? null,
  };

  if (!configured) {
    return {
      ...base,
      state: "not_configured",
      label: "Not available",
      detail: "WhatsApp linking is not configured on this deployment.",
    };
  }

  if (!status) {
    return {
      ...base,
      state: "not_linked",
      label: "Not linked",
      detail: `Message LUMA on WhatsApp to receive a code, then confirm it here. The code is valid for ${CODE_TTL_MINUTES} minutes.`,
    };
  }

  if (status === "VERIFIED") {
    return {
      ...base,
      state: "ready",
      label: "Linked",
      detail: "LUMA will answer you on WhatsApp as yourself, with your own memory.",
    };
  }

  if (status === "FAILED") {
    return {
      ...base,
      state: "failed",
      label: "Could not link",
      detail: lastError || "The code could not be approved. Request a new one.",
    };
  }

  if (status === "EXPIRED") {
    return {
      ...base,
      state: "expired",
      label: "Code expired",
      detail: `That code is no longer valid. Message LUMA again for a new one — you can request one every ${CODE_REQUEST_COOLDOWN_MINUTES} minutes.`,
    };
  }

  // PENDING: a code was confirmed on the web, waiting for the host provisioner
  // (30 s timer) to approve it and resolve the number.
  const ageMinutes = createdAt ? (now.getTime() - createdAt.getTime()) / 60000 : 0;
  if (requestId && ageMinutes > CODE_TTL_MINUTES) {
    return {
      ...base,
      state: "expired",
      label: "Code expired",
      detail: "The code expired before it was approved. Message LUMA again for a new one.",
    };
  }

  if (!requestId) {
    return {
      ...base,
      state: "awaiting_message",
      label: "Waiting for your message",
      detail: "Open WhatsApp, send the prefilled message, then tap the link LUMA replies with.",
    };
  }

  return {
    ...base,
    state: "verifying",
    label: "Verifying…",
    detail: "Approving your code and setting up your route. This usually takes under a minute.",
  };
}
