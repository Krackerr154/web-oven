"use server";

/**
 * Agent access control.
 *
 * Two rules are enforced here and nowhere else:
 *
 *   1. Only ADMIN may grant. Not CPD_ADMIN. An agent is an LLM with Python
 *      execution in a quota'd workspace; that is a different class of access
 *      from approving a supercritical-drying booking.
 *   2. Only an APPROVED account may be granted. Registration alone is never
 *      access — otherwise a public signup form becomes an LLM grant.
 *
 * Revoke archives, never deletes. A student who leaves and comes back must
 * still have their thesis notes.
 */

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { allocateHandle, validateHandle } from "@/lib/agents";

type ActionResult = { success: boolean; message: string };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = ((session?.user as { roles?: string[] } | undefined)?.roles) ?? [];
  if (!session?.user || !roles.includes("ADMIN")) {
    throw new Error("Only an administrator can manage agent access");
  }
  return session as typeof session & { user: { id: string; name?: string | null } };
}

/** Every handle in the table, including suspended ones — they still own a directory. */
async function allHandles(): Promise<string[]> {
  const rows = await prisma.agentProfile.findMany({ select: { handle: true } });
  return rows.map((r) => r.handle);
}

/**
 * Who is even eligible to appear on the screen.
 * PENDING and REJECTED accounts are excluded, not merely disabled.
 */
export async function listAgentCandidates() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      roles: true,
      status: true,
      agentProfile: {
        select: {
          id: true,
          handle: true,
          status: true,
          grantedAt: true,
          revokedAt: true,
          revokedReason: true,
          provisionedAt: true,
          lastError: true,
          grantedBy: { select: { name: true } },
          revokedBy: { select: { name: true } },
        },
      },
    },
  });
  return users;
}

/** Preview the handle that would be issued, without writing anything. */
export async function previewHandle(userId: string): Promise<string> {
  await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!user) return "";
  return allocateHandle(user.name, userId, await allHandles());
}

const grantSchema = z.object({
  userId: z.string().uuid(),
  /** Optional admin override. Empty means "allocate one". */
  handle: z.string().optional(),
});

export async function grantAgent(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Only an administrator can grant agent access" };
  }

  const parsed = grantSchema.safeParse({
    userId: formData.get("userId"),
    handle: formData.get("handle") || undefined,
  });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { userId } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, status: true, agentProfile: true },
  });
  if (!user) return { success: false, message: "User not found" };

  // The gate. An account that has not been approved by an admin cannot hold
  // an agent, no matter who clicks the button.
  if (user.status !== "APPROVED") {
    return {
      success: false,
      message: `${user.name}'s account is ${user.status} — approve the account before granting an agent`,
    };
  }

  const existing = await allHandles();
  let handle: string;

  if (parsed.data.handle) {
    const problem = validateHandle(parsed.data.handle);
    if (problem) return { success: false, message: problem };
    if (existing.some((h) => h.toLowerCase() === parsed.data.handle!.toLowerCase())) {
      return { success: false, message: `Handle "${parsed.data.handle}" is already taken` };
    }
    handle = parsed.data.handle;
  } else {
    handle = allocateHandle(user.name, user.id, existing);
  }

  try {
    // Restoring a suspended agent keeps its original handle — the directory
    // on disk is named after it, and renaming would orphan the memory.
    if (user.agentProfile) {
      if (user.agentProfile.status === "GRANTED") {
        return { success: false, message: `${user.name} already has agent access` };
      }
      await prisma.agentProfile.update({
        where: { id: user.agentProfile.id },
        data: {
          status: "GRANTED",
          grantedAt: new Date(),
          grantedById: session.user.id,
          revokedAt: null,
          revokedById: null,
          revokedReason: null,
        },
      });
      revalidatePath("/admin/agents");
      return {
        success: true,
        message: `Agent access restored for ${user.name} as "${user.agentProfile.handle}"`,
      };
    }

    await prisma.agentProfile.create({
      data: {
        userId: user.id,
        handle,
        status: "GRANTED",
        grantedAt: new Date(),
        grantedById: session.user.id,
      },
    });
    revalidatePath("/admin/agents");
    return { success: true, message: `Agent access granted to ${user.name} as "${handle}"` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("Unique constraint")) {
      return { success: false, message: "That handle was just taken — try again" };
    }
    return { success: false, message: msg };
  }
}

const revokeSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(240).optional(),
});

export async function revokeAgent(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Only an administrator can revoke agent access" };
  }

  const parsed = revokeSchema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await prisma.agentProfile.findUnique({
    where: { userId: parsed.data.userId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) return { success: false, message: "No agent profile for that user" };
  if (profile.status === "SUSPENDED") {
    return { success: false, message: `${profile.user.name}'s agent is already suspended` };
  }

  // Archive, never delete. The row stays; the memory bank stays on disk.
  await prisma.agentProfile.update({
    where: { id: profile.id },
    data: {
      status: "SUSPENDED",
      revokedAt: new Date(),
      revokedById: session.user.id,
      revokedReason: parsed.data.reason ?? null,
    },
  });

  revalidatePath("/admin/agents");
  return {
    success: true,
    message: `${profile.user.name}'s agent suspended — profile and memory kept on disk`,
  };
}

/** Roll a mistakenly-issued handle back to PENDING. Only allowed before provisioning. */
export async function resetAgent(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Only an administrator can reset agent access" };
  }

  const userId = String(formData.get("userId") ?? "");
  const profile = await prisma.agentProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) return { success: false, message: "No agent profile for that user" };

  // Once a profile exists on disk the handle is load-bearing. Refuse rather
  // than orphan a directory that may hold a semester of research notes.
  if (profile.provisionedAt) {
    return {
      success: false,
      message: `"${profile.handle}" has already been provisioned — suspend it instead of resetting`,
    };
  }

  await prisma.agentProfile.delete({ where: { id: profile.id } });
  revalidatePath("/admin/agents");
  return { success: true, message: `Handle "${profile.handle}" released` };
}

/** Counts for the stat strip. */
export async function agentStats() {
  await requireAdmin();
  const [granted, pending, suspended, total] = await Promise.all([
    prisma.agentProfile.count({ where: { status: "GRANTED" } }),
    prisma.agentProfile.count({ where: { status: "PENDING" } }),
    prisma.agentProfile.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { status: "APPROVED" } }),
  ]);
  return { granted, pending, suspended, approvedUsers: total };
}
