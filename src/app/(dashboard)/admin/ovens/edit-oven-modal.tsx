"use client";

import { useState } from "react";
import { updateOven } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";

type OvenData = {
  id: number;
  name: string;
  type: string;
  description: string | null;
};

export function EditOvenModal({ oven }: { oven: OvenData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateOven(oven.id, formData);

    setLoading(false);

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        title="Edit oven"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Edit {oven.name}</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={oven.name}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Type
                </label>
                <select
                  name="type"
                  required
                  defaultValue={oven.type}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                >
                  <option value="NON_AQUEOUS">Non-Aqueous</option>
                  <option value="AQUEOUS">Aqueous</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={oven.description || ""}
                  placeholder="e.g., Used for drying MOF samples"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
