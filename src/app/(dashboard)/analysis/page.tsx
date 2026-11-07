import type { Metadata } from "next";
import Link from "next/link";
import { LineChart, ChevronRight, FlaskConical } from "lucide-react";

export const metadata: Metadata = {
    title: "Analysis | AP-Lab",
    description: "Measurement analysis tools for the laboratory.",
};

const tools = [
    {
        id: "xrd",
        title: "XRD Plotter",
        description:
            "Load Rigaku .xy scans, overlay and offset them into a publication figure, and export PNG, SVG or an 85 mm PDF.",
        icon: LineChart,
        href: "/analysis/xrd",
        status: "Ready",
    },
];

export default function AnalysisPage() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Analysis</h1>
                <p className="text-slate-400">
                    Turn measurement data into figures. Nothing you load here is uploaded — the
                    parsing and plotting run in your browser.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                    <Link
                        key={tool.id}
                        href={tool.href}
                        className="group block p-6 bg-slate-800 rounded-xl border border-slate-700/50 hover:bg-slate-700/50 transition-all hover:border-orange-500/50"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-orange-500/10 text-orange-400 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                <tool.icon className="h-6 w-6" />
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                        </div>

                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-orange-400 transition-colors">
                            {tool.title}
                        </h3>
                        <p className="text-sm text-slate-400 line-clamp-2">{tool.description}</p>

                        <span className="mt-4 inline-block text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                            {tool.status}
                        </span>
                    </Link>
                ))}

                {/* Placeholder for the next instrument tool. Deliberately does
                    not name a roadmap: an undated list of techniques reads as a
                    promise, and a promise with nothing behind it is worse than
                    a blank slot. */}
                <div className="block p-6 bg-slate-800/40 rounded-xl border border-dashed border-slate-700/50">
                    <div className="p-3 bg-slate-700/40 text-slate-500 rounded-lg w-fit mb-4">
                        <FlaskConical className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-400 mb-2">
                        Not built yet
                    </h3>
                    <p className="text-sm text-slate-500">
                        Only the tools listed above exist. Anything else — CV, EIS, FTIR,
                        TGA — has no plotter in AP-Lab yet.
                    </p>
                </div>
            </div>
        </div>
    );
}
