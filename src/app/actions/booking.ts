"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { differenceInDays } from "date-fns";
import { parseWibDateTimeLocal } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";

const bookingSchema = z.object({
  instrumentId: z.number().int().positive(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Start date must use valid WIB date-time format"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "End date must use valid WIB date-time format"),
  purpose: z.string().min(3, "Purpose must be at least 3 characters"),
  usageTemp: z.number().int().min(1, "Usage temperature is required").optional(),
  flap: z.number().int().min(0).max(100).optional(),
});

export type BookingResult = {
  success: boolean;
  message: string;
};

const CANCEL_WINDOW_MINUTES = 15;

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

export async function autoCompleteBookings() {
  try {
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: "ACTIVE",
        endDate: { lt: new Date() },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (expiredBookings.length === 0) return;

    await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: {
          id: { in: expiredBookings.map((b) => b.id) },
        },
        data: {
          status: "COMPLETED",
        },
      });

      for (const booking of expiredBookings) {
        await logBookingEvent(tx, {
          bookingId: booking.id,
          actorType: "SYSTEM",
          eventType: "COMPLETED",
          note: "Booking automatically marked as completed by system",
        });
      }
    });
  } catch (error) {
    console.error("Failed to auto-complete bookings:", error);
  }
}

export async function createBooking(data: {
  instrumentId: number;
  startDate: string;
  endDate: string;
  purpose: string;
  usageTemp?: number;
  flap?: number;
}): Promise<BookingResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "You must be logged in" };
    }

    if (session.user.status !== "APPROVED") {
      return { success: false, message: "Your account is not approved" };
    }

    const parsed = bookingSchema.safeParse({
      instrumentId: data.instrumentId,
      startDate: data.startDate,
      endDate: data.endDate,
      purpose: data.purpose,
      usageTemp: data.usageTemp,
      flap: data.flap,
    });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0].message };
    }

    const { instrumentId, purpose, usageTemp, flap } = parsed.data;

    const startDate = parseWibDateTimeLocal(parsed.data.startDate);
    const endDate = parseWibDateTimeLocal(parsed.data.endDate);

    if (!startDate || !endDate) {
      return { success: false, message: "Invalid booking date format (expected WIB local date-time)" };
    }

    const userId = session.user.id;

    // ── Rule: Max 7 days duration ───────────────────────────────────
    if (differenceInDays(endDate, startDate) > 7) {
      return { success: false, message: "Booking cannot exceed 7 days" };
    }

    if (endDate <= startDate) {
      return { success: false, message: "End date must be after start date" };
    }

    if (startDate < new Date()) {
      return { success: false, message: "Start date cannot be in the past" };
    }

    // ── Atomic transaction for all checks + creation ────────────────
    const result = await prisma.$transaction(async (tx) => {
      // Rule: Max 1 active booking per user
      const activeCount = await tx.booking.count({
        where: { userId, status: "ACTIVE" },
      });

      if (activeCount >= 1) {
        return { success: false, message: "You already have 1 active booking (maximum)" };
      }

      // Rule: Instrument must be available (not in maintenance)
      const instrument = await tx.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) {
        return { success: false, message: "Instrument not found" };
      }
      if (instrument.status === "MAINTENANCE") {
        return { success: false, message: `${instrument.name} is currently under maintenance` };
      }

      // Rule: Usage temperature must not exceed instrument max
      if (usageTemp !== undefined && usageTemp !== null && usageTemp > instrument.maxTemp) {
        return {
          success: false,
          message: `Usage temperature (${usageTemp}°C) exceeds instrument maximum (${instrument.maxTemp}°C)`,
        };
      }

      // Rule: No overlapping active bookings on the same instrument
      const overlap = await tx.booking.findFirst({
        where: {
          instrumentId,
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

      // All checks passed — create booking
      const createdBooking = await tx.booking.create({
        data: {
          userId,
          instrumentId,
          startDate,
          endDate,
          purpose,
          usageTemp: usageTemp ?? undefined,
          flap: flap ?? undefined,
          status: "ACTIVE",
        },
      });

      await logBookingEvent(tx, {
        bookingId: createdBooking.id,
        actorId: userId,
        actorType: session.user.role === "ADMIN" ? "ADMIN" : "USER",
        eventType: "CREATED",
      });

      return { success: true, message: "Booking created successfully!" };
    });

    return result;
  } catch (error) {
    console.error("Booking error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function updateBooking(data: {
  bookingId: string;
  startDate: string;
  endDate: string;
  purpose: string;
  usageTemp: number;
  flap: number;
}): Promise<BookingResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "You must be logged in" };
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: data.bookingId,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        instrument: true,
      },
    });

    if (!booking) {
      return { success: false, message: "Booking not found" };
    }

    if (booking.status !== "ACTIVE") {
      return { success: false, message: "Only active bookings can be edited" };
    }

    // Rule: modifications only allowed within 15 minutes of creation
    const editDeadline = new Date(booking.createdAt.getTime() + CANCEL_WINDOW_MINUTES * 60 * 1000);
    if (new Date() > editDeadline) {
      return {
        success: false,
        message: "Editing window has passed (15 minutes from creation). Please cancel and book again, or contact an admin.",
      };
    }

    const parsed = bookingSchema.safeParse({
      instrumentId: booking.instrumentId, // Re-validate with the existing instrument
      startDate: data.startDate,
      endDate: data.endDate,
      purpose: data.purpose,
      usageTemp: data.usageTemp,
      flap: data.flap,
    });

    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0].message };
    }

    const { purpose, usageTemp, flap } = parsed.data;
    const startDate = parseWibDateTimeLocal(parsed.data.startDate);
    const endDate = parseWibDateTimeLocal(parsed.data.endDate);

    if (!startDate || !endDate) {
      return { success: false, message: "Invalid booking date format" };
    }

    // ── Rule: Max 7 days duration ───────────────────────────────────
    if (differenceInDays(endDate, startDate) > 7) {
      return { success: false, message: "Booking cannot exceed 7 days" };
    }

    if (endDate <= startDate) {
      return { success: false, message: "End date must be after start date" };
    }

    if (startDate < new Date() && booking.startDate.getTime() !== startDate.getTime()) {
      return { success: false, message: "Start date cannot be moved into the past" };
    }

    // ── Atomic transaction for checks + update ────────────────
    const result = await prisma.$transaction(async (tx) => {
      // Rule: Instrument must be available (not in maintenance)
      if (booking.instrument.status === "MAINTENANCE") {
        return { success: false, message: `${booking.instrument.name} is currently under maintenance` };
      }

      // Rule: Usage temperature must not exceed instrument max
      if (usageTemp !== undefined && usageTemp > booking.instrument.maxTemp) {
        return {
          success: false,
          message: `Usage temperature (${usageTemp}°C) exceeds instrument maximum (${booking.instrument.maxTemp}°C)`,
        };
      }

      // Rule: No overlapping active bookings on the same instrument
      const overlap = await tx.booking.findFirst({
        where: {
          id: { not: data.bookingId }, // Exclude self
          instrumentId: booking.instrumentId,
          status: "ACTIVE",
          deletedAt: null,
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
      });

      if (overlap) {
        return {
          success: false,
          message: "This new time slot overlaps with another existing booking",
        };
      }

      // All checks passed — update booking
      await tx.booking.update({
        where: { id: data.bookingId },
        data: {
          startDate,
          endDate,
          purpose,
          usageTemp,
          flap,
        },
      });

      await logBookingEvent(tx, {
        bookingId: data.bookingId,
        actorId: session.user.id,
        actorType: "USER",
        eventType: "EDITED",
        note: "User edited their booking within 15m window",
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
            purpose,
            usageTemp,
            flap,
          }
        }
      });

      return { success: true, message: "Booking updated successfully!" };
    });

    revalidatePath("/my-bookings");
    revalidatePath("/admin/bookings");
    revalidatePath("/");

    return result;
  } catch (error) {
    console.error("Update booking error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function cancelBooking(bookingId: string): Promise<BookingResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "You must be logged in" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, message: "Booking not found" };
    }

    if (booking.deletedAt) {
      return { success: false, message: "This booking has been removed" };
    }

    // Users can only cancel their own bookings; admins can cancel any
    if (booking.userId !== session.user.id && session.user.role !== "ADMIN") {
      return { success: false, message: "You can only cancel your own bookings" };
    }

    if (booking.status !== "ACTIVE") {
      return { success: false, message: "Only active bookings can be cancelled" };
    }

    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin) {
      const cancelDeadline = new Date(booking.createdAt.getTime() + CANCEL_WINDOW_MINUTES * 60 * 1000);
      if (new Date() > cancelDeadline) {
        return {
          success: false,
          message: "Cancellation window has passed (15 minutes). Please contact admin.",
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: session.user.id,
          cancelReason: isAdmin ? "Cancelled by admin" : "Cancelled by user",
        },
      });

      await logBookingEvent(tx, {
        bookingId,
        actorId: session.user.id,
        actorType: isAdmin ? "ADMIN" : "USER",
        eventType: "CANCELLED",
        note: isAdmin ? "Admin override cancellation" : "Cancelled within 15-minute window",
      });
    });

    revalidatePath("/my-bookings");
    revalidatePath("/admin/bookings");
    revalidatePath("/");

    return { success: true, message: "Booking cancelled successfully" };
  } catch (error) {
    console.error("Cancel booking error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function getMyBookingDetail(bookingId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId: session.user.id,
      deletedAt: null,
    },
    include: {
      instrument: true,
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
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

  return booking;
}

export async function getMyActiveBookingsCount() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return 0;

  return await prisma.booking.count({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
      deletedAt: null,
    },
  });
}

