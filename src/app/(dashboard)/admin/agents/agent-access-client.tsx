"use client";

import { Fragment, useState, useTransition } from "react";
import { grantAgent, revokeAgent, resetAgent } from "@/app/actions/agents";
import type { ReconcilePlan } from "@/lib/agents-reconcile";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: string[];
  agentProfile: {
    id: string;
    handle: string;
    status: "PENDING" | "GRANTED" | "SUSPENDED";
    grantedAt: Date | null;
    grantedBy: { name: string } | null;
    revokedAt: Date | null;
    revokedBy: { name: string } | null;
    revokedReason: string | null;
    provisionedAt: Date | null;
    lastError: string | null;
  } | null;
};

type Props = {
  users: UserRow[];
  plans: ReconcilePlan[];
  stats: { granted: number; notGranted: number; suspended: number };
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const VERB_STYLES: Record<string, string> = {
  create: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  write: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  skip: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  blocked: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const VERB_LABEL: Record<string, string> = {
  create: "create",
  write: "write",
  skip: "skip",
  blocked: "blocked",
};

function StatusPill({ status }: { status: "PENDING" | "GRANTED" | "SUSPENDED" }) {
  if (status === "GRANTED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Granted
      </span>
    );
  }
  if (status === "SUSPENDED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/35 bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Not granted
    </span>
  );
}

function PlanDrawer({ plan, name }: { plan: ReconcilePlan; name: string }) {
  return (
    <tr>
      <td colSpan={5} className="p-0 border-b border-slate-800/60">
        <div className="border-l-2 border-orange-500 bg-slate-950/55 px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-widest text-orange-300">
            <ChevronDown className="h-3 w-3" />
            {plan.inSync ? "Disk already matches intent" : `If you apply “${name}”`}
          </div>

          {plan.blockers.length > 0 && (
            <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {plan.blockers.map((b) => (
                <div key={b} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {plan.actions.map((a, i) => (
              <div key={i}>
                <div className="grid grid-cols-[92px_1fr] items-baseline gap-3">
                  <span
                    className={`justify-self-end rounded border px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider ${VERB_STYLES[a.verb]}`}
                  >
                    {VERB_LABEL[a.verb]}
                  </span>
                  <span className="break-all font-mono text-[12px] text-slate-200">
                    {a.target}
                  </span>
                </div>
                <p className="ml-[104px] mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  {a.reason}
                </p>
                {a.payload && (
                  <pre className="ml-[104px] mt-1.5 overflow-x-auto rounded-md border border-slate-700/55 bg-slate-900/90 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
                    {a.payload}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function AgentAccessClient({ users, plans, stats }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  function act(fn: (fd: FormData) => Promise<{ success: boolean; message: string }>, fd: FormData) {
    start(async () => {
      const res = await fn(fd);
      setToast({ ok: res.success, msg: res.message });
      if (res.success) setOpen(null);
    });
  }

  return (
    <>
      {toast && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            toast.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {toast.ok ? (
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <span className="flex-1">{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            className="text-xs opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-emerald-300">
            Granted
          </div>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-white">{stats.granted}</p>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
            Not granted
          </div>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-white">{stats.notGranted}</p>
        </div>
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-red-300">
            Suspended
          </div>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-red-400">{stats.suspended}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/40">
        <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Lab members</h2>
          <span className="text-[11px] text-slate-400">
            {users.length} approved {users.length === 1 ? "user" : "users"} · handle frozen at grant
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900/35">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Member
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Agent handle
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Agent status
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Granted
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No approved users yet. Approve an account before granting agent access.
                  </td>
                </tr>
              )}

              {users.map((u, i) => {
                const plan = plans[i];
                const profile = u.agentProfile;
                const status = profile?.status ?? "PENDING";
                const isOpen = open === u.id;

                return (
                  <Fragment key={u.id}>
                    <tr
                      className={`border-b border-slate-800/60 last:border-0 transition-colors hover:bg-slate-800/30 ${
                        status === "SUSPENDED" ? "bg-red-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                              status === "SUSPENDED"
                                ? "border-slate-700/60 bg-slate-700/20 text-slate-500"
                                : "border-slate-700/60 bg-orange-500/15 text-orange-300"
                            }`}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`truncate text-[13px] font-medium ${
                                status === "SUSPENDED" ? "text-slate-400" : "text-white"
                              }`}
                            >
                              {u.name}
                            </div>
                            <div className="truncate text-[11px] text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {profile ? (
                          <span className="inline-flex items-center gap-1 rounded border border-slate-700/60 bg-slate-950/60 px-1.5 py-0.5 font-mono text-[12px] text-slate-200">
                            {profile.handle}
                            <Lock className="h-2.5 w-2.5 text-slate-500" />
                          </span>
                        ) : (
                          <span className="inline-block rounded border border-dashed border-slate-700 px-1.5 py-0.5 font-mono text-[12px] text-slate-500">
                            — not issued —
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill status={status} />
                      </td>

                      <td className="px-4 py-3 text-[12px] tabular-nums text-slate-300">
                        {formatDate(profile?.grantedAt ?? null)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {status === "GRANTED" && (
                            <>
                              <button
                                onClick={() => setOpen(isOpen ? null : u.id)}
                                className="rounded border border-slate-700 bg-slate-950/50 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-white"
                              >
                                {isOpen ? "Hide" : "Preview"}
                              </button>
                              <button
                                disabled={pending}
                                onClick={() => {
                                  const fd = new FormData();
                                  fd.set("userId", u.id);
                                  act(revokeAgent, fd);
                                }}
                                className="rounded border border-red-500/35 bg-transparent px-2 py-1 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                              >
                                Revoke
                              </button>
                            </>
                          )}

                          {status === "SUSPENDED" && (
                            <>
                              <button
                                disabled={pending}
                                onClick={() => {
                                  const fd = new FormData();
                                  fd.set("userId", u.id);
                                  act(grantAgent, fd);
                                }}
                                className="rounded border border-emerald-500/40 bg-transparent px-2 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => setOpen(isOpen ? null : u.id)}
                                className="rounded border border-slate-700 bg-slate-950/50 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-white"
                              >
                                {isOpen ? "Hide" : "Preview"}
                              </button>
                            </>
                          )}

                          {status === "PENDING" && (
                            <>
                              <button
                                disabled={pending}
                                onClick={() => {
                                  const fd = new FormData();
                                  fd.set("userId", u.id);
                                  act(grantAgent, fd);
                                }}
                                className="rounded border border-emerald-500/40 bg-transparent px-2 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                              >
                                {pending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Grant"
                                )}
                              </button>
                              <button
                                onClick={() => setOpen(isOpen ? null : u.id)}
                                className="rounded border border-slate-700 bg-slate-950/50 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-white"
                              >
                                {isOpen ? "Hide" : "Preview"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isOpen && plan && <PlanDrawer plan={plan} name={u.name} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3 items-start rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <b className="font-semibold">An account must be approved before its agent can be granted.</b>{" "}
          Users whose account is still <code className="text-inherit">PENDING</code> do not appear
          in this list at all — registration alone is never access.
        </div>
      </div>

      <div className="space-y-1 text-[11.5px] leading-relaxed text-slate-400">
        <p>
          <b className="font-semibold text-slate-300">Handles are issued once and never change.</b>{" "}
          Renaming a user does not move their agent, and the profile directory follows the handle
          (<code className="font-mono text-slate-300">gerald</code> →{" "}
          <code className="font-mono text-slate-300">res-gerald</code>).
        </p>
        <p>
          <b className="font-semibold text-slate-300">Revoking archives, never deletes.</b> A
          suspended agent keeps its memory bank; restoring reconnects it. Removing a student&apos;s
          research history is the one action that cannot be undone.
        </p>
      </div>
    </>
  );
}
