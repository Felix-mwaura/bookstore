"use client";

import { useEffect } from "react";
import Link from "next/link";

// Anything thrown while rendering the dashboard lands here instead of the
// generic "Application error" screen. The digest is the id that appears in
// the Vercel function logs, so a support request can be traced precisely.
export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error("Admin dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-[#E3DCCB] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-black text-[#1B2A4A] mb-2">The dashboard could not load</h1>
        <p className="text-stone-500 text-sm mb-6">
          You are signed in, but the server could not read the dashboard data.
          This is usually a configuration problem, not something a retry fixes.
        </p>

        {error?.message && (
          <p className="text-left text-xs font-mono bg-stone-50 border border-[#E3DCCB] rounded-xl p-4 mb-4 break-words text-stone-700">
            {error.message}
          </p>
        )}

        {error?.digest && (
          <p className="text-xs text-stone-400 mb-6">
            Reference: <span className="font-mono">{error.digest}</span> — quote this when asking for help.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 bg-[#1B2A4A] hover:bg-[#B5532F] text-white py-3 rounded-xl font-bold text-sm transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex-1 border-2 border-[#E3DCCB] hover:border-stone-300 text-stone-600 py-3 rounded-xl font-bold text-sm transition text-center"
          >
            Back to store
          </Link>
        </div>
      </div>
    </div>
  );
}
