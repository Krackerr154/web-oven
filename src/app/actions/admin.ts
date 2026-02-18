"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { differenceInDays } from "date-fns";
import { parseWibDateTimeLocal } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

type ActionResult = {
  success: boolean;
  message: string;
};

const ovenSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["NON_AQUEOUS", "AQUEOUS"]),
  description: z.string().max(500).optional(),
  maxTemp: z.coerce
    .number()
    .int()
    .min(1, "Max temp must be at least 1°C")
    .max(1000, "Max temp cannot exceed 1000°C")
    .default(200),
});

const bookingEditSchema = z.object({
  bookingId: z.string().uuid("Invalid booking id"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Start date must use valid WIB date-time format"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "End date must use valid WIB date-time format"),
  purpose: z.string().min(3, "Purpose must be at least 3 characters"),
  usageTemp: z.coerce.number().int().min(1, "Usage temperature is required"),
  flap: z.coerce.number().int().min(0, "Flap must be 0-100%").max(100, "Flap must be 0-100%"),
});

async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { success: false, message: "Admin access required" };
  }
  return null;
}

async function getAdminId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user.id;
}

async function logBookingEvent(
  tx: Prisma.TransactionClient,
  args: {
    bookingId: string;
    actorId?: string;
    actorType: "USER" | "ADMIN" | "SYSTEM";
    eventType:
      | "CREATED"
      | "EDITED"
      | "CANCELLED"
      | "AUTO_CANCELLED"
      | "COMPLETED"
      | "REMOVED";
    note?: string;
    payload?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }
) {
  await tx.bookingEvent.create({
    data: {
      bookingId: args.bookingId,
      actorId: args.actorId,
      actorType: args.actorType,
      eventType: args.eventType,
      note: args.note,
      payload: args.payload,
    },
  });
}

function revalidateBookingPaths(bookingId?: string) {
  revalidatePath("/");
  revalidatePath("/my-bookings");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/users");
  if (bookingId) {
    revalidatePath(`/my-bookings/${bookingId}`);
    revalidatePath(`/admin/bookings/${bookingId}`);
  }
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

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.oven.update({
        where: { id: ovenId },
        data: { status: "MAINTENANCE" },
      });

      const activeBookings = await tx.booking.findMany({
        where: {
          ovenId,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { id: true },
      });

      await tx.booking.updateMany({
        where: {
          ovenId,
          status: "ACTIVE",
          deletedAt: null,
        },
        data: {
          status: "AUTO_CANCELLED",
          cancelledAt: new Date(),
          cancelledById: adminId,
          cancelReason: "Auto-cancelled due to maintenance",
        },
      });

      if (activeBookings.length > 0) {
        await tx.bookingEvent.createMany({
          data: activeBookings.map((booking) => ({
            bookingId: booking.id,
            actorId: adminId,
            actorType: "ADMIN",
            eventType: "AUTO_CANCELLED",
            note: "Auto-cancelled due to maintenance",
          })),
        });
      }
    });

    revalidatePath("/admin/ovens");
    revalidateBookingPaths();
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
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      oven: { select: { name: true, type: true } },
    },
  });
}

export async function getBookingDetailForAdmin(bookingId: string) {
  const guard = await requireAdmin();
  if (guard) return null;

  return prisma.booking.findFirst({
    where: {
      id: bookingId,
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      oven: true,
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

export async function updateBookingByAdmin(formData: FormData): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  try {
    const parsed = bookingEditSchema.parse({
      bookingId: formData.get("bookingId"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      purpose: formData.get("purpose"),
      usageTemp: formData.get("usageTemp"),
      flap: formData.get("flap"),
    });

    const startDate = parseWibDateTimeLocal(parsed.startDate);
    const endDate = parseWibDateTimeLocal(parsed.endDate);

    if (!startDate || !endDate) {
      return { success: false, message: "Invalid booking date format (expected WIB local date-time)" };
    }

    if (differenceInDays(endDate, startDate) > 7) {
      return { success: false, message: "Booking cannot exceed 7 days" };
    }

    if (endDate <= startDate) {
      return { success: false, message: "End date must be after start date" };
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: parsed.bookingId,
        deletedAt: null,
      },
      include: {
        oven: true,
      },
    });

    if (!booking) {
      return { success: false, message: "Booking not found" };
    }

    if (parsed.usageTemp > booking.oven.maxTemp) {
      return {
        success: false,
        message: `Usage temperature (${parsed.usageTemp}°C) exceeds oven maximum (${booking.oven.maxTemp}°C)`,
      };
    }

    const overlap = await prisma.booking.findFirst({
      where: {
        id: { not: parsed.bookingId },
        ovenId: booking.ovenId,
        status: "ACTIVE",
        deletedAt: null,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
    });

    if (overlap) {
      return {
        success: false,
        message: "This time slot overlaps with an existing booking",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: parsed.bookingId },
        data: {
          startDate,
          endDate,
          purpose: parsed.purpose,
          usageTemp: parsed.usageTemp,
          flap: parsed.flap,
        },
      });

      await logBookingEvent(tx, {
        bookingId: parsed.bookingId,
        actorId: adminId,
        actorType: "ADMIN",
        eventType: "EDITED",
        note: "Booking edited by admin",
        payload: {
          before: {
            startDate: booking.startDate.toISOString(),
            endDate: booking.endDate.toISOString(),
            purpose: booking.purpose,
            usageTemp: booking.usageTemp,
            flap: booking.flap,
          },
          after: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            purpose: parsed.purpose,
            usageTemp: parsed.usageTemp,
            flap: parsed.flap,
          },
        },
      });
    });

    revalidateBookingPaths(parsed.bookingId);
    return { success: true, message: "Booking updated successfully" };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "Failed to update booking" };
  }
}

