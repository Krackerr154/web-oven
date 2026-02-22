"use client";

import { useState, useEffect, useRef } from "react";
import { createUser } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";

export function AddUserModal() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [supervisors, setSupervisors] = useState<string[]>([""]);
  const firstInputRef = useRef<HTMLInputElement>(null);

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

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Auto-focus first input
  useEffect(() => {
    if (open) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      nim: formData.get("nim") as string,
      supervisors: supervisors.filter(s => s.trim() !== ""),
      password: formData.get("password") as string,
      role: formData.get("role") as string,
    };
    const result = await createUser(data);

    setLoading(false);

    if (result.success) {
      setOpen(false);
      toast.success(result.message);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add User
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
            className="relative bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl animate-toast-in"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 id="add-user-title" className="text-lg font-semibold text-white">Add New User</h2>
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
                  ref={firstInputRef}
                  name="name"
                  type="text"
                  required
                  placeholder="John Doe"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="john@example.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Phone
                </label>
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={10}
                  maxLength={15}
                  placeholder="08123456789"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  NIM (Student Identity Number)
                </label>
                <input
                  name="nim"
                  type="number"
                  required
                  minLength={5}
                  placeholder="Student ID"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>

              <div className="space-y-3 p-4 bg-slate-900/40 rounded-xl border border-slate-700/50">
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
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      placeholder={index === 0 ? "Main Supervisor Name" : "Co-Supervisor Name"}
                    />
                    {supervisors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSupervisor(index)}
                        className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                        title="Remove Supervisor"
                      >
                        <X className="h-5 w-5" />
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

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Role
                </label>
                <select
                  name="role"
                  required
                  defaultValue="USER"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
                <p className="text-xs text-slate-500 mt-1">Min. 8 characters</p>
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
                      Adding...
                    </>
                  ) : (
                    "Add User"
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
