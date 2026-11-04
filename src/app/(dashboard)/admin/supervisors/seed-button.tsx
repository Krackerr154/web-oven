"use client";

import { useState, useTransition } from "react";
import { seedSupervisorsFromDirectory } from "@/app/actions/supervisors";
import { Download, Loader2 } from "lucide-react";

export function SeedButton() {
    const [pending, start] = useTransition();
    const [msg, setMsg] = useState<string | null>(null);

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                disabled={pending}
                onClick={() =>
                    start(async () => {
                        const res = await seedSupervisorsFromDirectory();
                        setMsg(res.message);
                    })
                }
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-500 disabled:opacity-40"
            >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Load directory
            </button>
            {msg && <p className="text-[10px] text-slate-400 max-w-xs text-right">{msg}</p>}
        </div>
    );
}
