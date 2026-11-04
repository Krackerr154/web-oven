"use client";

import { useState, useTransition } from "react";
import { upsertSupervisor } from "@/app/actions/supervisors";
import { Pencil, Check, X, AlertTriangle, ShieldCheck } from "lucide-react";

type Props = {
    supervisor: {
        id: string;
        name: string;
        nip: string | null;
        email: string | null;
        researchGroup: string | null;
        researchTopic: string | null;
        active: boolean;
    };
};

export function SupervisorRow({ supervisor }: Props) {
    const [editing, setEditing] = useState(false);
    const [nip, setNip] = useState(supervisor.nip ?? "");
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();

    function save() {
        const digits = nip.replace(/\D/g, "");
        if (digits.length !== 18) {
            // Say the exact problem instead of silently refusing.
            setError(`NIP must be 18 digits — got ${digits.length}`);
            return;
        }
        setError(null);
        const fd = new FormData();
        fd.set("id", supervisor.id);
        fd.set("name", supervisor.name);
        fd.set("nip", digits);
        fd.set("email", supervisor.email ?? "");
        fd.set("researchGroup", supervisor.researchGroup ?? "");
        fd.set("researchTopic", supervisor.researchTopic ?? "");
        fd.set("active", String(supervisor.active));
        start(async () => {
            const res = await upsertSupervisor(fd);
            if (!res.success) setError(res.message);
            else setEditing(false);
        });
    }

    return (
        <tr className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
            <td className="px-4 py-2.5">
                <div className="text-slate-200 leading-tight">{supervisor.name}</div>
                {supervisor.email && (
                    <div className="text-[11px] text-slate-500">{supervisor.email}</div>
                )}
            </td>
            <td className="px-4 py-2.5">
                {editing ? (
                    <div className="space-y-1">
                        <input
                            autoFocus
                            value={nip}
                            inputMode="numeric"
                            onChange={(e) => setNip(e.target.value.replace(/\D/g, ""))}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") save();
                                if (e.key === "Escape") {
                                    setEditing(false);
                                    setError(null);
                                    setNip(supervisor.nip ?? "");
                                }
                            }}
                            maxLength={18}
                            placeholder="18 digits"
                            className="w-44 rounded border border-orange-500/70 bg-slate-950 px-2 py-1 font-mono text-xs text-white outline-none"
                        />
                        {error && <p className="text-[10px] text-red-400">{error}</p>}
                    </div>
                ) : supervisor.nip ? (
                    <span className="font-mono text-xs text-slate-300">{supervisor.nip}</span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> not published
                    </span>
                )}
            </td>
            <td className="px-4 py-2.5 text-[11px] text-slate-400">
                {supervisor.researchGroup ?? "—"}
            </td>
            <td className="px-4 py-2.5">
                {supervisor.nip ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        <ShieldCheck className="h-3 w-3" /> signer
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                        <AlertTriangle className="h-3 w-3" /> hidden
                    </span>
                )}
            </td>
            <td className="px-4 py-2.5 text-right">
                {editing ? (
                    <div className="inline-flex gap-1">
                        <button
                            onClick={save}
                            disabled={pending}
                            title="Save NIP"
                            className="grid h-6 w-6 place-items-center rounded text-emerald-400 hover:bg-slate-700/60 disabled:opacity-40"
                        >
                            <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => {
                                setEditing(false);
                                setError(null);
                                setNip(supervisor.nip ?? "");
                            }}
                            title="Cancel"
                            className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-700/60"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setEditing(true)}
                        title="Edit NIP"
                        className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:text-white hover:bg-slate-700/60"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                )}
            </td>
        </tr>
    );
}
