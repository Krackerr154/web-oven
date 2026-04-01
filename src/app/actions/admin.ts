"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { differenceInDays } from "date-fns";
import { parseWibDateTimeLocal } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import { hash } from "bcryptjs";
import { sendCPDBookingDecisionEmail } from "@/lib/email";

type ActionResult = {
  success: boolean;
  message: string;
};

const instrumentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["OVEN", "ULTRASONIC_BATH", "GLOVEBOX"]),
  category: z.enum(["NON_AQUEOUS", "AQUEOUS"]).optional().nullable(),
  description: z.string().max(500).optional(),
  maxTemp: z.coerce
    .number()
    .int()
    .min(1, "Max temp must be at least 1°C")
    .max(1000, "Max temp cannot exceed 1000°C")
    .default(200),
  maxN2FlowRate: z.number().min(0).optional().nullable(),
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
  // Oven fields
  usageTemp: z.coerce.number().int().min(1, "Usage temperature is required").optional().nullable(),
  flap: z.coerce.number().int().min(0, "Flap must be 0-100%").max(100, "Flap must be 0-100%").optional().nullable(),
  // Ultrasonic Bath fields
  sonicatorModes: z.array(z.enum(["SONIC", "HEAT", "DEGAS"])).optional(),
  bathTemp: z.coerce.number().int().min(1).max(60).optional().nullable(),
  // Glovebox fields
  equipmentBrought: z.string().optional().nullable(),
  chemicalsBrought: z.string().optional().nullable(),
  n2FlowRate: z.coerce.number().min(0).optional().nullable(),
  n2Duration: z.coerce.number().int().min(0).optional().nullable(),
  specialNotes: z.string().optional().nullable(),
  // CPD fields
  sample: z.string().optional().nullable(),
  cpdMode: z.enum(["AUTO", "MANUAL"]).optional().nullable(),
  cpdModeDetails: z.string().optional().nullable(),
});

async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) {
    return { success: false, message: "Admin access required" };
  }
  return null;
}

async function getAdminId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) return null;
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
    | "REMOVED"
    | "COMMENTED";
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

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(8, "Phone must be at least 8 characters"),
  nim: z.string().min(3, "NIM or Student ID is required"),
  supervisors: z.array(z.string().min(2, "Supervisor name must be at least 2 characters")).min(1, "At least one supervisor is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roles: z.array(z.enum(["USER", "ADMIN", "CPD_ADMIN"])).default(["USER"]),
});

const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(8, "Phone must be at least 8 characters"),
  nickname: z.string().max(50).optional().nullable(),
  nim: z.string().min(3, "NIM or Student ID is required"),
  supervisors: z.array(z.string().min(2, "Supervisor name must be at least 2 characters")).min(1, "At least one supervisor is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

export async function createUser(data: Record<string, any>): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const raw = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      nim: data.nim,
      supervisors: data.supervisors,
      password: data.password,
      roles: data.roles || ["USER"],
    };

    const parsed = createUserSchema.parse(raw);

    // Check uniqueness
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: parsed.email }, { phone: parsed.phone }],
      },
    });

    if (existingUser) {
      return {
        success: false,
        message:
          existingUser.email === parsed.email
            ? "Email already registered"
            : "Phone number already registered",
      };
    }

    const passwordHash = await hash(parsed.password, 12);

    await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        nim: parsed.nim,
        supervisors: parsed.supervisors,
        passwordHash,
        roles: parsed.roles,
        status: "APPROVED", // Auto-approve admin created users
      },
    });

    revalidatePath("/admin/users");
    return { success: true, message: "User created successfully" };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "Failed to create user" };
  }
}

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

export async function setUserRoles(userId: string, roles: ("ADMIN" | "CPD_ADMIN" | "USER")[]): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id === userId) {
      return { success: false, message: "You cannot change your own roles" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { roles, isContactPerson: roles.includes("USER") && roles.length === 1 ? false : undefined },
    });

    revalidatePath("/admin/users");
    return { success: true, message: `User roles updated` };
  } catch (error) {
    console.error("Set role err:", error);
    return { success: false, message: "Failed to change user roles" };
  }
}