export async function cancelBookingByAdmin(bookingId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
    });

    if (!booking) return { success: false, message: "Booking not found" };

    if (booking.status !== "ACTIVE") {
      return { success: false, message: "Only active bookings can be cancelled" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: adminId,
          cancelReason: "Cancelled by admin",
        },
      });

      await logBookingEvent(tx, {
        bookingId,
        actorId: adminId,
        actorType: "ADMIN",
        eventType: "CANCELLED",
        note: "Admin override cancellation",
      });
    });

    revalidateBookingPaths(bookingId);
    return { success: true, message: "Booking cancelled successfully" };
  } catch {
    return { success: false, message: "Failed to cancel booking" };
  }
}

export async function completeBookingByAdmin(bookingId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
    });

    if (!booking) return { success: false, message: "Booking not found" };
    if (booking.status === "COMPLETED") {
      return { success: false, message: "Booking is already completed" };
    }
    if (booking.status === "CANCELLED" || booking.status === "AUTO_CANCELLED") {
      return { success: false, message: "Cancelled booking cannot be marked as completed" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
        },
      });

      await logBookingEvent(tx, {
        bookingId,
        actorId: adminId,
        actorType: "ADMIN",
        eventType: "COMPLETED",
        note: "Marked completed by admin",
      });
    });

    revalidateBookingPaths(bookingId);
    return { success: true, message: "Booking marked as completed" };
  } catch {
    return { success: false, message: "Failed to complete booking" };
  }
}

export async function removeBookingByAdmin(bookingId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) return { success: false, message: "Booking not found" };
    if (booking.deletedAt) {
      return { success: false, message: "Booking already removed" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          deletedAt: new Date(),
          deletedById: adminId,
          status: booking.status === "ACTIVE" ? "CANCELLED" : booking.status,
          cancelledAt: booking.status === "ACTIVE" ? new Date() : booking.cancelledAt,
          cancelledById: booking.status === "ACTIVE" ? adminId : booking.cancelledById,
          cancelReason:
            booking.status === "ACTIVE"
              ? "Cancelled as part of removal by admin"
              : booking.cancelReason,
        },
      });

      await logBookingEvent(tx, {
        bookingId,
        actorId: adminId,
        actorType: "ADMIN",
        eventType: "REMOVED",
        note: "Soft removed by admin",
      });
    });

    revalidateBookingPaths(bookingId);
    return { success: true, message: "Booking removed from active views" };
  } catch {
    return { success: false, message: "Failed to remove booking" };
  }
}

export async function getUserBookingStats(userId: string) {
  const guard = await requireAdmin();
  if (guard) return null;

  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [user, bookings, events] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        userId,
        deletedAt: null,
        createdAt: { gte: sixMonthsAgo },
      },
      include: {
        oven: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bookingEvent.findMany({
      where: {
        booking: {
          userId,
          deletedAt: null,
        },
        createdAt: { gte: sixMonthsAgo },
      },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  if (!user) return null;

  const lifecycleCounts = {
    CREATED: 0,
    EDITED: 0,
    CANCELLED: 0,
    AUTO_CANCELLED: 0,
    COMPLETED: 0,
    REMOVED: 0,
  };

  for (const event of events) {
    lifecycleCounts[event.eventType] += 1;
  }

  const statusCounts = {
    ACTIVE: bookings.filter((b) => b.status === "ACTIVE").length,
    COMPLETED: bookings.filter((b) => b.status === "COMPLETED").length,
    CANCELLED: bookings.filter((b) => b.status === "CANCELLED").length,
    AUTO_CANCELLED: bookings.filter((b) => b.status === "AUTO_CANCELLED").length,
  };

  const ovenUsageMap = new Map<
    number,
    { ovenName: string; ovenType: string; bookings: number; totalHours: number }
  >();

  for (const booking of bookings) {
    const durationHours = Math.max(
      0,
      (booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60)
    );

    const current = ovenUsageMap.get(booking.ovenId) ?? {
      ovenName: booking.oven.name,
      ovenType: booking.oven.type,
      bookings: 0,
      totalHours: 0,
    };

    current.bookings += 1;
    if (booking.status !== "CANCELLED" && booking.status !== "AUTO_CANCELLED") {
      current.totalHours += durationHours;
    }

    ovenUsageMap.set(booking.ovenId, current);
  }

  const usedDerivedCount = bookings.filter(
    (booking) =>
      booking.endDate <= now &&
      booking.status !== "CANCELLED" &&
      booking.status !== "AUTO_CANCELLED"
  ).length;

  const ovenUsage = Array.from(ovenUsageMap.values()).sort(
    (a, b) => b.totalHours - a.totalHours
  );

  return {
    user,
    window: {
      from: sixMonthsAgo,
      to: now,
    },
    totals: {
      bookings: bookings.length,
      usedDerivedCount,
    },
    statusCounts,
    lifecycleCounts,
    ovenUsage,
    bookings,
    events,
  };
}

// ─── Oven CRUD ───────────────────────────────────────────────────────

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

export async function updateOven(ovenId: number, formData: FormData): Promise<ActionResult> {
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
    const relatedBookingCount = await prisma.booking.count({
      where: { ovenId },
    });

    if (relatedBookingCount > 0) {
      return {
        success: false,
        message: `Cannot delete oven with booking history (${relatedBookingCount} booking(s)). Keep it for audit/history integrity.`,
      };
    }

    await prisma.oven.delete({ where: { id: ovenId } });

    revalidatePath("/admin/ovens");
    revalidatePath("/book");
    revalidatePath("/");
    return { success: true, message: "Oven deleted successfully" };
  } catch {
    return { success: false, message: "Failed to delete oven" };
  }
}