// ── Ultrasonic Bath (Sonicator) ─────────────────────────────────────────────

const ultrasonicSchema = z.object({
  instrumentId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid start date format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid end date format"),
  purpose: z.string().min(3, "Purpose must be at least 3 characters"),
  sonicatorModes: z.array(z.enum(["SONIC", "HEAT", "DEGAS"])).min(1, "Select at least one mode"),
  bathTemp: z.number().int().min(1).max(60).optional(), // only relevant when HEAT is selected
});

export async function createUltrasonicBooking(data: {
  instrumentId: number;
  startDate: string;
  endDate: string;
  purpose: string;
  sonicatorModes: ("SONIC" | "HEAT" | "DEGAS")[];
  bathTemp?: number;
}): Promise<BookingResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "You must be logged in" };
    if (session.user.status !== "APPROVED") return { success: false, message: "Your account is not approved" };

    const parsed = ultrasonicSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

    const { instrumentId, purpose, sonicatorModes, bathTemp } = parsed.data;

    const startDate = parseWibDateTimeLocal(parsed.data.startDate);
    const endDate = parseWibDateTimeLocal(parsed.data.endDate);

    if (!startDate || !endDate) return { success: false, message: "Invalid date format" };

    // Ultrasonic bath max = 1 day
    if (differenceInDays(endDate, startDate) > 1) {
      return { success: false, message: "Ultrasonic bath booking cannot exceed 1 day" };
    }

    if (endDate <= startDate) return { success: false, message: "End date must be after start date" };
    if (startDate < new Date()) return { success: false, message: "Start date cannot be in the past" };

    const userId = session.user.id;

    const result = await prisma.$transaction(async (tx) => {
      const activeCount = await tx.booking.count({ where: { userId, status: "ACTIVE" } });
      if (activeCount >= 1) return { success: false, message: "You already have 1 active booking (maximum)" };

      const instrument = await tx.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) return { success: false, message: "Instrument not found" };
      if (instrument.status === "MAINTENANCE") return { success: false, message: `${instrument.name} is currently under maintenance` };

      const overlap = await tx.booking.findFirst({
        where: {
          instrumentId,
          status: "ACTIVE",
          deletedAt: null,
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
      });
      if (overlap) return { success: false, message: "This time slot overlaps with an existing booking" };

      const createdBooking = await tx.booking.create({
        data: {
          userId, instrumentId, startDate, endDate, purpose,
          sonicatorModes,
          usageTemp: bathTemp ?? undefined,
          status: "ACTIVE",
        },
      });

      await logBookingEvent(tx, {
        bookingId: createdBooking.id,
        actorId: userId,
        actorType: session.user.role === "ADMIN" ? "ADMIN" : "USER",
        eventType: "CREATED",
      });

      return { success: true, message: "Ultrasonic bath booking created successfully!" };
    });

    revalidatePath("/my-bookings");
    return result;
  } catch (error) {
    console.error("Ultrasonic booking error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

// ── Glovebox ─────────────────────────────────────────────────────────────────

const gloveboxSchema = z.object({
  instrumentId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid start date format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid end date format"),
  purpose: z.string().min(3, "Deskripsi pekerjaan must be at least 3 characters"),
  equipmentBrought: z.string().min(1, "Please specify equipment brought inside (or write '-')."),
  chemicalsBrought: z.string().min(1, "Please specify chemicals brought inside (or write '-')."),
  n2FlowRate: z.number().min(0).optional(),
  n2Duration: z.number().int().min(0).optional(),
  specialNotes: z.string().optional(),
});

export async function createGloveboxBooking(data: {
  instrumentId: number;
  startDate: string;
  endDate: string;
  purpose: string;
  equipmentBrought: string;
  chemicalsBrought: string;
  n2FlowRate?: number;
  n2Duration?: number;
  specialNotes?: string;
}): Promise<BookingResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "You must be logged in" };
    if (session.user.status !== "APPROVED") return { success: false, message: "Your account is not approved" };

    const parsed = gloveboxSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

    const {
      instrumentId, purpose, equipmentBrought, chemicalsBrought, n2FlowRate, n2Duration, specialNotes
    } = parsed.data;

    const startDate = parseWibDateTimeLocal(data.startDate);
    const endDate = parseWibDateTimeLocal(data.endDate);

    if (!startDate || !endDate) return { success: false, message: "Invalid date format" };

    // Glovebox max duration = 1 day (same as sonicator to prevent hoarding)
    if (differenceInDays(endDate, startDate) > 1) {
      return { success: false, message: "Glovebox booking cannot exceed 1 day" };
    }

    if (endDate <= startDate) return { success: false, message: "End date must be after start date" };
    if (startDate < new Date()) return { success: false, message: "Start date cannot be in the past" };

    const userId = session.user.id;

    const result = await prisma.$transaction(async (tx) => {
      const activeCount = await tx.booking.count({ where: { userId, status: "ACTIVE" } });
      if (activeCount >= 1) return { success: false, message: "You already have 1 active booking (maximum)" };

      const instrument = await tx.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) return { success: false, message: "Instrument not found" };
      if (instrument.status === "MAINTENANCE") return { success: false, message: `${instrument.name} is currently under maintenance` };

      // Validate maxN2FlowRate if the instrument has one configured by admin
      if (instrument.maxN2FlowRate !== null && n2FlowRate !== undefined && n2FlowRate > instrument.maxN2FlowRate) {
        return { success: false, message: `Nitrogen flow rate exceeds the maximum allowed (${instrument.maxN2FlowRate} LPM)` };
      }

      const overlap = await tx.booking.findFirst({
        where: {
          instrumentId,
          status: "ACTIVE",
          deletedAt: null,
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
      });
      if (overlap) return { success: false, message: "This time slot overlaps with an existing booking" };

      const createdBooking = await tx.booking.create({
        data: {
          userId, instrumentId, startDate, endDate, purpose,
          equipmentBrought,
          chemicalsBrought,
          n2FlowRate: n2FlowRate ?? undefined,
          n2Duration: n2Duration ?? undefined,
          specialNotes: specialNotes || undefined, // undefined prevents turning empty string into text
          status: "ACTIVE",
        },
      });

      await logBookingEvent(tx, {
        bookingId: createdBooking.id,
        actorId: userId,
        actorType: session.user.role === "ADMIN" ? "ADMIN" : "USER",
        eventType: "CREATED",
      });

      return { success: true, message: "Glovebox booking created successfully!" };
    });

    revalidatePath("/my-bookings");
    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("Glovebox booking error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}