export async function setContactPerson(userId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || !target.roles.includes("ADMIN")) {
      return { success: false, message: "Only Admins can be the Contact Person" };
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { isContactPerson: true },
        data: { isContactPerson: false },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { isContactPerson: true },
      }),
    ]);

    revalidatePath("/admin/users");
    return { success: true, message: "Contact Person updated successfully" };
  } catch (error) {
    console.error("Set contact err:", error);
    return { success: false, message: "Failed to update contact person" };
  }
}

export async function updateUserDetails(userId: string, data: {
  name: string;
  email: string;
  phone: string;
  nickname?: string | null;
  nim: string;
  supervisors: string[];
  newPassword?: string;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const parsed = updateUserSchema.parse(data);

    // Check email uniqueness (excluding this user)
    const existingEmail = await prisma.user.findFirst({
      where: { email: parsed.email, id: { not: userId } },
    });
    if (existingEmail) {
      return { success: false, message: "Email is already in use by another user" };
    }

    // Check phone uniqueness (excluding this user)
    const existingPhone = await prisma.user.findFirst({
      where: { phone: parsed.phone, id: { not: userId } },
    });
    if (existingPhone) {
      return { success: false, message: "Phone number is already in use by another user" };
    }

    // Check NIM uniqueness (excluding this user)
    const existingNim = await prisma.user.findFirst({
      where: { nim: parsed.nim, id: { not: userId } },
    });
    if (existingNim) {
      return { success: false, message: "NIM is already in use by another user" };
    }

    // Build update payload
    const updateData: any = {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      nickname: parsed.nickname || null,
      nim: parsed.nim,
      supervisors: parsed.supervisors,
    };

    // Hash new password if provided
    if (parsed.newPassword && parsed.newPassword.length >= 8) {
      updateData.passwordHash = await hash(parsed.newPassword, 12);
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    revalidatePath("/admin/users");
    return { success: true, message: "User details updated successfully" };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message || "Validation failed" };
    }
    console.error("Update user error:", err);
    return { success: false, message: "Failed to update user details" };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (adminId === userId) {
    return { success: false, message: "You cannot delete your own admin account" };
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return { success: false, message: "User not found" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Remove references where they acted upon events (actorId)
      await tx.bookingEvent.updateMany({
        where: { actorId: userId },
        data: { actorId: null },
      });

      // 2. Remove references where they cancelled or deleted bookings for others
      await tx.booking.updateMany({
        where: { cancelledById: userId },
        data: { cancelledById: null },
      });
      await tx.booking.updateMany({
        where: { deletedById: userId },
        data: { deletedById: null },
      });

      // 3. Delete their own bookings (Cascades to their BookingEvents)
      await tx.booking.deleteMany({
        where: { userId: userId },
      });

      // 4. Finally, delete the user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/bookings"); // Might affect booking listings
    revalidatePath("/");

    return { success: true, message: "User deleted successfully" };
  } catch (err) {
    console.error("Delete user err:", err);
    return { success: false, message: "Failed to delete user. Make sure all relations are cleared." };
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
      nickname: true,
      email: true,
      phone: true,
      nim: true,
      supervisors: true,
      roles: true,
      status: true,
      isContactPerson: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
  });
}

// ─── Instrument Management ─────────────────────────────────────────────────

