"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
};

async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { success: false, message: "Admin access required" };
  }
  return null;
}

// ─── User Management ─────────────────────────────────────────────────

export async function approveUser(userId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: "APPROVED" },
    });
    revalidatePath("/admin/users");
    return { success: true, message: "User approved" };
  } catch {
    return { success: false, message: "Failed to approve user" };
  }
}

export async function rejectUser(userId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: "REJECTED" },
    });
    revalidatePath("/admin/users");
    return { success: true, message: "User rejected" };
  } catch {
    return { success: false, message: "Failed to reject user" };
  }
}

export async function getPendingUsers() {
  const guard = await requireAdmin();
  if (guard) return [];

  return prisma.user.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllUsers() {
  const guard = await requireAdmin();
  if (guard) return [];

  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
  });
}

// ─── Oven Management ─────────────────────────────────────────────────

export async function setOvenMaintenance(ovenId: number): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    // Transaction: set maintenance + auto-cancel active bookings
    await prisma.$transaction(async (tx) => {
      await tx.oven.update({
        where: { id: ovenId },
        data: { status: "MAINTENANCE" },
      });

      await tx.booking.updateMany({
        where: {
          ovenId,
          status: "ACTIVE",
        },
        data: { status: "AUTO_CANCELLED" },
      });
    });

    revalidatePath("/admin/ovens");
    revalidatePath("/");
    return {
      success: true,
      message: "Oven set to maintenance. All active bookings have been auto-cancelled.",
    };
  } catch {
    return { success: false, message: "Failed to set maintenance mode" };
  }
}

export async function clearOvenMaintenance(ovenId: number): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    await prisma.oven.update({
      where: { id: ovenId },
      data: { status: "AVAILABLE" },
    });

    revalidatePath("/admin/ovens");
    revalidatePath("/");
    return { success: true, message: "Oven is now available for bookings" };
  } catch {
    return { success: false, message: "Failed to clear maintenance mode" };
  }
}

// ─── Booking Management (Admin) ──────────────────────────────────────

export async function getAllBookings() {
  const guard = await requireAdmin();
  if (guard) return [];

  return prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      oven: { select: { name: true, type: true } },
    },
  });
}

// ─── Oven CRUD ───────────────────────────────────────────────────────

const ovenSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["NON_AQUEOUS", "AQUEOUS"]),
  description: z.string().max(500).optional(),
  maxTemp: z.coerce.number().int().min(1, "Max temp must be at least 1°C").max(1000, "Max temp cannot exceed 1000°C").default(200),
});

export async function createOven(formData: FormData): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const parsed = ovenSchema.parse({
      name: formData.get("name"),
      type: formData.get("type"),
      description: formData.get("description") || undefined,
      maxTemp: formData.get("maxTemp") || 200,
    });

    await prisma.oven.create({
      data: {
        name: parsed.name,
        type: parsed.type,
        description: parsed.description || null,
        maxTemp: parsed.maxTemp,
      },
    });

    revalidatePath("/admin/ovens");
    revalidatePath("/book");
    revalidatePath("/");
    return { success: true, message: "Oven created successfully" };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "Failed to create oven" };
  }
}

export async function updateOven(
  ovenId: number,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const parsed = ovenSchema.parse({
      name: formData.get("name"),
      type: formData.get("type"),
      description: formData.get("description") || undefined,
      maxTemp: formData.get("maxTemp") || 200,
    });

    await prisma.oven.update({
      where: { id: ovenId },
      data: {
        name: parsed.name,
        type: parsed.type,
        description: parsed.description || null,
        maxTemp: parsed.maxTemp,
      },
    });

    revalidatePath("/admin/ovens");
    revalidatePath("/book");
    revalidatePath("/");
    return { success: true, message: "Oven updated successfully" };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "Failed to update oven" };
  }
}

export async function deleteOven(ovenId: number): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    // Check for active bookings
    const activeCount = await prisma.booking.count({
      where: { ovenId, status: "ACTIVE" },
    });

    if (activeCount > 0) {
      return {
        success: false,
        message: `Cannot delete: ${activeCount} active booking(s) exist. Cancel them first or set oven to maintenance.`,
      };
    }

    // Delete all related bookings first (completed/cancelled), then the oven
    await prisma.$transaction(async (tx) => {
      await tx.booking.deleteMany({ where: { ovenId } });
      await tx.oven.delete({ where: { id: ovenId } });
    });

    revalidatePath("/admin/ovens");
    revalidatePath("/book");
    revalidatePath("/");
    return { success: true, message: "Oven deleted successfully" };
  } catch {
    return { success: false, message: "Failed to delete oven" };
  }
}
