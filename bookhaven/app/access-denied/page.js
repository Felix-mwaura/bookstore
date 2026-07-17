"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AccessDeniedPage() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); window.location.href = "/"; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 bg-red-50 border-2 border-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>

        <h1 className="text-3xl font-black text-[#1C1917] mb-3">Access Denied</h1>
        <p className="text-stone-500 mb-2">You don't have permission to access this page.</p>
        <p className="text-stone-400 text-sm mb-8">This area is restricted to administrators only. If you believe this is a mistake, please contact the site administrator.</p>

        <div className="bg-stone-100 rounded-2xl px-6 py-4 mb-8 text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-400 font-medium">Error code</span>
            <span className="font-mono font-bold text-stone-600">403 FORBIDDEN</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-400 font-medium">Required role</span>
            <span className="font-mono font-bold text-purple-600">admin</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-400 font-medium">Your role</span>
            <span className="font-mono font-bold text-stone-600">customer</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-stone-200 pt-2.5 mt-1">
            <span className="text-stone-400 font-medium">Redirecting in</span>
            <span className="font-mono font-bold text-[#991B1B]">{countdown}s</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/" className="flex-1 bg-[#1C1917] hover:bg-[#991B1B] text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-95 text-center">
            Go to Home
          </Link>
          <Link href="/login" className="flex-1 border border-stone-200 hover:border-stone-300 text-stone-600 py-3 rounded-xl font-bold text-sm transition text-center">
            Sign In as Admin
          </Link>
        </div>

        <p className="text-xs text-stone-300 mt-6">Book Haven · Admin access is logged and monitored</p>
      </div>
    </div>
  );
}