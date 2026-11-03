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
    <div className="flex min-h-[100dvh] items-center justify-center bg-cream px-5 py-16">
      <div className="w-full max-w-[34rem] text-center">
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-error/25 bg-error/5">
          <svg className="h-7 w-7 text-error" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="font-playfair text-title font-bold text-navy">Access denied</h1>
        <p className="mt-3 text-body text-ink">You don&apos;t have permission to access this page.</p>
        <p className="mx-auto mt-2 max-w-[46ch] text-small text-muted">
          This area is restricted to administrators only. If you believe this is a mistake, please contact the
          site administrator.
        </p>

        <dl className="surface mt-8 mb-8 px-5 py-4 text-left sm:px-6">
          <div className="flex items-center justify-between gap-6 py-1.5 text-small">
            <dt className="text-muted">Error code</dt>
            <dd className="font-semibold tabular-nums text-ink">403 Forbidden</dd>
          </div>
          <div className="flex items-center justify-between gap-6 py-1.5 text-small">
            <dt className="text-muted">Required role</dt>
            <dd className="font-semibold text-ink">admin</dd>
          </div>
          <div className="flex items-center justify-between gap-6 py-1.5 text-small">
            <dt className="text-muted">Your role</dt>
            <dd className="font-semibold text-ink">customer</dd>
          </div>
          <div className="mt-1 flex items-center justify-between gap-6 border-t border-line pt-3 text-small">
            <dt className="text-muted">Redirecting in</dt>
            <dd className="font-semibold tabular-nums text-sienna">{countdown}s</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn-primary flex-1">
            Go to home
          </Link>
          <Link href="/login" className="btn-secondary flex-1">
            Sign in as admin
          </Link>
        </div>

        <p className="mt-8 text-micro text-muted">Book Haven · Admin access is logged and monitored</p>
      </div>
    </div>
  );
}
