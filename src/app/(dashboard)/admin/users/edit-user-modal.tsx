"use client";

import { useState } from "react";
import { updateUserDetails } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Loader2, X, Plus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/toast";

interface EditUserModalProps {
    user: {
        id: string;
        name: string;
        email: string;
        phone: string;
        nickname?: string | null;
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

    // Identity
    const [name, setName] = useState(user.name);
    const [nickname, setNickname] = useState(user.nickname || "");

    // Contact
    const [email, setEmail] = useState(user.email);
    const [phone, setPhone] = useState(user.phone);

    // Academic
    const [nim, setNim] = useState(user.nim || "");
    const [supervisors, setSupervisors] = useState<string[]>(
        user.supervisors.length > 0 ? user.supervisors : [""]
    );

    // Security
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

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

    // Reset form to user values when opening
    function handleOpenChange(isOpen: boolean) {
        if (isOpen) {
            setName(user.name);
            setNickname(user.nickname || "");
            setEmail(user.email);
            setPhone(user.phone);
            setNim(user.nim || "");
            setSupervisors(user.supervisors.length > 0 ? user.supervisors : [""]);
            setNewPassword("");
            setError("");
        }
        setOpen(isOpen);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const validSupervisors = supervisors.filter((s) => s.trim() !== "");

        const result = await updateUserDetails(user.id, {
            name,
            email,
            phone,
            nickname: nickname || null,
            nim,
            supervisors: validSupervisors,
            newPassword: newPassword || undefined,
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

    const inputClass =
        "w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm";

    return (
        <Dialog.Root open={open} onOpenChange={handleOpenChange}>
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
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-2xl z-50 animate-slide-up focus:outline-none">
                    <div className="flex items-center justify-between mb-5">
                        <Dialog.Title className="text-xl font-bold text-white">
                            Edit User
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

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        {/* ── Identity ── */}
                        <fieldset className="space-y-3">
                            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Identity</legend>
                            <div>
                                <label htmlFor="editName" className="block text-sm font-medium text-slate-300 mb-1">
                                    Full Name
                                </label>
                                <input
                                    id="editName"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={inputClass}
                                    placeholder="Full Name"
                                />
                            </div>
                            <div>
                                <label htmlFor="editNickname" className="block text-sm font-medium text-slate-300 mb-1">
                                    Nickname <span className="text-slate-500 text-xs">(optional)</span>
                                </label>
                                <input
                                    id="editNickname"
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className={inputClass}
                                    placeholder="Nickname"
                                />
                            </div>
                        </fieldset>

                        {/* ── Contact ── */}
                        <fieldset className="space-y-3">
                            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contact</legend>
                            <div>
                                <label htmlFor="editEmail" className="block text-sm font-medium text-slate-300 mb-1">
                                    Email
                                </label>
                                <input
                                    id="editEmail"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputClass}
                                    placeholder="user@email.com"
                                />
                            </div>
                            <div>
                                <label htmlFor="editPhone" className="block text-sm font-medium text-slate-300 mb-1">
                                    Phone
                                </label>
                                <input
                                    id="editPhone"
                                    type="text"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={inputClass}
                                    placeholder="+62..."
                                />
                            </div>
                        </fieldset>

                        {/* ── Academic ── */}
                        <fieldset className="space-y-3">
                            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Academic</legend>
                            <div>
                                <label htmlFor="editNim" className="block text-sm font-medium text-slate-300 mb-1">
                                    NIM / Student ID
                                </label>
                                <input
                                    id="editNim"
                                    type="text"
                                    required
                                    value={nim}
                                    onChange={(e) => setNim(e.target.value)}
                                    className={inputClass}
                                    placeholder="Student ID"
                                />
                            </div>

                            <div className="space-y-2 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-slate-300">Supervisor(s)</label>
                                </div>
                                {supervisors.map((supervisor, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            required
                                            value={supervisor}
                                            onChange={(e) => updateSupervisor(index, e.target.value)}
                                            className={inputClass}
                                            placeholder={index === 0 ? "Main Supervisor" : "Co-Supervisor"}
                                        />
                                        {supervisors.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeSupervisor(index)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                                                title="Remove"
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
                                    Add Another
                                </button>
                            </div>
                        </fieldset>

                        {/* ── Security ── */}
                        <fieldset className="space-y-3">
                            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Security</legend>
                            <div>
                                <label htmlFor="editNewPassword" className="block text-sm font-medium text-slate-300 mb-1">
                                    New Password <span className="text-slate-500 text-xs">(leave blank to keep current)</span>
                                </label>
                                <div className="relative">
                                    <input
                                        id="editNewPassword"
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className={inputClass + " pr-10"}
                                        placeholder="Min 8 characters"
                                        minLength={newPassword ? 8 : undefined}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {newPassword && newPassword.length > 0 && newPassword.length < 8 && (
                                    <p className="text-xs text-amber-400 mt-1">Password must be at least 8 characters</p>
                                )}
                            </div>
                        </fieldset>

                        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
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
                                disabled={loading || (!!newPassword && newPassword.length < 8)}
                                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
