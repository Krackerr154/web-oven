"use client";

import { useState } from "react";
import { registerUser } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame, Loader2, AlertTriangle } from "lucide-react";
import { SupervisorPicker } from "@/components/supervisor-picker";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Names must come from the department directory. Free text here used to
  // produce strings that never matched ap_supervisors, so a supervisor's
  // name could not be resolved back to a real person with a real NIP.
  const [supervisors, setSupervisors] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // The picker is not a form control, so it has no native `required`.
    if (supervisors.length === 0) {
      setError("Select at least one supervisor from the directory.");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      nim: formData.get("nim") as string,
      supervisors: supervisors.filter(s => s.trim() !== ""),
      password: formData.get("password") as string,
    };
    const result = await registerUser(data);

    setLoading(false);

    if (result.success) {
      if (result.redirectUrl) {
        router.push(result.redirectUrl);
      } else {
        router.push("/pending");
      }
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      {/* Decorative background element for desktop */}
      <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-orange-500/20 mb-4">
            <Flame className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-slate-400 mt-1">Register to start booking</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              placeholder="e.g. Gerald Arya"
            />
          </div>

          <div>
            <label htmlFor="nim" className="block text-sm font-medium text-slate-300 mb-1.5">
              NIM (Student Identity Number)
            </label>
            <input
              id="nim"
              name="nim"
              type="number"
              required
              minLength={5}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              placeholder="Your student ID"
            />
          </div>

          <div className="space-y-3 p-4 bg-slate-900/40 rounded-xl border border-slate-700/50">
            <SupervisorPicker
              multiple
              variant="auth"
              value={supervisors}
              onChange={setSupervisors}
              label="Supervisor(s)"
              placeholder="Choose your supervisor…"
              hint={false}
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              First name selected becomes your main supervisor. You must select at least one.
            </p>
            {supervisors.length === 0 && (
              <p className="text-[11px] text-amber-300/90 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                Pick a supervisor from the directory to continue.
              </p>
            )}

          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              Phone Number
              <span className="text-xs text-slate-500 font-normal">Must start with 62</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              minLength={10}
              maxLength={15}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              placeholder="e.g. 628123456789"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              placeholder="Min. 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-400 hover:text-orange-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
