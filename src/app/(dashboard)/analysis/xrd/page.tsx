import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { XrdPlotter } from "@/components/analysis/xrd-plotter";

export const metadata: Metadata = {
    title: "XRD Plotter | AP-Lab",
    description:
        "Overlay and offset powder XRD scans into a publication figure. Parsing runs entirely in the browser.",
};

export default function XrdPlotterPage() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <Link
                    href="/analysis"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Analysis
                </Link>
                <h1 className="text-3xl font-bold tracking-tight text-white">XRD Plotter</h1>
                <p className="text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
                    Load two-column scans from the diffractometer, stack them into a waterfall with
                    an adjustable offset, and export a figure ready for a thesis column.
                </p>
            </div>

            <XrdPlotter />
        </div>
    );
}
