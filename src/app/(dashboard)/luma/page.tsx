import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LumaWorkspace } from "@/components/luma-workspace";
import { resolveLumaAccess } from "@/lib/luma-access";
import { getInstrumentStatus } from "@/lib/instrument-status";
import { Bot, Lock, ShieldAlert, Clock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ICONS = {
  "not-approved": Clock,
  "not-granted": Lock,
  suspended: ShieldAlert,
} as const;

/**
 * Read the caller's id straight from the session cookie.
 *
 * getServerSession returns null on this render path even when the middleware
 * accepted the same token, so the JWT is decoded directly. Both cookie names
 * are tried: `__Secure-` over HTTPS, plain over HTTP (localhost).
 */
async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  for (const name of ["__Secure-next-auth.session-token", "next-auth.session-token"]) {
    const raw = jar.get(name)?.value;
    if (!raw) continue;
    try {
      const token = await getToken({
        req: { cookies: { [name]: raw } } as never,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: name,
      });
      const id = (token?.userId as string) ?? (token?.sub as string);
      if (id) return id;
    } catch {
      // fall through to the next cookie name
    }
  }
  return null;
}

export default async function LumaPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const access = await resolveLumaAccess(prisma, userId);

  if (!access.allowed) {
    // Say exactly which condition is unmet. A blank chat box teaches nothing.
    const Icon = ICONS[access.reason as keyof typeof ICONS] ?? Lock;
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-800/40">
          <Icon className="h-6 w-6 text-slate-400" />
        </div>
        <h1 className="flex items-center justify-center gap-2 text-xl font-bold text-white">
          <Bot className="h-5 w-5 text-orange-400" />
          LUMA
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{access.message}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:text-white"
        >
          Back to overview
        </Link>
      </div>
    );
  }

  // The rail reads the same helper the chat tool uses, so the two can never
  // disagree about what is free.
  const [status, upcoming] = await Promise.all([
    getInstrumentStatus(prisma, userId),
    prisma.booking.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
      },
      orderBy: { startDate: "asc" },
      take: 3,
      include: { instrument: { select: { name: true } } },
    }),
  ]);

  return (
    <LumaWorkspace
      userId={userId}
      instruments={status.rows}
      total={status.total}
      freeNow={status.freeNow}
      bookings={upcoming.map((b: any) => ({
        instrument: b.instrument?.name ?? "unknown",
        start: b.startDate ? new Date(b.startDate).toISOString() : "",
        end: b.endDate ? new Date(b.endDate).toISOString() : "",
        status: String(b.status),
      }))}
    />
  );
}
