import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FlaskConical, ShieldCheck, Wrench } from "lucide-react";

export const metadata: Metadata = {
    title: "About | AP-Lab",
    description: "What AP-Lab is, who operates it, and how it is built.",
};

export default function AboutPage() {
    return (
        <div className="max-w-3xl space-y-10 animate-fade-in">
            {/* Header */}
            <header className="flex items-start gap-5">
                <img
                    src="/rheovant-mark.svg"
                    alt="Rheovant"
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 opacity-90"
                />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        AP-Lab
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Laboratory operations platform
                    </p>
                </div>
            </header>

            <section className="space-y-3">
                <p className="text-slate-300 leading-relaxed">
                    AP-Lab is the shared operations system for the laboratory. It
                    covers instrument bookings and approvals, chemical inventory,
                    glassware loans, announcements, and the paperwork that used to
                    live in scattered spreadsheets.
                </p>
                <p className="text-slate-400 leading-relaxed text-sm">
                    Access is by invitation. Every booking, loan, and approval is
                    recorded against a named member so the record matches what
                    actually happened at the bench.
                </p>
            </section>

            {/* Divider */}
            <div className="h-px bg-slate-700/50" />

            <section className="space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Engineering &amp; infrastructure
                </h2>

                <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-5">
                    <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-slate-700/40 p-2 text-slate-300">
                            <Wrench className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">
                                Rheovant Systems
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-400">
                                AP-Lab is designed, built, and operated by Rheovant
                                Systems — the applied-science engineering studio
                                behind the instrumentation and software running here.
                            </p>
                            <Link
                                href="https://rheovant.tech"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-white"
                            >
                                rheovant.tech
                                <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Operation
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-5">
                        <div className="rounded-lg bg-slate-700/40 p-2 text-slate-300 w-fit">
                            <FlaskConical className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">
                            Run by the lab, for the lab
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">
                            Rule changes, approval flows, and instrument policy are
                            set by the lab&apos;s administrators, not by the platform.
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-5">
                        <div className="rounded-lg bg-slate-700/40 p-2 text-slate-300 w-fit">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">
                            Private by default
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">
                            Member records and booking history sit behind sign-in and
                            are excluded from search indexing.
                        </p>
                    </div>
                </div>
            </section>

            <footer className="border-t border-slate-700/50 pt-5 text-xs text-slate-500">
                AP-Lab &middot; infrastructure by{" "}
                <Link
                    href="https://rheovant.tech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 transition-colors hover:text-slate-200"
                >
                    Rheovant Systems
                </Link>
            </footer>
        </div>
    );
}