export async function setInstrumentMaintenance(instrumentId: number): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.instrument.update({
        where: { id: instrumentId },
        data: { status: "MAINTENANCE" },
      });

      const activeBookings = await tx.booking.findMany({
        where: {
          instrumentId,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { id: true },
      });

      await tx.booking.updateMany({
        where: {
          instrumentId,
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

    revalidatePath("/admin/instruments");
    revalidateBookingPaths();
    return {
      success: true,
      message: "Instrument set to maintenance. All active bookings have been auto-cancelled.",
    };
  } catch {
    return { success: false, message: "Failed to set maintenance mode" };
  }
}

export async function clearInstrumentMaintenance(instrumentId: number): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    await prisma.instrument.update({
      where: { id: instrumentId },
      data: { status: "AVAILABLE" },
    });

    revalidatePath("/admin/instruments");
    revalidatePath("/");
    return { success: true, message: "Instrument is now available for bookings" };
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
      instrument: { select: { name: true, type: true } },
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
      instrument: true,
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

export async function updateBookingByAdmin(data: {
  bookingId: string;
  startDate: string;
  endDate: string;
  purpose: string;
  usageTemp?: number | null;
  flap?: number | null;
  sonicatorModes?: ("SONIC" | "HEAT" | "DEGAS")[];
  bathTemp?: number | null;
  equipmentBrought?: string | null;
  chemicalsBrought?: string | null;
  n2FlowRate?: number | null;
  n2Duration?: number | null;
  specialNotes?: string | null;
  sample?: string | null;
  cpdMode?: "AUTO" | "MANUAL" | null;
  cpdModeDetails?: string | null;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  try {
    const parsed = bookingEditSchema.parse({
      bookingId: data.bookingId,
      startDate: data.startDate,
      endDate: data.endDate,
      purpose: data.purpose,
      usageTemp: data.usageTemp,
      flap: data.flap,
      sonicatorModes: data.sonicatorModes,
      bathTemp: data.bathTemp,
      equipmentBrought: data.equipmentBrought,
      chemicalsBrought: data.chemicalsBrought,
      n2FlowRate: data.n2FlowRate,
      n2Duration: data.n2Duration,
      specialNotes: data.specialNotes,
      sample: data.sample,
      cpdMode: data.cpdMode,
      cpdModeDetails: data.cpdModeDetails,
    });

    const startDate = parseWibDateTimeLocal(parsed.startDate);
    const endDate = parseWibDateTimeLocal(parsed.endDate);

    if (!startDate || !endDate) {
      return { success: false, message: "Invalid booking date format (expected WIB local date-time)" };
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
        instrument: true,
      },
    });

    if (!booking) {
      return { success: false, message: "Booking not found" };
    }

    const instrumentType = booking.instrument.type;
    const maxDays = instrumentType === "OVEN" ? 7 : 1;

    if (differenceInDays(endDate, startDate) > maxDays) {
      return { success: false, message: `Booking cannot exceed ${maxDays} day(s)` };
    }

    // ── Instrument-specific validation & field preparation ──────────
    let instrumentFields: Record<string, any> = {};
    let beforeSnapshot: Record<string, any> = {};
    let afterSnapshot: Record<string, any> = {};

    if (instrumentType === "OVEN") {
      if (parsed.usageTemp != null && parsed.usageTemp > booking.instrument.maxTemp) {
        return { success: false, message: `Usage temperature (${parsed.usageTemp}°C) exceeds instrument maximum (${booking.instrument.maxTemp}°C)` };
      }
      instrumentFields = { usageTemp: parsed.usageTemp, flap: parsed.flap };
      beforeSnapshot = { usageTemp: booking.usageTemp, flap: booking.flap };
      afterSnapshot = { ...instrumentFields };

    } else if (instrumentType === "ULTRASONIC_BATH") {
      instrumentFields = {
        sonicatorModes: parsed.sonicatorModes ?? booking.sonicatorModes,
        usageTemp: parsed.bathTemp ?? booking.usageTemp,
      };
      beforeSnapshot = { sonicatorModes: booking.sonicatorModes, usageTemp: booking.usageTemp };
      afterSnapshot = { ...instrumentFields };

    } else if (instrumentType === "GLOVEBOX") {
      if (booking.instrument.maxN2FlowRate !== null && parsed.n2FlowRate != null && parsed.n2FlowRate > booking.instrument.maxN2FlowRate) {
        return { success: false, message: `Nitrogen flow rate exceeds the maximum allowed (${booking.instrument.maxN2FlowRate} LPM)` };
      }
      instrumentFields = {
        equipmentBrought: parsed.equipmentBrought ?? booking.equipmentBrought,
        chemicalsBrought: parsed.chemicalsBrought ?? booking.chemicalsBrought,
        n2FlowRate: parsed.n2FlowRate ?? booking.n2FlowRate,
        n2Duration: parsed.n2Duration ?? booking.n2Duration,
        specialNotes: parsed.specialNotes ?? booking.specialNotes,
      };
      beforeSnapshot = {
        equipmentBrought: booking.equipmentBrought,
        chemicalsBrought: booking.chemicalsBrought,
        n2FlowRate: booking.n2FlowRate,
        n2Duration: booking.n2Duration,
        specialNotes: booking.specialNotes,
      };
      afterSnapshot = { ...instrumentFields };

    } else if (instrumentType === "CPD") {
      instrumentFields = {
        sample: parsed.sample ?? booking.sample,
        cpdMode: parsed.cpdMode ?? booking.cpdMode,
        cpdModeDetails: parsed.cpdModeDetails ?? booking.cpdModeDetails,
      };
      beforeSnapshot = { sample: booking.sample, cpdMode: booking.cpdMode, cpdModeDetails: booking.cpdModeDetails };
      afterSnapshot = { ...instrumentFields };
    }

    const overlapStatuses = instrumentType === "CPD" ? ["ACTIVE", "PENDING_APPROVAL"] : ["ACTIVE"];
    const overlap = await prisma.booking.findFirst({
      where: {
        id: { not: parsed.bookingId },
        instrumentId: booking.instrumentId,
        status: { in: overlapStatuses as any },
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
          ...instrumentFields,
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
            ...beforeSnapshot,
          },
          after: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            purpose: parsed.purpose,
            ...afterSnapshot,
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
        roles: true,
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
        instrument: {
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
    COMMENTED: 0,
    APPROVED: 0,
    REJECTED: 0,
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

  const instrumentUsageMap = new Map<
    number,
    { instrumentName: string; instrumentType: string; bookings: number; totalHours: number }
  >();

  for (const booking of bookings) {
    const durationHours = Math.max(
      0,
      (booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60)
    );

    const current = instrumentUsageMap.get(booking.instrumentId) ?? {
      instrumentName: booking.instrument.name,
      instrumentType: booking.instrument.type,
      bookings: 0,
      totalHours: 0,
    };

    current.bookings += 1;
    if (booking.status !== "CANCELLED" && booking.status !== "AUTO_CANCELLED") {
      current.totalHours += durationHours;
    }

    instrumentUsageMap.set(booking.instrumentId, current);
  }

  const usedDerivedCount = bookings.filter(
    (booking) =>
      booking.endDate <= now &&
      booking.status !== "CANCELLED" &&
      booking.status !== "AUTO_CANCELLED"
  ).length;

  const instrumentUsage = Array.from(instrumentUsageMap.values()).sort(
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
    instrumentUsage,
    bookings,
    events,
  };
}

// ─── Instrument CRUD ───────────────────────────────────────────────────────

export async function createInstrument(data: Record<string, any>): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const parsed = instrumentSchema.parse({
      name: data.name,
      type: data.type,
      category: data.category || null,
      description: data.description || undefined,
      maxTemp: data.maxTemp || 200,
      maxN2FlowRate: data.maxN2FlowRate || null,
    });

    await prisma.instrument.create({
      data: {
        name: parsed.name,
        type: parsed.type,
        description: parsed.description || null,
        maxTemp: parsed.maxTemp,
        maxN2FlowRate: parsed.maxN2FlowRate,
      },
    });

    revalidatePath("/admin/instruments");
    revalidatePath("/book");
    revalidatePath("/");
    return { success: true, message: "Instrument created successfully" };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "Failed to create instrument" };
  }
}

export async function updateInstrument(instrumentId: number, data: {
  name: string;
  type: string;
  category?: string;
  description?: string;
  maxTemp: number;
  maxN2FlowRate?: number;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const parsed = instrumentSchema.parse({
      name: data.name,
      type: data.type,
      category: data.category || null,
      description: data.description || undefined,
      maxTemp: data.maxTemp || 200,
      maxN2FlowRate: data.maxN2FlowRate || null,
    });

    await prisma.instrument.update({
      where: { id: instrumentId },
      data: {
        name: parsed.name,
        type: parsed.type,
        description: parsed.description || null,
        maxTemp: parsed.maxTemp,
        maxN2FlowRate: parsed.maxN2FlowRate,
      },
    });

    revalidatePath("/admin/instruments");
    revalidatePath("/book");
    revalidatePath("/");
    return { success: true, message: "Instrument updated successfully" };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message || "Validation failed" };
    }
    return { success: false, message: "Failed to update instrument" };
  }
}

