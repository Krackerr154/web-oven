import { z } from "zod";

/**
 * Built-in LUMA read tools, bound to a single AP-Lab user.
 *
 * Phase 1: read-only. Every tool receives `userId` server-side and ignores
 * anything the model might try to pass, so the model cannot widen its own
 * scope. Field names below come from prisma/schema.prisma — not guessed.
 */

export const ToolSpecs = {
  getMyBookings: {
    name: "get_my_bookings",
    description:
      "List the caller's own instrument bookings with instrument name, dates, purpose and status. Use when the user asks about their schedule or reservations.",
    schema: z.object({
      status: z.enum(["ALL", "ACTIVE", "PENDING_APPROVAL", "COMPLETED", "CANCELLED"]).optional().default("ALL"),
      limit: z.number().int().min(1).max(50).optional().default(10),
    }),
  },
  getInstrumentAvailability: {
    name: "get_instrument_availability",
    description:
      "List every instrument in the lab, its category, and whether it is booked right now. Use for 'what is free', 'is the oven in use', availability questions.",
    schema: z.object({}),
  },
  getMyGlasswareLoans: {
    name: "get_my_glassware_loans",
    description:
      "List glassware the caller has borrowed and not yet returned. Use when the user asks what they still have out.",
    schema: z.object({}),
  },
  searchReagents: {
    name: "search_reagents",
    description:
      "Search the chemical inventory by name. Returns size, unit, location and availability. Use only when the user names a chemical or asks what is in stock.",
    schema: z.object({
      query: z.string().min(2),
      limit: z.number().int().min(1).max(25).optional().default(10),
    }),
  },
  listSupervisors: {
    name: "list_supervisors",
    description:
      "List department supervisors with their NIP and research area. Use for supervisor or NIP questions.",
    schema: z.object({
      onlySigners: z.boolean().optional().default(false),
    }),
  },
} as const;

type Ctx = { userId: string; prisma: any };

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

export async function executeTool(name: string, args: any, ctx: Ctx): Promise<string> {
  const { prisma } = ctx;
  try {
    switch (name) {
      case "get_my_bookings": {
        const status = String(args?.status ?? "ALL");
        const limit = Math.min(50, Math.max(1, Number(args?.limit ?? 10)));
        const where: any = { userId: ctx.userId, deletedAt: null };
        if (status !== "ALL") where.status = status;
        const rows = await prisma.booking.findMany({
          where,
          orderBy: { startDate: "desc" },
          take: limit,
          include: { instrument: { select: { name: true, category: true } } },
        });
        return JSON.stringify({
          count: rows.length,
          bookings: rows.map((r: any) => ({
            instrument: r.instrument?.name ?? "unknown",
            category: r.instrument?.category ?? null,
            start: iso(r.startDate),
            end: iso(r.endDate),
            status: r.status,
            purpose: r.purpose,
          })),
        });
      }

      case "get_instrument_availability": {
        const instruments = await prisma.instrument.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, category: true, status: true },
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

        return JSON.stringify({
          total: instruments.length,
          freeNow: instruments.filter((i: any) => !busy.has(i.id)).length,
          instruments: instruments.map((i: any) => ({
            name: i.name,
            category: i.category,
            status: i.status,
            booked_now: busy.has(i.id),
            booked_by_you: busy.get(i.id) === ctx.userId,
          })),
        });
      }

      case "get_my_glassware_loans": {
        const loans = await prisma.glasswareLoan.findMany({
          where: { userId: ctx.userId, returnedAt: null },
          orderBy: { borrowedAt: "desc" },
          take: 25,
          include: { glassware: { select: { name: true, customId: true } } },
        });
        return JSON.stringify({
          count: loans.length,
          loans: loans.map((l: any) => ({
            name: l.glassware?.name ?? "unknown",
            code: l.glassware?.customId ?? null,
            quantity: l.quantity,
            borrowed: iso(l.borrowedAt),
            status: l.status,
            purpose: l.purpose,
          })),
        });
      }

      case "search_reagents": {
        const query = String(args?.query ?? "").trim();
        const limit = Math.min(25, Math.max(1, Number(args?.limit ?? 10)));
        if (query.length < 2) return JSON.stringify({ count: 0, matches: [] });
        const found = await prisma.reagent.findMany({
          where: { name: { contains: query, mode: "insensitive" } },
          take: limit,
          select: {
            name: true,
            brand: true,
            size: true,
            unit: true,
            location: true,
            status: true,
          },
        });
        return JSON.stringify({ count: found.length, matches: found });
      }

      case "list_supervisors": {
        const onlySigners = Boolean(args?.onlySigners ?? false);
        const rows = await prisma.supervisor.findMany({
          orderBy: { name: "asc" },
          where: onlySigners ? { nip: { not: null } } : undefined,
          select: { name: true, nip: true, researchGroup: true },
        });
        return JSON.stringify({ count: rows.length, supervisors: rows });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({
      error: "Tool failed",
      detail: e instanceof Error ? e.message.slice(0, 300) : String(e),
    });
  }
}

function zodType(v: any): Record<string, unknown> {
  const t = v?._def?.typeName;
  if (t === "ZodEnum") return { type: "string", enum: v.options };
  if (t === "ZodNumber") return { type: "integer" };
  if (t === "ZodBoolean") return { type: "boolean" };
  return { type: "string" };
}

export function toolList() {
  return Object.values(ToolSpecs).map((s) => {
    const shape = (s.schema as z.ZodObject<any>).shape;
    return {
      type: "function",
      function: {
        name: s.name,
        description: s.description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(shape).map(([k, v]: [string, any]) => [
              k,
              { ...zodType(v), description: v?._def?.description ?? "" },
            ]),
          ),
          required: Object.keys(shape).filter((k) => !shape[k].isOptional()),
        },
      },
    };
  });
}

export function validateToolArgs(
  name: string,
  raw: any,
): { ok: true; value: any } | { ok: false; error: string } {
  const spec = Object.values(ToolSpecs).find((s) => s.name === name);
  if (!spec) return { ok: false, error: "Unknown tool" };
  const parsed = spec.schema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: true, value: parsed.data };
}
