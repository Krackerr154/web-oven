"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addUserChemical, fetchPubChemSynonyms } from "@/app/actions/reagents";
import { FlaskConical, Save, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useDebounce } from "use-debounce";
import CustomMonthPicker from "@/components/custom-month-picker";

export default function AddUserChemicalClient() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        customId: "",
        name: "",
        brand: "",
        catalogNo: "",
        arrivalDate: "",
        size: "",
        unit: "mL",
        condition: "unopened",
        location: "",
        notes: "",
        synonyms: "",
    });
    const [isFetchingSynonyms, setIsFetchingSynonyms] = useState(false);
    const [debouncedName] = useDebounce(formData.name, 800);

    // Auto-fetch synonyms when name changes
    useEffect(() => {
        if (!debouncedName.trim()) {
            setFormData(prev => ({ ...prev, synonyms: "" }));
            return;
        }

        let isMounted = true;
        const fetchSynonyms = async () => {
            setIsFetchingSynonyms(true);
            try {
                const synonyms = await fetchPubChemSynonyms(debouncedName);
                if (isMounted && synonyms) {
                    setFormData(prev => ({ ...prev, synonyms }));
                }
            } finally {
                if (isMounted) setIsFetchingSynonyms(false);
            }
        };

        fetchSynonyms();

        return () => {
            isMounted = false;
        };
    }, [debouncedName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.size.trim()) {
            toast.error("Name and Size are required");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await addUserChemical(formData);
            if (res.success) {
                toast.success("Personal Chemical Added!");
                router.push("/reagents"); // Go back to inventory search
                router.refresh();
            } else {
                toast.error(res.message || "Failed to add chemical");
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
                    href="/reagents"
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FlaskConical className="h-6 w-6 text-emerald-400" />
                        Add Personal Chemical
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        Chemicals added here are tracked as yours. Other users must contact you to borrow them.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 space-y-6 shadow-xl">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Identifier</label>
                        <input
                            type="text"
                            value={formData.customId}
                            onChange={(e) => setFormData({ ...formData, customId: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                            placeholder="e.g. H-OAC_02"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Chemical Name (Nama) *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                            placeholder="e.g. acetic acid (glacial) 100%"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Brand (Merk)</label>
                        <select
                            value={formData.brand}
                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all appearance-none"
                        >
                            <option value="">Select Brand...</option>
                            <option value="sigma-aldrich">sigma-aldrich</option>
                            <option value="supelco">supelco</option>
                            <option value="smart-lab">smart-lab</option>
                            <option value="merck">merck</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Arrival Date (Waktu kedatangan)</label>
                        <CustomMonthPicker
                            value={formData.arrivalDate}
                            onChange={(val) => setFormData({ ...formData, arrivalDate: val })}
                            placeholder="Select Month / Year"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Condition (Keterangan)</label>
                        <select
                            value={formData.condition}
                            onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all appearance-none"
                        >
                            <option value="unopened">unopened</option>
                            <option value="unsealed">unsealed</option>
                            <option value="empty">empty</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Size (Ukuran) *</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="any"
                            value={formData.size}
                            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                            placeholder="e.g. 2500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Unit (Satuan)</label>
                        <select
                            value={formData.unit}
                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all appearance-none"
                        >
                            <option value="mL">mL</option>
                            <option value="L">L</option>
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="mg">mg</option>
                            <option value="pcs">pcs</option>
                            <option value="box">box</option>
                        </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-slate-300">Your Storage Location (Posisi)</label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                            placeholder="e.g. My Desk, User Fridge"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Additional Notes</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all resize-none"
                        placeholder="Condition, purity, sharing rules..."
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-300">Search Synonyms (Auto-generated)</label>
                        {isFetchingSynonyms && (
                            <span className="text-xs text-emerald-400 flex items-center gap-1.5 animate-pulse">
                                <RefreshCw className="h-3 w-3 animate-spin" /> Fetching from PubChem...
                            </span>
                        )}
                    </div>
                    <textarea
                        value={formData.synonyms}
                        onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
                        rows={2}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all resize-none text-sm"
                        placeholder="Synonyms will appear here automatically. You can edit or add more (comma separated)."
                    />
                    <p className="text-xs text-slate-500">These hidden tags help users find this chemical when they type different names or abbreviations.</p>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        {isSubmitting ? "Saving..." : "Save My Chemical"}
                    </button>
                </div>
            </form>
        </div>
    );
}