export async function deleteInstrument(instrumentId: number): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const relatedBookingCount = await prisma.booking.count({
      where: { instrumentId },
    });

    if (relatedBookingCount > 0) {
      return {
        success: false,
        message: `Cannot delete instrument with booking history (${relatedBookingCount} booking(s)). Keep it for audit/history integrity.`,
      };
    }

    await prisma.instrument.delete({ where: { id: instrumentId } });

    revalidatePath("/admin/instruments");
    revalidatePath("/book");
    revalidatePath("/");
    return { success: true, message: "Instrument deleted successfully" };
  } catch {
    return { success: false, message: "Failed to delete instrument" };
  }
}

// ─── Booking Comments ──────────────────────────────────────────────────────

export async function addBookingComment(
  bookingId: string,
  comment: string
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  if (!comment || comment.trim().length < 1) {
    return { success: false, message: "Comment cannot be empty" };
  }

  if (comment.trim().length > 500) {
    return { success: false, message: "Comment must be under 500 characters" };
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
    });

    if (!booking) {
      return { success: false, message: "Booking not found" };
    }

    await prisma.bookingEvent.create({
      data: {
        bookingId,
        actorId: adminId,
        actorType: "ADMIN",
        eventType: "COMMENTED",
        note: comment.trim(),
      },
    });

    revalidateBookingPaths(bookingId);
    return { success: true, message: "Comment posted" };
  } catch {
    return { success: false, message: "Failed to post comment" };
  }
}

