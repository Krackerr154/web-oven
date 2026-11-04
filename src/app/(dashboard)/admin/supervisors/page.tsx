import { prisma } from "@/lib/prisma";
import { SUPERVISORS } from "@/lib/supervisors";
import { SupervisorRow } from "./supervisor-row";
import { SeedButton } from "./seed-button";
import { GraduationCap, AlertTriangle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSupervisorsPage() {
    const rows = await prisma.supervisor.findMany({
        orderBy: [{ nip: "desc" }, { name: "asc" }],
    });

    const withNip = rows.filter((r) => r.nip);
    const missingNip = rows.filter((r) => !r.nip);
    const sourceMissing = SUPERVISORS.filter((s) => s.nip === null).length;
    const sourcePublished17 = SUPERVISORS.filter(
        (s) => s.nip === null && (s.email === "zulfikar@itb.ac.id" || s.email === "puspasari@itb.ac.id"),
    ).length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <GraduationCap className="h-6 w-6 text-orange-400" />
                        Supervisor Directory
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        One row ties a supervisor&apos;s name to their NIP, so a signed form can never
                        pair the wrong two. Sourced from chem.itb.ac.id/dosen.
                    </p>
                </div>
                <SeedButton />
            </div>

            {/* Honest accounting of what the source could not provide. */}
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wide">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ready to sign
                    </div>
                    <p className="mt-2 text-2xl font-bold text-white">{withNip.length}</p>
                    <p className="text-[11px] text-slate-400">18-digit NIP on record</p>
                </div>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wide">
                        <AlertTriangle className="h-3.5 w-3.5" /> Awaiting NIP
                    </div>
                    <p className="mt-2 text-2xl font-bold text-white">{missingNip.length}</p>
                    <p className="text-[11px] text-slate-400">
                        Hidden from the form until filled in
                    </p>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                        Source coverage
                    </div>
                    <p className="mt-2 text-2xl font-bold text-white">
                        {SUPERVISORS.length - sourceMissing}/{SUPERVISORS.length}
                    </p>
                    <p className="text-[11px] text-slate-400">
                        {sourceMissing} without NIP, incl. {sourcePublished17} published as 17 digits
                    </p>
                </div>
            </div>

            {rows.length === 0 && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-6 text-sm text-slate-300">
                    The table is empty. Press <span className="font-semibold text-white">Load directory</span>{" "}
                    to import the {SUPERVISORS.length} lecturers scraped from chem.itb.ac.id. The import is
                    idempotent and never overwrites a NIP you have entered by hand.
                </div>
            )}

            {rows.length > 0 && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                                    <th className="px-4 py-3 font-semibold">Name</th>
                                    <th className="px-4 py-3 font-semibold">NIP</th>
                                    <th className="px-4 py-3 font-semibold">Research group</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <SupervisorRow
                                        key={r.id}
                                        supervisor={{
                                            id: r.id,
                                            name: r.name,
                                            nip: r.nip,
                                            email: r.email,
                                            researchGroup: r.researchGroup,
                                            researchTopic: r.researchTopic,
                                            active: r.active,
                                        }}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
