"use client";

import { useState } from "react";
import { updateUserDetails } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Loader2, X, Plus } from "lucide-react";
import { useToast } from "@/components/toast";

interface EditUserModalProps {
    user: {
        id: string;
        nim?: string | null;
        supervisors: string[];
    };
}

export function EditUserModal({ user }: EditUserModalProps) {
    const router = useRouter();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [nim, setNim] = useState(user.nim || "");
    const [supervisors, setSupervisors] = useState<string[]>(
        user.supervisors.length > 0 ? user.supervisors : [""]
    );

    const addSupervisor = () => setSupervisors([...supervisors, ""]);

    const removeSupervisor = (index: number) => {
        if (supervisors.length > 1) {
            setSupervisors(supervisors.filter((_, i) => i !== index));
        }
    };

    const updateSupervisor = (index: number, value: string) => {
        const updated = [...supervisors];
        updated[index] = value;
        setSupervisors(updated);
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const validSupervisors = supervisors.filter((s) => s.trim() !== "");

        const result = await updateUserDetails(user.id, {
            nim,
            supervisors: validSupervisors,
        });

        setLoading(false);

        if (result.success) {
            toast.success(result.message);
            setOpen(false);
            router.refresh();
        } else {
            setError(result.message);
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <button
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Edit User Details"
                >
                    <Pencil className="h-4 w-4" />
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-2xl z-50 animate-slide-up focus:outline-none">
                    <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-xl font-bold text-white">
                            Edit User Details
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="nim"
                                className="block text-sm font-medium text-slate-300 mb-1.5"
                            >
                                NIM
                            </label>
                            <input
                                id="nim"
                                type="text"
                                required
                                value={nim}
                                onChange={(e) => setNim(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                placeholder="Student ID"
                            />
                        </div>

                        <div className="space-y-3 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-slate-300">
                                    Supervisor(s)
                                </label>
                            </div>

                            {supervisors.map((supervisor, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        required
                                        value={supervisor}
                                        onChange={(e) => updateSupervisor(index, e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                        placeholder={
                                            index === 0 ? "Main Supervisor Name" : "Co-Supervisor Name"
                                        }
                                    />
                                    {supervisors.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeSupervisor(index)}
                                            className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                                            title="Remove Supervisor"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addSupervisor}
                                className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5 font-medium px-1 py-1 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Another Supervisor
                            </button>
                        </div>

                        <div className="pt-4 flex items-center justify-end gap-3">
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
                                >
                                    Cancel
                                </button>
                            </Dialog.Close>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Save Details
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
