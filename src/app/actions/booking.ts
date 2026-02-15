"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { differenceInDays } from "date-fns";

const bookingSchema = z.object({
  ovenId: z.number().int().positive(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  purpose: z.string().min(3, "Purpose must be at least 3 characters"),
});

export type BookingResult = {
  success: boolean;
  message: string;
};

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
    };

    const parsed = bookingSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0].message };
    }

    const { ovenId, startDate, endDate, purpose } = parsed.data;
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

      // Rule: No overlapping active bookings on the same oven
      const overlap = await tx.booking.findFirst({
        where: {
          ovenId,
          status: "ACTIVE",
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
      await tx.booking.create({
        data: {
          userId,
          ovenId,
          startDate,
          endDate,
          purpose,
          status: "ACTIVE",
        },
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

    // Users can only cancel their own bookings; admins can cancel any
    if (booking.userId !== session.user.id && session.user.role !== "ADMIN") {
      return { success: false, message: "You can only cancel your own bookings" };
    }

    if (booking.status !== "ACTIVE") {
      return { success: false, message: "Only active bookings can be cancelled" };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    });

    return { success: true, message: "Booking cancelled successfully" };
  } catch (error) {
    console.error("Cancel booking error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}
