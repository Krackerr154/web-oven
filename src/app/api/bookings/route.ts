import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ovenId = searchParams.get("ovenId");

  const where: Record<string, unknown> = {
    status: "ACTIVE",
  };

  if (ovenId) {
    where.ovenId = parseInt(ovenId, 10);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      user: { select: { name: true, id: true } },
      oven: { select: { name: true, type: true } },
    },
    orderBy: { startDate: "asc" },
  });

  // Map to FullCalendar event format
  const events = bookings.map((b) => ({
    id: b.id,
    title: `${b.oven.name} — ${b.userId === session.user.id ? "You" : b.user.name}`,
    start: b.startDate.toISOString(),
    end: b.endDate.toISOString(),
    color: b.oven.type === "NON_AQUEOUS" ? "#ea580c" : "#2563eb",
    extendedProps: {
      ovenName: b.oven.name,
      ovenType: b.oven.type,
      userName: b.user.name,
      purpose: b.purpose,
      isOwn: b.userId === session.user.id,
    },
  }));

  return NextResponse.json(events);
}
