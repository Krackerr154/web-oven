/**
 * Who may use LUMA on the web.
 *
 * The Agent Access ledger is the authority. This module is the only place that
 * decides, so the route, the page and the memory bank all agree by construction.
 *
 * Two conditions, both required:
 *   1. the account is APPROVED — registration alone is never access;
 *   2. the account holds a GRANTED agent profile — an admin issued it.
 *
 * The handle comes from the ledger, never from the request. That is the whole
 * reason the handle is frozen at grant: it is the storage key for the person's
 * memory bank, so deriving it from user input would let one member read
 * another's.
 */

import { bankIdForHandle } from "./hindsight";

export type LumaAccess =
  | {
      allowed: true;
      userId: string;
      name: string;
      handle: string;
      bankId: string;
      /** True when a Hermes profile exists on disk for this handle. */
      profileHint: string;
    }
  | {
      allowed: false;
      reason: "signed-out" | "not-approved" | "not-granted" | "suspended";
      message: string;
    };

export async function resolveLumaAccess(
  prisma: any,
  userId: string | null | undefined,
): Promise<LumaAccess> {
  if (!userId) {
    return { allowed: false, reason: "signed-out", message: "Sign in to use LUMA." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      status: true,
      agentProfile: { select: { handle: true, status: true } },
    },
  });

  if (!user) {
    return { allowed: false, reason: "signed-out", message: "Sign in to use LUMA." };
  }

  if (user.status !== "APPROVED") {
    return {
      allowed: false,
      reason: "not-approved",
      message: "Your account is not approved yet.",
    };
  }

  const profile = user.agentProfile;
  if (!profile) {
    return {
      allowed: false,
      reason: "not-granted",
      message:
        "You do not have an agent yet. An administrator grants agent access from the Agent Access page.",
    };
  }

  if (profile.status !== "GRANTED") {
    return {
      allowed: false,
      reason: "suspended",
      message:
        "Your agent is suspended. An administrator can restore it — your memory is kept.",
    };
  }

  return {
    allowed: true,
    userId: user.id,
    name: user.name,
    handle: profile.handle,
    bankId: bankIdForHandle(profile.handle),
    profileHint: `res-${profile.handle}`,
  };
}