// ─── Instrument Bans ───────────────────────────────────────────────────────

export async function banUserFromInstrumentCategory(
  userId: string,
  instrumentType: "OVEN" | "ULTRASONIC_BATH" | "GLOVEBOX",
  reason?: string
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const adminId = await getAdminId();
  if (!adminId) return { success: false, message: "Admin access required" };

  if (userId === adminId) {
    return { success: false, message: "You cannot ban yourself" };
  }

  try {
    // Check if already banned from this category
    const existing = await prisma.instrumentBan.findFirst({
      where: { userId, instrumentType, isActive: true },
    });

    if (existing) {
      return { success: false, message: `User is already banned from ${instrumentType}` };
    }

    await prisma.$transaction(async (tx) => {
      // Create the category ban
      await tx.instrumentBan.create({
        data: {
          userId,
          instrumentType,
          reason: reason?.trim() || null,
          bannedById: adminId,
        },
      });

      // Auto-cancel all active bookings for ANY instrument of this category by this user
      const activeBookings = await tx.booking.findMany({
        where: {
          userId,
          instrument: { type: instrumentType },
          status: "ACTIVE",
          deletedAt: null,
        },
      });

      for (const booking of activeBookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledById: adminId,
            cancelReason: `Instrument ban: ${reason?.trim() || "No reason provided"}`,
          },
        });

        await logBookingEvent(tx, {
          bookingId: booking.id,
          actorId: adminId,
          actorType: "ADMIN",
          eventType: "CANCELLED",
          note: `Booking auto-cancelled due to instrument ban. Reason: ${reason?.trim() || "No reason provided"}`,
        });
      }
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/bookings");
    revalidatePath("/my-bookings");
    revalidatePath("/");

    return {
      success: true,
      message: `User banned from ${instrumentType}s`,
    };
  } catch {
    return { success: false, message: "Failed to ban user from instrument" };
  }
}

