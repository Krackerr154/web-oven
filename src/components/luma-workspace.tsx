"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LumaChat } from "@/components/luma-chat";
import { LumaRail } from "@/components/luma-rail";
import type { InstrumentStatusRow } from "@/lib/instrument-status";

type Booking = { instrument: string; start: string; end: string; status: string };

/**
 * Owns the split layout and the rail's open state.
 *
 * The rail is server-rendered with the page, then refreshed on an interval via
 * router.refresh() so "live" means live. 60s is deliberate: instrument state
 * changes on a lab timescale, not a trading-desk one, and a tighter loop would
 * re-render the conversation underneath the user mid-sentence.
 */
export function LumaWorkspace({
  instruments,
  total,
  freeNow,
  bookings,
  userId,
}: {
  instruments: InstrumentStatusRow[];
  total: number;
  freeNow: number;
  bookings: Booking[];
  userId: string;
}) {
  const [railOpen, setRailOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="flex h-[calc(100dvh-6rem)] gap-4 lg:h-[calc(100dvh-4rem)] lg:gap-5">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <LumaChat onOpenRail={() => setRailOpen(true)} userId={userId} />
      </div>

      <LumaRail
        instruments={instruments}
        total={total}
        freeNow={freeNow}
        bookings={bookings}
        open={railOpen}
        onClose={() => setRailOpen(false)}
      />
    </div>
  );
}
