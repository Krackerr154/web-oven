import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { autoCompleteBookings } from "@/app/actions/booking";
import { getInstrumentColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await autoCompleteBookings();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const instrumentId = searchParams.get("instrumentId");
  const allStatuses = searchParams.get("allStatuses") === "true";

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (!allStatuses) {
    where.status = "ACTIVE";
  }

  if (instrumentId) {
    where.instrumentId = parseInt(instrumentId, 10);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      user: { select: { name: true, id: true, phone: true, nickname: true } },
      instrument: { select: { name: true, type: true, category: true } },
    },
    orderBy: { startDate: "asc" },
  });

  // Map to FullCalendar event format
  const events = bookings.map((b: any) => ({
    id: b.id,
    instrumentId: b.instrumentId,
    title: `${b.instrument.name} — ${b.userId === session.user.id ? "You" : b.user.name}`,
    start: b.startDate.toISOString(),
    end: b.endDate.toISOString(),
    color: getInstrumentColor(b.instrumentId),
    extendedProps: {
      instrumentName: b.instrument.name,
      instrumentType: b.instrument.type,
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
