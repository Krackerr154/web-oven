/**
 * One owner for instrument availability.
 *
 * The LUMA tool and the dashboard rail both read availability, and a rail that
 * disagrees with the chat is worse than no rail. Both call this.
 */

export type InstrumentStatusRow = {
  id: number;
  name: string;
  type: string;
  category: string | null;
  status: string;
  maxTemp: number;
  maxN2FlowRate: number | null;
  bookedNow: boolean;
  bookedByYou: boolean;
};

export type InstrumentStatus = {
  total: number;
  freeNow: number;
  rows: InstrumentStatusRow[];
};

export async function getInstrumentStatus(
  prisma: any,
  userId: string,
): Promise<InstrumentStatus> {
  const instruments = await prisma.instrument.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      category: true,
      status: true,
      maxTemp: true,
      maxN2FlowRate: true,
    },
  });

  const now = new Date();
  const active = await prisma.booking.findMany({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
      deletedAt: null,
      status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
    },
    select: { instrumentId: true, userId: true },
  });

  const busy = new Map<number, string>();
  for (const b of active) busy.set(b.instrumentId, b.userId);

  const rows: InstrumentStatusRow[] = instruments.map((i: any) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    category: i.category ?? null,
    status: i.status,
    maxTemp: i.maxTemp,
    maxN2FlowRate: i.maxN2FlowRate ?? null,
    bookedNow: busy.has(i.id),
    bookedByYou: busy.get(i.id) === userId,
  }));

  return {
    total: rows.length,
    freeNow: rows.filter((r) => !r.bookedNow).length,
    rows,
  };
}
