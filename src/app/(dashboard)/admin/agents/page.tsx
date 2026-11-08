import { prisma } from "@/lib/prisma";
import { planForUser, probeEnvironment } from "@/lib/agents-reconcile";
import { AgentAccessClient } from "./agent-access-client";
import { Bot, AlertTriangle, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  // Only APPROVED users appear here. PENDING and REJECTED are excluded by
  // design — registration alone is never access.
  const users = await prisma.user.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      roles: true,
      agentProfile: {
        select: {
          id: true,
          handle: true,
          status: true,
          grantedAt: true,
          grantedBy: { select: { name: true } },
          revokedAt: true,
          revokedBy: { select: { name: true } },
          revokedReason: true,
          provisionedAt: true,
          lastError: true,
        },
      },
    },
  });

  // Precompute the dry-run plan for every user. The drawer just renders the
  // precomputed result — no async work on the client.
  const plans = await Promise.all(
    users.map(async (u) => {
      const profile = u.agentProfile;
      return planForUser({
        handle: profile?.handle ?? "",
        name: u.name,
        phone: u.phone,
        status: profile?.status ?? "PENDING",
      });
    }),
  );

  const env = await probeEnvironment();

  const stats = {
    granted: users.filter((u) => u.agentProfile?.status === "GRANTED").length,
    notGranted: users.filter((u) => !u.agentProfile || u.agentProfile.status === "PENDING").length,
    suspended: users.filter((u) => u.agentProfile?.status === "SUSPENDED").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bot className="h-6 w-6 text-orange-400" />
          Agent Access
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Who is allowed to talk to their own lab agent. Granting here only records intent —
          nothing reaches WhatsApp until the agent layer is connected.
        </p>
      </div>

      {!env.canWrite && (
        <div className="flex gap-3 items-start rounded-lg border border-blue-500/25 bg-blue-500/5 p-4 text-sm text-blue-200">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <b className="font-semibold">Dry run.</b> This screen shows what{" "}
            <i>would</i> be written when the agent layer is switched on. No files
            are created, no profile exists yet.
          </div>
        </div>
      )}

      {env.profilesDirReadable && env.profileCount > 0 && (
        <div className="flex gap-3 items-start rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <b className="font-semibold">Live environment detected.</b> The reconciler
            found {env.profileCount} profile{env.profileCount === 1 ? "" : "s"} on disk
            and {env.pairingEntryCount} pairing entr{env.pairingEntryCount === 1 ? "y" : "ies"}.
            The plans below are computed against real state.
          </div>
        </div>
      )}

      <AgentAccessClient
        users={users}
        plans={plans}
        stats={stats}
      />
    </div>
  );
}
