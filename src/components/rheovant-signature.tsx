import Link from "next/link";

/**
 * "The Knot in the Footer" — Rheovant's standard signature for endorsed
 * products. The application keeps the top navigation entirely to itself;
 * the parent engineering entity gets one muted line at the bottom edge.
 *
 * The knot is deliberately simplified to two crossing stadium bands in a
 * single stroke. The master mark carries three tracks per band with
 * over/under passes, which collapses into an unreadable blob below ~24px.
 */
export function RheovantSignature({ className = "" }: { className?: string }) {
    return (
        <Link
            href="https://rheovant.tech"
            target="_blank"
            rel="noopener noreferrer"
            className={`group inline-flex items-center gap-2 text-[10px] leading-none text-slate-500 transition-colors hover:text-slate-300 ${className}`}
        >
            <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                aria-hidden="true"
            >
                <g transform="rotate(-45 12 12)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                    <rect x="4.5" y="8.6" width="15" height="6.8" rx="3.4" />
                    <rect
                        x="4.5"
                        y="8.6"
                        width="15"
                        height="6.8"
                        rx="3.4"
                        opacity="0.45"
                        transform="rotate(90 12 12)"
                    />
                </g>
            </svg>
            <span className="tracking-tight">
                Rheovant Systems
                <span className="mx-1 text-slate-600">·</span>
                <span className="text-slate-600 group-hover:text-slate-500">
                    Open Infrastructure
                </span>
            </span>
        </Link>
    );
}
