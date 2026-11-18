"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FlaskConical, CalendarDays, X, ArrowUpRight } from "lucide-react";
import type { InstrumentStatusRow } from "@/lib/instrument-status";

/* ------------------------------------------------------------- labels */

const TYPE_LABEL: Record<string, string> = {
  OVEN: "Oven",
  CPD: "Critical point dryer",
  GLOVEBOX: "Glovebox",
  ULTRASONIC_BATH: "Ultrasonic bath",
};

const CATEGORY_LABEL: Record<string, string> = {
  NON_AQUEOUS: "Non-aqueous",
  AQUEOUS: "Aqueous",
};

function humanize(v?: string | null): string {
  if (!v) return "—";
  return v.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function kindOf(r: InstrumentStatusRow): string {
  if (r.category && CATEGORY_LABEL[r.category]) return CATEGORY_LABEL[r.category];
  if (TYPE_LABEL[r.type]) return TYPE_LABEL[r.type];
  return humanize(r.category ?? r.type);
}

/** Operating limits — facts a chat answer does not carry at a glance. */
function limitsOf(r: InstrumentStatusRow): string {
  const parts: string[] = [];
  if (r.maxTemp) parts.push(`${r.maxTemp} °C`);
  if (r.maxN2FlowRate) parts.push(`N₂ ${r.maxN2FlowRate} L/min`);
  return parts.join(" · ");
}

function stateOf(r: InstrumentStatusRow) {
  if (r.bookedByYou) return { label: "Yours", dot: "bg-orange-400", text: "text-orange-300" };
  if (r.bookedNow) return { label: "In use", dot: "bg-amber-400", text: "text-amber-300" };
  return { label: "Free", dot: "bg-emerald-400", text: "text-emerald-300" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

type Booking = { instrument: string; start: string; end: string; status: string };

const SHORTCUTS = [
  { href: "/instruments", label: "Instruments", hint: "Full list and specs" },
  { href: "/my-bookings", label: "My bookings", hint: "Reserve or cancel" },
  { href: "/glassware", label: "Glassware", hint: "What is on loan" },
  { href: "/reagents", label: "Chemicals", hint: "Stock and location" },
];

/* -------------------------------------------------------------- pieces */

function InstrumentRow({ r }: { r: InstrumentStatusRow }) {
  const s = stateOf(r);
  const limits = limitsOf(r);
  return (
    <li className="flex items-start gap-2.5 border-t border-slate-700/40 py-2.5 first:border-t-0">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] leading-tight text-slate-200">{r.name}</p>
        <p className="truncate text-[11px] leading-tight text-slate-500">
          {kindOf(r)}
          {limits ? ` · ${limits}` : ""}
        </p>
      </div>
      <span className={`shrink-0 text-[11px] font-medium ${s.text}`}>{s.label}</span>
    </li>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/30 ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHead({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-slate-700/50 px-3.5 py-2.5">
      {children}
    </header>
  );
}

function RailBody({
  instruments,
  total,
  freeNow,
  bookings,
  onClose,
  showClose,
}: {
  instruments: InstrumentStatusRow[];
  total: number;
  freeNow: number;
  bookings: Booking[];
  onClose?: () => void;
  showClose?: boolean;
}) {
  return (
    // Short laptops (1366x768) cannot fit three panels plus gaps. Scroll the
    // rail rather than letting it spill past the viewport edge.
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
      {/* Panel 1 — content height. A flex-1 list panel puts a 400px hole
          between its last row and its footer, which reads as a layout bug. */}
      <Panel>
        <PanelHead>
          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <h2 className="text-[13px] font-semibold text-white">Lab status</h2>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            {freeNow} of {total} free
          </span>
          {showClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lab status"
              className="-mr-1 ml-1 flex h-8 w-8 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </PanelHead>
        <ul className="px-3.5">
          {instruments.length ? (
            instruments.map((r) => <InstrumentRow key={r.id} r={r} />)
          ) : (
            <li className="py-3 text-[12px] text-slate-500">No instruments on record.</li>
          )}
        </ul>
        <footer className="flex items-center gap-2 border-t border-slate-700/50 px-3.5 py-2 text-[11px] text-slate-500">
          <span>Same data the chat reads</span>
          <span className="ml-auto">refreshes each minute</span>
        </footer>
      </Panel>

      {/* Panel 2 — content height, honest empty state keeps its frame. */}
      <Panel>
        <PanelHead>
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <h2 className="text-[13px] font-semibold text-white">Your bookings</h2>
          <span className="ml-auto text-[11px] text-slate-500">
            {bookings.length ? `${bookings.length} upcoming` : "none"}
          </span>
        </PanelHead>
        <ul className="px-3.5">
          {bookings.length ? (
            bookings.slice(0, 3).map((b, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 border-t border-slate-700/40 py-2 first:border-t-0"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] text-slate-200">
                  {b.instrument}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                  {fmtDay(b.start)}
                </span>
              </li>
            ))
          ) : (
            <li className="py-2.5 text-[12px] text-slate-500">
              Nothing booked — reservations appear here.
            </li>
          )}
        </ul>
      </Panel>

      {/* Panel 3 — pinned to the bottom edge so the column closes flush.
          Stretching the list instead leaves a hole *inside* the panel. */}
      <Panel className="mt-auto">
        <PanelHead>
          <h2 className="text-[13px] font-semibold text-white">Jump to</h2>
        </PanelHead>
        <nav className="flex flex-col px-1.5 py-1">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-700/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-slate-200">{s.label}</span>
                <span className="block truncate text-[11px] text-slate-400">{s.hint}</span>
              </span>
              <ArrowUpRight className="h-3 w-3 shrink-0 text-slate-600 transition-colors group-hover:text-slate-300" />
            </Link>
          ))}
          <p className="px-2 pb-1 pt-2 text-[11px] leading-relaxed text-slate-600">
            LUMA reads these too — ask about any of them.
          </p>
        </nav>
      </Panel>
    </div>
  );
}

/* --------------------------------------------------------------- rail */

export function LumaRail({
  instruments,
  total,
  freeNow,
  bookings,
  open,
  onClose,
}: {
  instruments: InstrumentStatusRow[];
  total: number;
  freeNow: number;
  bookings: Booking[];
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);

  return (
    <>
      <aside className="hidden w-[280px] shrink-0 flex-col xl:flex">
        <RailBody
          instruments={instruments}
          total={total}
          freeNow={freeNow}
          bookings={bookings}
        />
      </aside>

      {/* narrow screens — same content reachable, never hidden outright */}
      {open ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} aria-hidden />
          <div className="absolute inset-y-0 right-0 flex w-[min(90vw,340px)] flex-col gap-3 bg-slate-900 p-3 shadow-2xl ring-1 ring-slate-700/60">
            <RailBody
              instruments={instruments}
              total={total}
              freeNow={freeNow}
              bookings={bookings}
              onClose={onClose}
              showClose
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
