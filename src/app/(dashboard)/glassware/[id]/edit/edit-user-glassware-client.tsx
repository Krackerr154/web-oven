"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editUserGlassware } from "@/app/actions/glassware";
import { Beaker, Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { GlasswareItem } from "@/app/actions/glassware"; // Ensure types are exported from the action or define them appropriately

export default function EditUserGlasswareClient({ initialData }: { initialData: any }) {
    const router = useRouter();
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: initialData.name || "",
        type: initialData.type || "",
        brand: initialData.brand || "",
        size: initialData.size || "",
        unit: initialData.unit || "mL",
        quantity: initialData.quantity?.toString() || "",
        condition: initialData.condition || "Good",
        location: initialData.location || "",
        notes: initialData.notes || "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (
            !formData.name.trim() ||
            !formData.type.trim() ||
            !formData.size.trim() ||
            !formData.unit.trim() ||
            !formData.quantity.trim() ||
            !formData.condition.trim() ||
            !formData.location.trim()
        ) {
            toast.error("Please fill in all mandatory fields.");
            return;
        }

        const quantityNum = parseInt(formData.quantity, 10);
        if (isNaN(quantityNum) || quantityNum < 0) {
            toast.error("Quantity must be a valid positive number.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await editUserGlassware(initialData.id, { ...formData, quantity: quantityNum });
            if (res.success) {
                toast.success("Private Glassware Updated!");
                router.push("/glassware");
            } else {
                toast.error(res.message || "Failed to update glassware");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/glassware"
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Beaker className="h-6 w-6 text-amber-400" />
                        Edit Private Glassware
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        Keep your private glassware information updated.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 space-y-6 shadow-xl">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Item Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                            placeholder="e.g. Griffin Low-Form Beaker"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Type *</label>
                        <select
                            required
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all appearance-none"
                        >
                            <option value="">Select Type...</option>
                            <option value="Beaker">Beaker</option>
                            <option value="Erlenmeyer Flask">Erlenmeyer Flask</option>
                            <option value="Volumetric Flask">Volumetric Flask</option>
                            <option value="Measuring Cylinder">Measuring Cylinder</option>
                            <option value="Test Tube">Test Tube</option>
                            <option value="Pipette">Pipette</option>
                            <option value="Burette">Burette</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Brand (Optional)</label>
                        <input
                            type="text"
                            value={formData.brand}
                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                            placeholder="e.g. Pyrex, Schott Duran"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Size (Capacity) *</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="any"
                            value={formData.size}
                            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                            placeholder="e.g. 250"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Unit *</label>
                        <select
                            required
                            value={formData.unit}
                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all appearance-none"
                        >
                            <option value="mL">mL</option>
                            <option value="L">L</option>
                            <option value="uL">µL</option>
                            <option value="mm">mm</option>
                            <option value="cm">cm</option>
                            <option value="pcs">pcs</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Total Quantity Owned *</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="1"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                            placeholder="Current countable amount"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Condition *</label>
                        <select
                            required
                            value={formData.condition}
                            onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all appearance-none"
                        >
                            <option value="New">New</option>
                            <option value="Good">Good</option>
                            <option value="Used/Worn">Used / Worn</option>
                            <option value="Chipped/Damaged">Chipped / Damaged</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Storage Location *</label>
                    <input
                        type="text"
                        required
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                        placeholder="e.g. Center Island, Cabinet B, Drawer 3"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Additional Notes (Optional)</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all resize-none"
                        placeholder="Any special handling instructions... this will be visible to others."
                    />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-700/50">
                    <Link
                        href="/glassware"
                        className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-5 w-5" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

