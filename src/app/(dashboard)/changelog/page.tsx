import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CURRENT_VERSION, KIND_LABEL, RELEASES, type ChangeKind } from "@/lib/changelog";
import { Sparkles, Check, ArrowUpRight } from "lucide-react";

export const metadata = { title: `Changelog | AP-Lab` };

// The layout already forces dynamic rendering; declaring it here keeps the
// route honest if that default ever changes, since it reads the session.
export const dynamic = "force-dynamic";

const KIND_STYLE: Record<ChangeKind, { chip: string; icon: boolean }> = {
    new: { chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: true },
    improved: { chip: "border-sky-500/30 bg-sky-500/10 text-sky-300", icon: false },
    fixed: { chip: "border-amber-500/30 bg-amber-500/10 text-amber-300", icon: false },
    removed: { chip: "border-slate-500/30 bg-slate-500/10 text-slate-400", icon: false },
};

function formatDate(iso: string) {
    // Fixed locale and UTC: a changelog date should not shift by a day
    // depending on where the reader is.
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

// Rendered per-release relative to the newest entry, so "Latest" is derived
// rather than hardcoded and cannot go stale when a release is added.
const LATEST = RELEASES[0]?.version;

export default async function ChangelogPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect("/login?callbackUrl=/changelog");

    return (
        <div className="max-w-3xl">
            <div className="mb-8">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-orange-400 mb-3">
                    <Sparkles className="h-3.5 w-3.5" />
                    Release history
                </div>
                <h1 className="text-2xl font-bold text-white sm:text-3xl">What&apos;s new in AP-Lab</h1>
                <p className="mt-2 text-sm text-slate-400">
                    Everything that has changed, newest first. Currently on{" "}
                    <span className="font-mono text-slate-300">v{CURRENT_VERSION}</span>.
                </p>
            </div>

            <ol className="relative space-y-6 border-l border-slate-700/60 pl-6 sm:pl-8">
                {RELEASES.map((release) => (
                    <li key={release.version} className="relative">
                        {/* Node marker, aligned to the version line */}
                        <span
                            className={`absolute -left-[31px] sm:-left-[39px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 ${
                                release.version === LATEST
                                    ? "border-orange-400 bg-orange-400"
                                    : "border-slate-600 bg-slate-950"
                            }`}
                            aria-hidden="true"
                        />

                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h2 className="font-mono text-lg font-semibold text-white">
                                v{release.version}
                            </h2>
                            {release.version === LATEST && (
                                <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
                                    Latest
                                </span>
                            )}
                            <span className="text-xs text-slate-500">{formatDate(release.date)}</span>
                        </div>

                        <h3 className="mt-1 text-sm font-medium text-slate-200">{release.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">{release.summary}</p>

                        <ul className="mt-3 space-y-2">
                            {release.changes.map((change, i) => {
                                const style = KIND_STYLE[change.kind];
                                return (
                                    <li key={i} className="flex items-start gap-2.5">
                                        <span
                                            className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.chip}`}
                                        >
                                            {KIND_LABEL[change.kind]}
                                        </span>
                                        <span className="text-sm leading-relaxed text-slate-300">
                                            {change.text}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </li>
                ))}

                {/* Opening marker: makes clear the log does not stop here */}
                <li className="relative">
                    <span
                        className="absolute -left-[30px] sm:-left-[38px] top-1 flex h-2.5 w-2.5 rounded-full border border-slate-700 bg-slate-900"
                        aria-hidden="true"
                    />
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                        <Check className="h-3.5 w-3.5" />
                        That is the whole history — 0.5.0 is where AP-Lab began.
                    </p>
                </li>
            </ol>

            <div className="mt-10 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                <p className="text-xs leading-relaxed text-slate-400">
                    <span className="font-medium text-slate-300">Why versions here, not build numbers?</span>{" "}
                    A version appears in the sidebar so you can tell someone which AP-Lab you are
                    looking at. If the app ever fails after an update, clearing the browser cache and
                    reloading usually fixes it — a stale tab can be running the previous version.
                </p>
                <Link
                    href="/"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300"
                >
                    Back to the dashboard
                    <ArrowUpRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}
