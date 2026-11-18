import crypto from "crypto";

/**
 * Telegram Login Widget verification.
 *
 * The widget hands the browser a payload signed with Telegram's private key:
 *
 *   data-check-string = sorted "key=value" lines joined with "\n"
 *   secret            = SHA256(bot_token)          <- raw 32 bytes, not hex
 *   signature         = HMAC-SHA256(data-check-string, secret)
 *
 * We store only that derived 32-byte secret (`TELEGRAM_LOGIN_SECRET`, hex).
 * It is enough to *verify* a signature and is not enough to call the Bot API,
 * so AP-Lab never holds a usable bot credential. The bot token stays in one
 * place: the LUMA gateway.
 *
 * Replay is bounded by `auth_date`: a captured payload is worthless after
 * AUTH_MAX_AGE_SECONDS. The widget signs auth_date, so it cannot be forged.
 */

export const TELEGRAM_BOT_USERNAME =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "LUMA154_bot";

/** A signed payload older than this is refused. */
const AUTH_MAX_AGE_SECONDS = 300;
/** Tolerated clock skew for auth_date slightly in the future. */
const AUTH_MAX_SKEW_SECONDS = 60;

export type TelegramAuthPayload = {
    id?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    username?: unknown;
    photo_url?: unknown;
    auth_date?: unknown;
    hash?: unknown;
};

export type TelegramVerifyResult =
    | { ok: true; userId: bigint; username: string | null }
    | { ok: false; error: TelegramVerifyError };

export type TelegramVerifyError =
    | "telegram_login_not_configured"
    | "malformed_payload"
    | "malformed_hash"
    | "malformed_id"
    | "malformed_auth_date"
    | "signature_mismatch"
    | "auth_expired"
    | "auth_date_in_future";

/** Derived HMAC key, or null when the deployment has not been configured. */
export function telegramSecretKey(): Buffer | null {
    const hex = (process.env.TELEGRAM_LOGIN_SECRET || "").trim();
    if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
    return Buffer.from(hex, "hex");
}

/**
 * The exact string Telegram signs. Exported so a test can build a synthetic
 * payload with the same code path the verifier uses — a verifier tested
 * against a hand-written expectation proves nothing.
 */
export function buildDataCheckString(payload: TelegramAuthPayload): string {
    return Object.entries(payload)
        .filter(([key, value]) => key !== "hash" && value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${String(value)}`)
        .sort()
        .join("\n");
}

export function verifyTelegramAuth(
    payload: TelegramAuthPayload,
    nowSeconds: number = Math.floor(Date.now() / 1000)
): TelegramVerifyResult {
    const secret = telegramSecretKey();
    if (!secret) return { ok: false, error: "telegram_login_not_configured" };

    // Telegram's widget hands the browser `id` and `auth_date` as JSON
    // *numbers*, not strings, while the data-check-string is built from their
    // text form. Refusing non-string values here rejects every real login with
    // `malformed_payload` even though the signature is correct — coerce
    // integral numbers instead, and reject only genuinely unstringifiable
    // input (objects, arrays, booleans, floats).
    //
    // Line breaks are refused because the data-check string is
    // newline-delimited: an embedded newline could smuggle an extra field into
    // what Telegram signed.
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null) continue;
        if (key.length === 0) return { ok: false, error: "malformed_payload" };
        if (typeof value === "string") {
            if (/[\r\n]/.test(value)) return { ok: false, error: "malformed_payload" };
            fields[key] = value;
        } else if (typeof value === "number" && Number.isSafeInteger(value)) {
            fields[key] = String(value);
        } else {
            return { ok: false, error: "malformed_payload" };
        }
    }

    const hash = fields.hash;
    if (typeof hash !== "string" || !/^[0-9a-f]{64}$/i.test(hash)) {
        return { ok: false, error: "malformed_hash" };
    }

    const rawId = fields.id;
    if (typeof rawId !== "string" || !/^\d{1,20}$/.test(rawId)) {
        return { ok: false, error: "malformed_id" };
    }

    const rawAuthDate = fields.auth_date;
    if (typeof rawAuthDate !== "string" || !/^\d{1,12}$/.test(rawAuthDate)) {
        return { ok: false, error: "malformed_auth_date" };
    }
    const authDate = Number(rawAuthDate);
    if (authDate > nowSeconds + AUTH_MAX_SKEW_SECONDS) {
        return { ok: false, error: "auth_date_in_future" };
    }
    if (nowSeconds - authDate > AUTH_MAX_AGE_SECONDS) {
        return { ok: false, error: "auth_expired" };
    }

    const expected = crypto
        .createHmac("sha256", secret)
        .update(buildDataCheckString(fields))
        .digest();
    const provided = Buffer.from(hash, "hex");
    if (provided.length !== expected.length || !crypto.timingSafeEqual(expected, provided)) {
        return { ok: false, error: "signature_mismatch" };
    }

    const username = typeof fields.username === "string" && fields.username.trim()
        ? fields.username.trim().slice(0, 64)
        : null;

    return { ok: true, userId: BigInt(rawId), username };
}

/** Human-readable text for the client. Never leaks which check detail failed. */
export function telegramErrorText(error: TelegramVerifyError): string {
    switch (error) {
        case "telegram_login_not_configured":
            return "Telegram linking is not configured on this server yet.";
        case "auth_expired":
            return "That Telegram confirmation expired. Please try again.";
        case "signature_mismatch":
        case "malformed_hash":
        case "malformed_payload":
            return "Telegram's confirmation could not be verified. Please try again.";
        default:
            return "Telegram returned an unexpected response. Please try again.";
    }
}
