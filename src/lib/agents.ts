/**
 * Handle allocation for lab agents.
 *
 * A handle is assigned exactly once, at grant time, and frozen forever. It
 * becomes the profile directory name (`res-<handle>`), so two rules matter
 * more than anything else here:
 *
 *   1. It must be a safe filesystem path segment. A name like "日本語" slugifies
 *      to nothing; falling back to `user-<shortid>` beats writing a directory
 *      nobody can type.
 *   2. It must never be regenerated. Renaming a user later does not move their
 *      agent, because the memory bank lives at the old path. Freezing is what
 *      makes that safe.
 *
 * Collisions resolve with a numeric suffix, assigned in insertion order so the
 * first claimant keeps the bare handle.
 */

/** Reserved because they would collide with infrastructure directories. */
const RESERVED = new Set([
  "default",
  "admin",
  "root",
  "system",
  "luma",
  "gateway",
  "pairing",
  "profiles",
  "hermes",
  "shared",
  "public",
  "test",
  "null",
  "undefined",
]);

const MAX_HANDLE_LENGTH = 32;

/**
 * Reduce a display name to a path-safe slug.
 *
 * Deliberately conservative: lowercase ASCII letters and digits only. Anything
 * else becomes a separator, which means non-Latin scripts collapse to empty and
 * are handled by the caller's fallback rather than producing mojibake paths.
 */
export function slugifyHandle(input: string): string {
  const slug = input
    .normalize("NFKD")
    // Strip diacritics so "José" becomes "jose", not "jos".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_HANDLE_LENGTH)
    // A trailing separator after truncation is ugly in a directory name.
    .replace(/-+$/, "");

  return slug;
}

/** First 8 hex chars of the uuid — enough to disambiguate, short enough to type. */
function shortId(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 8);
}

/**
 * Derive the preferred handle for a user, before collision resolution.
 * Exported separately so the UI can show a preview without touching the DB.
 */
export function preferredHandle(name: string, userId: string): string {
  const slug = slugifyHandle(name);
  if (slug.length >= 2 && !RESERVED.has(slug)) {
    return slug;
  }
  return `user-${shortId(userId)}`;
}

/**
 * Allocate a unique handle.
 *
 * `existing` must contain every handle currently in the table, including
 * suspended ones — a suspended agent still owns its directory, so reusing the
 * handle would silently hand a new user someone else's memory.
 */
export function allocateHandle(
  name: string,
  userId: string,
  existing: Iterable<string>,
): string {
  const taken = new Set(Array.from(existing, (h) => h.toLowerCase()));
  const base = preferredHandle(name, userId);

  if (!taken.has(base)) return base;

  // Count upward. Bounded so a pathological table cannot spin forever.
  for (let n = 2; n <= 999; n++) {
    const candidate = `${base}-${n}`.slice(0, MAX_HANDLE_LENGTH + 4);
    if (!taken.has(candidate)) return candidate;
  }

  // Nothing sensible left; fall back to the uuid, which cannot collide.
  return `user-${shortId(userId)}`;
}

/**
 * Validate a handle a human typed in by hand.
 * Returns null when valid, or a message naming the exact problem.
 */
export function validateHandle(handle: string): string | null {
  if (!handle) return "Handle cannot be empty";
  if (handle.length < 2) return "Handle must be at least 2 characters";
  if (handle.length > MAX_HANDLE_LENGTH) {
    return `Handle must be at most ${MAX_HANDLE_LENGTH} characters`;
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(handle)) {
    return "Use lowercase letters, digits and hyphens only; must start and end with a letter or digit";
  }
  if (handle.includes("--")) return "Handle cannot contain consecutive hyphens";
  if (RESERVED.has(handle)) return `"${handle}" is reserved`;
  return null;
}

/** Directory name for a handle. Single source of truth for the `res-` prefix. */
export function profileDirFor(handle: string): string {
  return `res-${handle}`;
}
