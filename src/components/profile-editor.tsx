"use client";

import { useState, useRef } from "react";
import { Shield, Mail, Phone, Clock, Edit2, X, Check, Camera, Loader2, FileText, Users } from "lucide-react";
import { formatDateTimeWib } from "@/lib/utils";
import { updateProfile, updateAvatar } from "@/app/actions/profile";
import { useToast } from "@/components/toast";
import Image from "next/image";

type ProfileUser = {
    id: string;
    name: string;
    email: string;
    phone: string;
    nim: string | null;
    supervisors: string[];
    role: string;
    status: string;
    image: string | null;
    createdAt: Date;
};

export function ProfileEditor({ user }: { user: ProfileUser }) {
    const toast = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);

    // Form states
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [phone, setPhone] = useState(user.phone);

    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const result = await updateProfile({ name, email, phone });
        setLoading(false);

        if (result.success) {
            toast.success(result.message);
            setIsEditing(false);
        } else {
            toast.error(result.message);
        }
    }

    function handleCancel() {
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone);
        setIsEditing(false);
    }

    async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please upload a valid image file");
            return;
        }

        // Limit to 2MB to keep base64 string reasonable for the database text field
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image size must be less than 2MB");
            return;
        }

        setAvatarLoading(true);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            const result = await updateAvatar(base64String);

            setAvatarLoading(false);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        };
        reader.readAsDataURL(file);
    }

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="flex flex-col items-center text-center relative">

                {/* Edit Toggle Button */}
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="absolute top-0 right-0 p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                        title="Edit Profile"
                    >
                        <Edit2 className="h-4 w-4" />
                    </button>
                )}

                {/* Avatar Display & Upload */}
                <div className="relative group mb-4">
                    <div className="h-20 w-20 rounded-full bg-orange-500/20 border-2 border-orange-500/30 overflow-hidden flex items-center justify-center relative shadow-lg">
                        {avatarLoading ? (
                            <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
                        ) : user.image ? (
                            <Image src={user.image} alt={user.name} fill className="object-cover" />
                        ) : (
                            <span className="text-3xl font-bold text-orange-400">
                                {user.name.charAt(0).toUpperCase()}
                            </span>
                        )}

                        {/* Hover Overlay for Upload */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center text-white cursor-pointer"
                        >
                            <Camera className="h-5 w-5 mb-1" />
                            <span className="text-[9px] font-medium uppercase tracking-wider">Change</span>
                        </button>
                    </div>
                </div>
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImagePick}
                />

                <h2 className="text-lg font-semibold text-white">{user.name}</h2>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5 justify-center">
                    <Shield className="h-3.5 w-3.5 text-slate-500" />
                    <span className="uppercase tracking-wider font-medium">{user.role}</span>
                </p>
            </div>

            <form onSubmit={handleSave} className="mt-8 space-y-4">
                {/* Editable Fields */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-slate-500" /> Full Name
                        </label>
                        {isEditing ? (
                            <input
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                            />
                        ) : (
                            <p className="text-sm text-slate-200 pl-6">{user.name}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-500" /> Email Address
                        </label>
                        {isEditing ? (
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                            />
                        ) : (
                            <p className="text-sm text-slate-200 break-all pl-6" title={user.email}>{user.email}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-500" /> Phone Number
                        </label>
                        {isEditing ? (
                            <input
                                required
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                            />
                        ) : (
                            <p className="text-sm text-slate-200 pl-6">{user.phone}</p>
                        )}
                    </div>
                </div>

                <div className="h-px w-full bg-slate-700/50 my-4" />

                {/* Read-only Additional Educational Fields */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-slate-500" /> Student Identity (NIM)
                        </label>
                        <p className="text-sm text-slate-200 pl-6">{user.nim || "—"}</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-slate-500" /> Supervisor(s)
                        </label>
                        <div className="pl-6 space-y-1">
                            {user.supervisors && user.supervisors.length > 0 ? (
                                user.supervisors.map((s, i) => (
                                    <p key={i} className="text-sm text-slate-200">• {s}</p>
                                ))
                            ) : (
                                <p className="text-sm text-slate-200">—</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-500" /> Account Created
                        </label>
                        <p className="text-sm text-slate-200 pl-6">{formatDateTimeWib(user.createdAt)}</p>
                    </div>
                </div>

                {isEditing && (
                    <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-700/50">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <X className="h-4 w-4" /> Cancel
                        </button>
                    </div>
                )}
            </form>

            <div className="mt-8 pt-6 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Account Status</span>
                    <span
                        className={`text-[11px] px-2.5 py-1 uppercase tracking-wider rounded-md font-bold ${user.status === "APPROVED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : user.status === "PENDING"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-red-500/20 text-red-400"
                            }`}
                    >
                        {user.status}
                    </span>
                </div>
            </div>
        </div>
    );
}
