"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Shield, Mail, Phone, Clock, Edit2, X, Check, Camera, Loader2, FileText, Users, Crop, Trash2, RotateCcw, Minus, Plus } from "lucide-react";
import { formatDateTimeWib } from "@/lib/utils";
import { updateProfile, updateAvatar, removeAvatar } from "@/app/actions/profile";
import { useToast } from "@/components/toast";
import Image from "next/image";
import { IdCardGenerator } from "./id-card-generator";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropUtils";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ProfileUser = {
    id: string;
    name: string;
    nickname: string | null;
    email: string;
    phone: string;
    nim: string | null;
    supervisors: string[];
    roles: string[];
    status: string;
    image: string | null;
    createdAt: Date;
};

function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
        return "Only JPEG, PNG, or WebP images are supported";
    }
    if (file.size > MAX_FILE_SIZE) {
        return `Image must be under ${MAX_FILE_SIZE / 1024 / 1024} MB (yours: ${(file.size / 1024 / 1024).toFixed(1)} MB)`;
    }
    return null;
}

export function ProfileEditor({ user }: { user: ProfileUser }) {
    const toast = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [removeLoading, setRemoveLoading] = useState(false);

    // Form states
    const [name, setName] = useState(user.name);
    const [nickname, setNickname] = useState(user.nickname || "");
    const [email, setEmail] = useState(user.email);
    const [phone, setPhone] = useState(user.phone);

    // Drag-and-drop
    const [isDragging, setIsDragging] = useState(false);

    // Cropper states
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Live preview
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const result = await updateProfile({ name, nickname, email, phone });
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
        setNickname(user.nickname || "");
        setEmail(user.email);
        setPhone(user.phone);
        setIsEditing(false);
    }

    function processFile(file: File) {
        const error = validateFile(file);
        if (error) {
            toast.error(error);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setCropImageSrc(reader.result as string);
            // Reset cropper state
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setRotation(0);
            setPreviewUrl(null);
        };
        reader.readAsDataURL(file);
    }

    function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
    }

    // ── Drag and Drop ──
    function handleDragOver(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }

    function handleDragLeave(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    // Live preview generation (debounced)
    useEffect(() => {
        if (!cropImageSrc || !croppedAreaPixels) return;

        const timer = setTimeout(async () => {
            try {
                const result = await getCroppedImg(cropImageSrc, croppedAreaPixels, rotation);
                setPreviewUrl(result);
            } catch {
                // Silently fail — preview is non-critical
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [cropImageSrc, croppedAreaPixels, rotation]);

    async function handleCropSave() {
        if (!cropImageSrc || !croppedAreaPixels) return;

        setAvatarLoading(true);
        try {
            const croppedImage = await getCroppedImg(
                cropImageSrc,
                croppedAreaPixels,
                rotation
            );

            if (croppedImage) {
                const result = await updateAvatar(croppedImage);
                if (result.success) {
                    toast.success(result.message);
                } else {
                    toast.error(result.message);
                }
            }
        } catch (e) {
            console.error("Failed to crop image", e);
            toast.error("Failed to crop image");
        }

        setCropImageSrc(null);
        setPreviewUrl(null);
        setAvatarLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    function closeCropper() {
        setCropImageSrc(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    function resetCropper() {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
    }

    async function handleRemovePhoto() {
        setRemoveLoading(true);
        const result = await removeAvatar();
        setRemoveLoading(false);

        if (result.success) {
            toast.success(result.message);
        } else {
            toast.error(result.message);
        }
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

                {/* Avatar Display & Upload with Drag-and-Drop */}
                <div
                    className="relative group mb-4"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div
                        className={`h-20 w-20 rounded-full bg-orange-500/20 overflow-hidden flex items-center justify-center relative shadow-lg transition-all duration-200 ${isDragging
                            ? "border-2 border-orange-400 ring-4 ring-orange-500/30 scale-110"
                            : "border-2 border-orange-500/30"
                            }`}
                    >
                        {avatarLoading || removeLoading ? (
                            <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
                        ) : user.image ? (
                            <Image src={user.image} alt={user.name} fill className="object-cover" />
                        ) : (
                            <span className="text-3xl font-bold text-orange-400">
                                {user.name.charAt(0).toUpperCase()}
                            </span>
                        )}

                        {/* Hover Overlay for Upload (desktop) */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Change profile photo"
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex-col justify-center items-center text-white cursor-pointer hidden sm:flex"
                        >
                            <Camera className="h-5 w-5 mb-1" />
                            <span className="text-[9px] font-medium uppercase tracking-wider">Change</span>
                        </button>
                    </div>

                    {/* Mobile camera badge (always visible on small screens) */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Change profile photo"
                        className="sm:hidden absolute -bottom-1 -right-1 h-7 w-7 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-800 transition-colors"
                    >
                        <Camera className="h-3.5 w-3.5 text-white" />
                    </button>

                    {/* Remove Photo button */}
                    {user.image && !avatarLoading && !removeLoading && (
                        <button
                            type="button"
                            onClick={handleRemovePhoto}
                            aria-label="Remove profile photo"
                            title="Remove photo"
                            className="absolute -bottom-1 -left-1 h-7 w-7 bg-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-800 transition-colors group/remove"
                        >
                            <Trash2 className="h-3 w-3 text-slate-400 group-hover/remove:text-white" />
                        </button>
                    )}

                    {/* Drag indicator text */}
                    {isDragging && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-orange-600 text-white text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shadow-xl">
                                Drop
                            </div>
                        </div>
                    )}
                </div>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImagePick}
                />

                <h2 className="text-lg font-semibold text-white">
                    {user.name} {user.nickname && <span className="text-slate-400 font-normal">({user.nickname})</span>}
                </h2>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5 justify-center">
                    <Shield className="h-3.5 w-3.5 text-slate-500" />
                    <span className="uppercase tracking-wider font-medium">{user.roles.join(", ")}</span>
                </p>

                {/* PDF ID Card Export - Only visible if Avatar exists */}
                {!isEditing && user.image && (
                    <IdCardGenerator user={user} />
                )}

                {/* Cropper Modal */}
                {cropImageSrc && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-6 backdrop-blur-sm animate-fade-in text-left">
                        <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50 shrink-0">
                                <h3 className="text-white font-semibold flex items-center gap-2">
                                    <Crop className="h-4 w-4 text-orange-400" /> Position & Crop
                                </h3>
                                <button
                                    onClick={closeCropper}
                                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="relative w-full h-[50vh] sm:h-[60vh] bg-slate-950 shrink-0">
                                <Cropper
                                    image={cropImageSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    rotation={rotation}
                                    aspect={3 / 4}
                                    minZoom={0.3}
                                    maxZoom={5}
                                    zoomSpeed={0.3}
                                    objectFit="contain"
                                    onCropChange={setCrop}
                                    onRotationChange={setRotation}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    cropShape="rect"
                                    showGrid={false}
                                    style={{
                                        containerStyle: { background: "rgb(2 6 23)" }
                                    }}
                                />
                                {/* Circular overlay hint */}
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                                    <div className="border-2 border-dashed border-white/50 w-[70%] max-w-[300px] aspect-square rounded-full flex items-center justify-center drop-shadow-xl relative z-10">
                                        <div className="bg-black/20 absolute inset-0 rounded-full w-full h-full backdrop-blur-[1px] opacity-10" />
                                        <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-black/40 rounded shadow-lg backdrop-blur-md relative z-20">Avatar Safe Zone</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 bg-slate-800 space-y-4 overflow-y-auto">
                                {/* Zoom control */}
                                <div>
                                    <label className="text-xs text-slate-400 font-medium mb-2 flex justify-between" aria-label="Zoom">
                                        <span>Zoom</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-500">{zoom.toFixed(1)}×</span>
                                        </div>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
                                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors shrink-0"
                                            aria-label="Zoom out"
                                        >
                                            <Minus className="h-3.5 w-3.5" />
                                        </button>
                                        <input
                                            type="range"
                                            value={zoom}
                                            min={0.3}
                                            max={5}
                                            step={0.05}
                                            onChange={(e) => setZoom(Number(e.target.value))}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                            aria-label="Zoom level"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setZoom(Math.min(5, zoom + 0.1))}
                                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors shrink-0"
                                            aria-label="Zoom in"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Rotation control */}
                                <div>
                                    <label className="text-xs text-slate-400 font-medium mb-2 flex justify-between" aria-label="Rotation">
                                        <span>Rotation</span>
                                        <span className="text-slate-500">{rotation}°</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRotation(Math.max(-45, rotation - 1))}
                                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors shrink-0"
                                            aria-label="Rotate left"
                                        >
                                            <Minus className="h-3.5 w-3.5" />
                                        </button>
                                        <input
                                            type="range"
                                            value={rotation}
                                            min={-45}
                                            max={45}
                                            step={1}
                                            onChange={(e) => setRotation(Number(e.target.value))}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                            aria-label="Rotation angle"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setRotation(Math.min(45, rotation + 1))}
                                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors shrink-0"
                                            aria-label="Rotate right"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Reset + Preview row */}
                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={resetCropper}
                                        className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5 font-medium transition-colors"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Reset
                                    </button>

                                    {/* Live Preview */}
                                    {previewUrl && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Preview</span>
                                            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-slate-600 shadow-md bg-white">
                                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={closeCropper}
                                        className="flex-1 px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCropSave}
                                        disabled={avatarLoading}
                                        className="flex-1 px-4 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        {avatarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Save Photo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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
                            <FileText className="h-3.5 w-3.5 text-slate-500" /> Nickname <span className="text-slate-500 font-normal ml-auto text-[10px]">(Optional)</span>
                        </label>
                        {isEditing ? (
                            <input
                                value={nickname}
                                onChange={e => setNickname(e.target.value)}
                                placeholder="Display name for bookings"
                                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                            />
                        ) : (
                            <p className="text-sm text-slate-200 pl-6">{user.nickname || "—"}</p>
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
                                minLength={10}
                                maxLength={15}
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