export async function liftInstrumentBan(
  banId: string
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const ban = await prisma.instrumentBan.findUnique({
      where: { id: banId },
    });

    if (!ban) {
      return { success: false, message: "Ban not found" };
    }

    if (!ban.isActive) {
      return { success: false, message: "Ban is already lifted" };
    }

    await prisma.instrumentBan.update({
      where: { id: banId },
      data: { isActive: false, liftedAt: new Date() },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${ban.userId}`);
    return { success: true, message: `Ban lifted for ${ban.instrumentType.replace(/_/g, " ")}` };
  } catch {
    return { success: false, message: "Failed to lift ban" };
  }
}

export async function getUserInstrumentBans(userId: string) {
  const guard = await requireAdmin();
  if (guard) return [];

  return await prisma.instrumentBan.findMany({
    where: { userId, isActive: true },
    include: {
      bannedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── CPD Admin Actions ─────────────────────────────────────────────────────────

async function requireCPDAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };
  if (!session.user.roles.includes("CPD_ADMIN") && !session.user.roles.includes("ADMIN")) {
    return { success: false, message: "CPD Admin access required" };
  }
  return null;
}

async function getCPDAdminId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (!session.user.roles.includes("CPD_ADMIN") && !session.user.roles.includes("ADMIN")) return null;
  return session.user.id;
}

export async function getPendingCPDBookings() {
  const guard = await requireCPDAdmin();
  if (guard) return [];

  return await prisma.booking.findMany({
    where: { status: "PENDING_APPROVAL", deletedAt: null, instrument: { type: "CPD" } },
    include: {
      user: { select: { id: true, name: true, email: true, nim: true } },
      instrument: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function approveCPDBooking(bookingId: string): Promise<ActionResult> {
  const adminId = await getCPDAdminId();
  if (!adminId) return { success: false, message: "CPD Admin access required" };

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { email: true, name: true } },
        instrument: { select: { name: true } },
      },
    });
    if (!booking) return { success: false, message: "Booking not found" };
    if (booking.status !== "PENDING_APPROVAL") {
      return { success: false, message: "Booking is not pending approval" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "ACTIVE" },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId,
          actorId: adminId,
          actorType: "ADMIN",
          eventType: "APPROVED",
        },
      });
    });

    sendCPDBookingDecisionEmail(
      booking.user.email,
      true,
      {
        instrumentName: booking.instrument.name,
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
        purpose: booking.purpose,
      }
    ).catch(console.error);

    revalidatePath("/cpd-admin");
    revalidatePath("/my-bookings");
    return { success: true, message: "CPD booking approved" };
  } catch {
    return { success: false, message: "Failed to approve booking" };
  }
}

export async function rejectCPDBooking(bookingId: string, reason: string): Promise<ActionResult> {
  const adminId = await getCPDAdminId();
  if (!adminId) return { success: false, message: "CPD Admin access required" };

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { email: true, name: true } },
        instrument: { select: { name: true } },
      },
    });
    if (!booking) return { success: false, message: "Booking not found" };
    if (booking.status !== "PENDING_APPROVAL") {
      return { success: false, message: "Booking is not pending approval" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: adminId,
          cancelReason: reason || "Rejected by CPD Admin",
        },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId,
          actorId: adminId,
          actorType: "ADMIN",
          eventType: "REJECTED",
          note: reason || undefined,
        },
      });
    });

    sendCPDBookingDecisionEmail(
      booking.user.email,
      false,
      {
        instrumentName: booking.instrument.name,
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
        purpose: booking.purpose,
      },
      reason
    ).catch(console.error);

    revalidatePath("/cpd-admin");
    revalidatePath("/my-bookings");
    return { success: true, message: "CPD booking rejected" };
  } catch {
    return { success: false, message: "Failed to reject booking" };
  }
}
