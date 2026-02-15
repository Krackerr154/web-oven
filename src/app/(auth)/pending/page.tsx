import Link from "next/link";
import { Clock, Flame } from "lucide-react";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 rounded-xl bg-amber-500/20 mb-4">
          <Clock className="h-8 w-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Registration Submitted
        </h1>
        <p className="text-slate-400 mb-6">
          Your account is pending admin approval. You&apos;ll be able to log in once
          an administrator approves your request.
        </p>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-center gap-2 text-amber-300">
            <Flame className="h-5 w-5" />
            <span className="font-medium">Status: Pending Approval</span>
          </div>
        </div>
        <Link
          href="/login"
          className="text-orange-400 hover:text-orange-300 font-medium text-sm"
        >
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
