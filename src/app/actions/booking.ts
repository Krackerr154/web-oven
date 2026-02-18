"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { differenceInDays } from "date-fns";
import { parseWibDateTimeLocal } from "@/lib/utils";
import { revalidatePath } from "next/cache";

const bookingSchema = z.object({
  ovenId: z.number().int().positive(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Start date must use valid WIB date-time format"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "End date must use valid WIB date-time format"),
  purpose: z.string().min(3, "Purpose must be at least 3 characters"),
  usageTemp: z.number().int().min(1, "Usage temperature is required"),
  flap: z.number().int().min(0, "Flap must be 0-100%").max(100, "Flap must be 0-100%"),
});

export type BookingResult = {
  success: boolean;
  message: string;
};

const CANCEL_WINDOW_MINUTES = 15;

async function logBookingEvent(
  tx: {
    bookingEvent: {
      create: (args: {
        data: {
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
          payload?: unknown;
        };
      }) => Promise<unknown>;
    };
  },
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
    payload?: unknown;
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

export async function createBooking(formData: FormData): Promise<BookingResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, message: "You must be logged in" };
    }

    if (session.user.status !== "APPROVED") {
      return { success: false, message: "Your account is not approved" };
    }

    const raw = {
      ovenId: Number(formData.get("ovenId")),
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      purpose: formData.get("purpose") as string,
      usageTemp: Number(formData.get("usageTemp")),
      flap: Number(formData.get("flap")),
    };

    const parsed = bookingSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0].message };
    }

    const { ovenId, purpose, usageTemp, flap } = parsed.data;

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
      // Rule: Max 2 active bookings per user
      const activeCount = await tx.booking.count({
        where: { userId, status: "ACTIVE" },
      });

      if (activeCount >= 2) {
        return { success: false, message: "You already have 2 active bookings (maximum)" };
      }

      // Rule: Oven must be available (not in maintenance)
      const oven = await tx.oven.findUnique({ where: { id: ovenId } });
      if (!oven) {
        return { success: false, message: "Oven not found" };
      }
      if (oven.status === "MAINTENANCE") {
        return { success: false, message: `${oven.name} is currently under maintenance` };
      }

      // Rule: Usage temperature must not exceed oven max
      if (usageTemp > oven.maxTemp) {
        return {
          success: false,
          message: `Usage temperature (${usageTemp}°C) exceeds oven maximum (${oven.maxTemp}°C)`,
        };
      }

      // Rule: No overlapping active bookings on the same oven
      const overlap = await tx.booking.findFirst({
        where: {
          ovenId,
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
          ovenId,
          startDate,
          endDate,
          purpose,
          usageTemp,
          flap,
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
      oven: true,
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
