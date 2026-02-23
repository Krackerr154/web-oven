import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { autoCompleteBookings } from "@/app/actions/booking";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await autoCompleteBookings();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ovenId = searchParams.get("ovenId");
  const allStatuses = searchParams.get("allStatuses") === "true";

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (!allStatuses) {
    where.status = "ACTIVE";
  }

  if (ovenId) {
    where.ovenId = parseInt(ovenId, 10);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      user: { select: { name: true, id: true, phone: true, nickname: true } },
      oven: { select: { name: true, type: true } },
    },
    orderBy: { startDate: "asc" },
  });

  // Map to FullCalendar event format
  const events = bookings.map((b: any) => ({
    id: b.id,
    ovenId: b.ovenId,
    title: `${b.oven.name} — ${b.userId === session.user.id ? "You" : b.user.name}`,
    start: b.startDate.toISOString(),
    end: b.endDate.toISOString(),
    color: b.oven.type === "NON_AQUEOUS" ? "#ea580c" : "#3b82f6",
    extendedProps: {
      ovenName: b.oven.name,
      ovenType: b.oven.type,
      userName: b.user.name,
      userNickname: b.user.nickname || null,
      userPhone: b.user.phone,
      purpose: b.purpose,
      usageTemp: b.usageTemp,
      flap: b.flap,
      isOwn: b.userId === session.user.id,
      status: b.status,
    },
  }));

  return NextResponse.json(events);
}
