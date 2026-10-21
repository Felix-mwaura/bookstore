"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useDialog } from "../lib/useDialog";
import AssistantTab from "./assistant-tab";

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    Processing:"bg-amber-50 text-amber-700 border border-amber-200",
    Packed:"bg-sky-50 text-sky-700 border border-sky-200",
    Shipped:"bg-blue-50 text-blue-700 border border-blue-200",
    Delivered:"bg-green-50 text-green-700 border border-green-200",
    Cancelled:"bg-red-50 text-red-700 border border-red-200",
    Pending:"bg-amber-50 text-amber-700 border border-amber-200",
    Paid:"bg-green-50 text-green-700 border border-green-200",
    Refunded:"bg-purple-50 text-purple-700 border border-purple-200",
    Failed:"bg-red-50 text-red-700 border border-red-200",
    Active:"bg-green-50 text-green-700 border border-green-200",
    Suspended:"bg-red-50 text-red-700 border border-red-200",
    admin:"bg-purple-50 text-purple-700 border border-purple-200",
    customer:"bg-stone-50 text-stone-600 border border-[#E3DCCB]",
    "In Stock":"bg-green-50 text-green-700 border border-green-200",
    "Out of Stock":"bg-red-50 text-red-700 border border-red-200",
    "Only 3 left":"bg-amber-50 text-amber-700 border border-amber-200",
    "Only 1 left":"bg-orange-50 text-orange-700 border border-orange-200",
    "Pre-order":"bg-blue-50 text-blue-700 border border-blue-200",
  };
  // The label carries the meaning; the mark and the colour only reinforce it.
  const marks = {
    Processing: "•", Pending: "•", Packed: "▪", Shipped: "→", Delivered: "✓", Cancelled: "×",
    Paid: "✓", Refunded: "↺", Failed: "!", Active: "✓", Suspended: "!",
    admin: "★", customer: "•", "In Stock": "✓", "Out of Stock": "×",
    "Only 3 left": "•", "Only 1 left": "•", "Pre-order": "•",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]||"bg-subtle text-muted border border-line"}`}>
      <span aria-hidden="true" className="text-[11px] leading-none">{marks[status] || "•"}</span>
      {status}
    </span>
  );
}

function Avatar({ name, email, size = "sm" }) {
  const initials = name ? name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase() : (email||"?")[0].toUpperCase();
  const colors = ["bg-blue-500","bg-purple-500","bg-green-500","bg-rose-500","bg-amber-500","bg-teal-500"];
  const color = colors[(initials.charCodeAt(0)||0) % colors.length];
  const sz = size==="sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>{initials}</div>;
}

function Toast({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white min-w-[280px] ${t.type==="error"?"bg-red-600":"bg-[#1B2A4A]"}`}>
          <span>{t.type==="error"?"⚠️":"✓"}</span>
          <span className="flex-1">{t.msg}</span>
          <button onClick={()=>onRemove(t.id)} className="text-white/60 hover:text-white">✕</button>
        </div>
      ))}
    </div>
  );
}

/**
 * Every overlay goes through this wrapper so they all behave the same way:
 * a real role="dialog", a focus trap, Escape to close, and a panel that can
 * never grow taller than the viewport.
 */
function Modal({ open, onClose, labelledBy, className = "", children }) {
  const panelRef = useDialog(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative w-full max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-[#E3DCCB] outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger, loading, confirmLabel="Confirm", loadingLabel="Working…" }) {
  const close = useCallback(() => { if (!loading) onCancel?.(); }, [loading, onCancel]);
  if (!open) return null;
  return (
    <Modal open={open} onClose={close} labelledBy="confirm-title" className="p-6 max-w-sm">
      <div className="w-full">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${danger?"bg-red-50":"bg-amber-50"}`}>
          <svg className={`w-6 h-6 ${danger?"text-red-500":"text-amber-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 id="confirm-title" className="text-lg font-bold text-[#1B2A4A] mb-2 pr-6">{title}</h3>
        <p className="text-stone-500 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} disabled={loading} data-autofocus className={`flex-1 min-h-11 py-2.5 rounded-xl font-bold text-sm text-white transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 ${danger?"bg-red-600 hover:bg-red-700":"bg-[#1B2A4A] hover:bg-[#B5532F]"}`}>
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {loading?loadingLabel:confirmLabel}
          </button>
          <button onClick={onCancel} disabled={loading} className="flex-1 min-h-11 py-2.5 rounded-xl font-bold text-sm border border-[#E3DCCB] text-stone-600 hover:bg-stone-50 transition disabled:opacity-40">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function Skeleton({ className="" }) {
  return <div className={`bg-stone-100 rounded-lg animate-pulse ${className}`}/>;
}

// One small stroke icon per metric, instead of an emoji. Emoji render
// differently on every phone and read as decoration next to a number that
// an operator actually has to trust.
const STAT_PATHS = {
  revenue: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2",
  receipt: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  truck: "M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h10zm0-5h4l3 3v2h-7v-5z",
  package: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  cancel: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  card: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  ban: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  refund: "M9 14l-4-4m0 0l4-4m-4 4h11a4 4 0 010 8h-3",
};

function StatIcon({ name, className = "" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={STAT_PATHS[name] || STAT_PATHS.book} />
    </svg>
  );
}

/**
 * A metric tile. `onClick` turns it into a button that opens the matching
 * slice of the order list — a count an operator cannot act on is just trivia.
 */
function StatCard({ icon, label, value, delta, deltaUp, sub, accent, onClick }) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      className={`tilt-card group flex h-full flex-col rounded-card border p-4 text-left transition-colors ${
        accent ? "border-navy bg-navy" : "border-line bg-white"
      } ${onClick ? "hover:border-navy" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${accent ? "text-white/70" : "text-muted"}`}>
          {label}
        </p>
        <StatIcon name={icon} className={`h-4 w-4 shrink-0 ${accent ? "text-[#E9B79F]" : "text-stone-300"}`} />
      </div>

      <p className={`mt-2 text-2xl font-black leading-none ${accent ? "text-white" : "text-navy"}`}>{value}</p>

      <div className="mt-1.5 flex min-h-[1rem] items-end justify-between gap-2">
        <div>
          {sub && <p className={`text-[11px] leading-snug ${accent ? "text-white/70" : "text-muted"}`}>{sub}</p>}
          {delta && (
            <p className={`text-[11px] font-semibold ${deltaUp ? "text-success" : "text-error"}`}>{delta}</p>
          )}
        </div>
        {onClick && (
          <svg
            className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${accent ? "text-white/70" : "text-muted"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </Tag>
  );
}

/** A named group of metrics. Three bands beat twelve equal tiles. */
function StatBand({ title, description, columns = "sm:grid-cols-4", children }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">{title}</h2>
        {description && <p className="text-[11px] text-muted">{description}</p>}
      </div>
      <div className={`stat-grid grid grid-cols-2 gap-3 ${columns}`}>{children}</div>
    </section>
  );
}

function MiniChart({ data, color="#B5532F" }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((v,i) => (
        <div key={i} className="flex-1 rounded-t-sm transition-all"
          style={{ height:`${(v/max)*100}%`, backgroundColor:color, opacity:i===data.length-1?1:0.4 }}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────
// Sidebar icons, drawn in one stroke style. Emoji were readable but rendered
// differently on every device and read as decoration next to a 13px label.
const NAV_ICONS = {
  dashboard: "M4 5h6v6H4V5zm10 0h6v10h-6V5zM4 15h6v4H4v-4zm10 4h6v2h-6v-2z",
  assistant: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  orders: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  products: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  customers: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3",
  payments: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  reports: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  inventory: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  reviews: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  coupons: "M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z",
  users: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  activity: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  notifications: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

function NavIcon({ name, className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={NAV_ICONS[name] || NAV_ICONS.dashboard} />
    </svg>
  );
}

const NAV = [
  { section:"Main" },
  { id:"overview", label:"Dashboard", icon:"dashboard" },
  { id:"assistant", label:"Assistant", icon:"assistant" },
  { id:"orders", label:"Orders", icon:"orders", badge:true },
  { id:"books", label:"Products", icon:"products" },
  { id:"customers", label:"Customers", icon:"customers" },
  { section:"Finance" },
  { id:"payments", label:"Payments", icon:"payments" },
  { id:"reports", label:"Reports", icon:"reports" },
  { section:"Store" },
  { id:"inventory", label:"Inventory", icon:"inventory" },
  { id:"reviews", label:"Reviews", icon:"reviews" },
  { id:"coupons", label:"Coupons", icon:"coupons" },
  { section:"System" },
  { id:"users", label:"Users & Roles", icon:"users" },
  { id:"activity", label:"Activity Logs", icon:"activity" },
  { id:"notifications", label:"Emails", icon:"notifications" },
  { id:"settings", label:"Settings", icon:"settings" },
];

function Sidebar({ activeTab, setTab, collapsed, setCollapsed, pendingCount }) {
  return (
    <aside className={`hidden lg:flex flex-col border-r border-line bg-white transition-all duration-200 flex-shrink-0 ${collapsed?"w-[56px]":"w-[240px]"}`}>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-3.5 border-b border-[#E3DCCB] flex-shrink-0">
        <div className="book-badge-3d w-7 h-7 rounded-lg bg-navy flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="font-playfair text-sm font-bold text-white">B</span>
        </div>
        {!collapsed && <span className="font-black text-sm text-[#1B2A4A] tracking-tight whitespace-nowrap">Book Haven</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item, i) => {
          if (item.section) return !collapsed ? (
            <p key={i} className="px-2 pt-4 pb-1 text-[10px] font-bold text-muted uppercase tracking-widest">{item.section}</p>
          ) : <div key={i} className="my-2 border-t border-stone-100"/>;

          const isActive = activeTab === item.id;
          return (
            <button key={item.id} onClick={()=>setTab(item.id)}
              className={`relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all ${isActive?"bg-[#1B2A4A] text-white":"text-stone-600 hover:bg-stone-50 hover:text-[#1B2A4A]"}`}
              title={collapsed?item.label:""}>
              <NavIcon name={item.icon} className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : "text-stone-500"}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left font-medium whitespace-nowrap text-[13px]">{item.label}</span>
                  {item.badge && pendingCount > 0 && (
                    <span className="bg-[#B5532F] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{pendingCount}</span>
                  )}
                </>
              )}
              {collapsed && item.badge && pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#B5532F] rounded-full"/>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-[#E3DCCB] p-2 flex-shrink-0">
        <button onClick={()=>setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-500 hover:bg-stone-50 transition text-sm">
          <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${collapsed?"rotate-180":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
          </svg>
          {!collapsed && <span className="text-xs font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────
// TOPBAR
// ─────────────────────────────────────────────────────────
function Topbar({ activeTab, sessionUser, onLogout, onMenu }) {
  const labels = { overview:"Dashboard", assistant:"Assistant", orders:"Orders", books:"Products", customers:"Customers", payments:"Payments", reports:"Reports", inventory:"Inventory", reviews:"Reviews", coupons:"Coupons", users:"Users & Roles", activity:"Activity Logs", settings:"Settings" };
  const meta = sessionUser?.user_metadata || {};
  const displayName = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || sessionUser?.email?.split("@")[0] || "Admin";

  return (
    <header className="h-14 flex items-center gap-2 px-3 sm:px-4 border-b border-line bg-white flex-shrink-0">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open admin menu"
        aria-haspopup="dialog"
        className="lg:hidden w-11 h-11 -ml-1 flex items-center justify-center rounded-lg text-navy hover:bg-subtle transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <p className="lg:hidden text-sm font-semibold text-navy truncate">{labels[activeTab] || activeTab}</p>

      <div className="hidden lg:flex items-center gap-1 text-xs text-muted">
        <span>Book Haven</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        <span className="text-ink font-medium">{labels[activeTab]||activeTab}</span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 ml-auto">
        <Link href="/" className="w-10 h-10 rounded-lg border border-line bg-white flex items-center justify-center text-muted hover:bg-subtle transition" title="View store" aria-label="View store">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </Link>
        <div className="flex items-center gap-2 pl-2 border-l border-line">
          <Avatar name={displayName} email={sessionUser?.email} size="sm"/>
          <div className="hidden sm:block max-w-[9rem]">
            <p className="text-xs font-bold text-navy leading-none truncate">{displayName}</p>
            <p className="text-[10px] text-muted mt-0.5">Administrator</p>
          </div>
          <button onClick={onLogout} className="w-10 h-10 flex items-center justify-center rounded-lg text-muted hover:text-error hover:bg-error/5 transition" title="Sign out" aria-label="Sign out">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────
function OverviewTab({ metrics, loading, error, range, setRange, onRetry, onNavigate }) {
  const RANGES = [
    { id: "today", label: "Today" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "90d", label: "90 days" },
  ];

  const counts = metrics?.counts || {};
  const money = metrics?.money || {};
  const inventory = metrics?.inventory || {};
  const bestSellers = metrics?.best_sellers || [];
  const recent = metrics?.recent_orders || [];
  const daily = metrics?.daily || [];

  const fmt = (n) => `KSh ${Number(n || 0).toLocaleString("en-KE")}`;
  const dailyValues = daily.map((d) => Number(d.revenue) || 0);
  const busiest = dailyValues.reduce((m, v) => Math.max(m, v), 0);

  const payLabel = {
    pending: "Unpaid",
    paid: "Paid",
    failed: "Failed",
    refund_pending: "Refund pending",
    refunded: "Refunded",
  };

  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <p className="text-red-800 font-semibold text-sm mb-1">Could not load dashboard metrics</p>
        <p className="text-red-600 text-xs mb-4">{error}</p>
        <button onClick={onRetry} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-navy">Dashboard</h1>
          <p className="text-muted text-xs mt-0.5">
            Every figure below is computed in the database for the selected period.
          </p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                range === r.id
                  ? "bg-[#1B2A4A] text-white"
                  : "bg-white border border-[#E3DCCB] text-stone-600 hover:border-stone-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Three bands, not twelve equal tiles: what needs doing today, what
          the money did, and what is on the shelf. Every pipeline count opens
          the matching view of the order list. */}
      <StatBand
        title="Today's work"
        description="Each count opens the order list, where you can filter by status."
        columns="sm:grid-cols-3 lg:grid-cols-5"
      >
        <StatCard
          icon="clock"
          label="Awaiting processing"
          value={counts.awaiting_processing ?? 0}
          sub="Pending or processing"
          onClick={() => onNavigate?.("orders")}
        />
        <StatCard
          icon="truck"
          label="Awaiting dispatch"
          value={counts.awaiting_dispatch ?? 0}
          sub="Not yet shipped"
          onClick={() => onNavigate?.("orders")}
        />
        <StatCard
          icon="package"
          label="Shipped"
          value={counts.shipped ?? 0}
          sub="In transit"
          onClick={() => onNavigate?.("orders")}
        />
        <StatCard
          icon="check"
          label="Delivered"
          value={counts.delivered ?? 0}
          delta={
            counts.total_orders
              ? `${Math.round((counts.delivered / counts.total_orders) * 100)}% of orders`
              : ""
          }
          deltaUp
          onClick={() => onNavigate?.("orders")}
        />
        <StatCard
          icon="cancel"
          label="Cancelled"
          value={counts.cancelled ?? 0}
          sub="Never counted as sales"
          onClick={() => onNavigate?.("orders")}
        />
      </StatBand>

      <StatBand
        title="Money"
        description="Paid orders only for net revenue; cancellations and refunds excluded."
      >
        <StatCard
          icon="revenue"
          label="Net revenue"
          value={fmt(money.net_revenue)}
          sub="Paid orders, cancellations excluded"
          accent
        />
        <StatCard
          icon="receipt"
          label="Gross order value"
          value={fmt(money.gross_order_value)}
          sub="All non-cancelled orders, paid or not"
        />
        <StatCard
          icon="card"
          label="Awaiting payment"
          value={fmt(money.pending_value)}
          sub="COD or unpaid orders"
        />
        <StatCard
          icon="refund"
          label="Refunded"
          value={fmt(money.refunded_value)}
          sub="Refund pending or refunded"
        />
      </StatBand>

      <StatBand
        title="Catalogue"
        description="What is on the shelf right now."
        columns="sm:grid-cols-3"
      >
        <StatCard icon="book" label="Titles" value={inventory.titles ?? 0} sub="Active catalogue" onClick={() => onNavigate?.("inventory")} />
        <StatCard
          icon="alert"
          label="Low stock"
          value={inventory.low_stock ?? 0}
          sub="At or below the reorder threshold"
          onClick={() => onNavigate?.("inventory")}
        />
        <StatCard
          icon="ban"
          label="Out of stock"
          value={inventory.out_of_stock ?? 0}
          sub="Customers cannot buy these"
          onClick={() => onNavigate?.("inventory")}
        />
      </StatBand>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E3DCCB] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1B2A4A] text-sm">Net revenue by day</h3>
            <span className="text-xs text-muted">
              {daily.length ? `${daily.length} trading day${daily.length !== 1 ? "s" : ""}` : "No activity"}
            </span>
          </div>
          {dailyValues.length ? (
            <>
              <MiniChart data={dailyValues} color="#B5532F" />
              <div className="flex justify-between mt-2 text-[10px] text-muted">
                <span>{daily[0]?.date}</span>
                <span>{daily[daily.length - 1]?.date}</span>
              </div>
              <p className="text-[10px] text-muted mt-2">
                Peak day: {fmt(busiest)} · only paid, non-cancelled orders count.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted py-8 text-center">
              No orders in this period.
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E3DCCB] p-5">
          <h3 className="font-bold text-[#1B2A4A] text-sm mb-4">Best-selling books</h3>
          <div className="space-y-3">
            {bestSellers.map((b, i) => (
              <div key={b.book_id} className="flex items-center gap-3">
                <span className="text-xs text-muted w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#1B2A4A] truncate">{b.title}</p>
                  <p className="text-[10px] text-muted">{fmt(b.revenue)}</p>
                </div>
                <span className="text-xs font-bold text-[#1B2A4A]">{b.units} sold</span>
              </div>
            ))}
            {bestSellers.length === 0 && (
              <p className="text-xs text-muted text-center py-4">
                Nothing delivered in this period yet.
              </p>
            )}
          </div>
          <p className="text-[10px] text-muted mt-4 pt-3 border-t border-stone-100">
            Counted from delivered orders only, so an unfulfilled order cannot inflate this list.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E3DCCB] overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-[#1B2A4A] text-sm">Recent orders</h3>
            <button onClick={() => onNavigate?.("orders")} className="text-xs font-semibold text-[#B5532F] hover:underline">
              View all
            </button>
          </div>
          {/* Six columns do not fit a phone; the same rows are shown as a
              list there, and the full table from lg up. */}
          <ul className="divide-y divide-stone-50 lg:hidden">
            {recent.map((o) => (
              <li key={o.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-sienna">{String(o.id).slice(0, 8).toUpperCase()}</span>
                  <span className="text-xs font-bold text-navy">{fmt(o.total)}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink">{o.first_name} {o.last_name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge status={o.status} />
                  <span className={`text-[10px] font-semibold ${o.payment_status === "paid" ? "text-success" : o.payment_status === "failed" ? "text-error" : "text-[#8A5A15]"}`}>
                    {payLabel[o.payment_status] || o.payment_status}
                  </span>
                  <span className="text-[10px] text-muted">
                    {new Date(o.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-muted">No orders in this period</li>
            )}
          </ul>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {["Order", "Customer", "Total", "Payment", "Fulfilment", "Date"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {recent.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#B5532F]">
                      {String(o.id).slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#1B2A4A]">
                      {o.first_name} {o.last_name}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-[#1B2A4A]">
                      {fmt(o.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold ${o.payment_status === "paid" ? "text-green-600" : o.payment_status === "failed" ? "text-red-600" : "text-amber-600"}`}>
                        {payLabel[o.payment_status] || o.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge status={o.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">
                      No orders in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E3DCCB] p-5">
          <h3 className="font-bold text-[#1B2A4A] text-sm mb-4">Needs attention</h3>
          <div className="space-y-3">
            {(counts.awaiting_dispatch ?? 0) > 0 && (
              <button onClick={() => onNavigate?.("orders")} className="w-full text-left flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 transition">
                <span className="text-base">🚚</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">{counts.awaiting_dispatch} order{counts.awaiting_dispatch !== 1 ? "s" : ""} waiting to ship</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">Pack and dispatch them</p>
                </div>
              </button>
            )}
            {(inventory.low_stock ?? 0) > 0 && (
              <button onClick={() => onNavigate?.("inventory")} className="w-full text-left flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 transition">
                <span className="text-base">📉</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">{inventory.low_stock} title{inventory.low_stock !== 1 ? "s" : ""} low on stock</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">Review the inventory tab</p>
                </div>
              </button>
            )}
            {(inventory.out_of_stock ?? 0) > 0 && (
              <button onClick={() => onNavigate?.("inventory")} className="w-full text-left flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition">
                <span className="text-base">🚫</span>
                <div>
                  <p className="text-xs font-bold text-red-800">{inventory.out_of_stock} title{inventory.out_of_stock !== 1 ? "s" : ""} out of stock</p>
                  <p className="text-[10px] text-red-600 mt-0.5">Customers cannot buy these</p>
                </div>
              </button>
            )}
            {(counts.awaiting_dispatch ?? 0) === 0 && (inventory.low_stock ?? 0) === 0 && (inventory.out_of_stock ?? 0) === 0 && (
              <p className="text-xs text-muted text-center py-4">Nothing needs attention right now</p>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">How these are counted</h4>
            <ul className="text-[10px] text-stone-500 space-y-1 list-disc pl-4">
              <li>Net revenue: paid orders only, cancellations and refunds excluded.</li>
              <li>Gross order value: every non-cancelled order, paid or not.</li>
              <li>Delivered and cancelled are final states.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ORDERS TAB
// ─────────────────────────────────────────────────────────
function OrdersTab({ orders, books, onReload, showToast }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updating, setUpdating] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [courier, setCourier] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const perPage = 8;

  // Transitions, mirroring set_order_status() in Postgres exactly. The UI
  // never offers a move the database would reject.
  const STATUS_FLOW = {
    Pending: ["Processing", "Cancelled"],
    Processing: ["Packed", "Shipped", "Cancelled"],
    Packed: ["Shipped", "Cancelled"],
    Shipped: ["Delivered", "Cancelled"],
    Delivered: [],
    Cancelled: [],
  };

  // Payment is a separate machine: refunds are not fulfilment states.
  const PAYMENT_FLOW = {
    pending: ["paid", "failed"],
    failed: ["paid", "pending"],
    paid: ["refund_pending", "refunded"],
    refund_pending: ["refunded", "paid"],
    refunded: [],
  };

  const PAYMENT_LABEL = {
    pending: "Unpaid",
    paid: "Paid",
    failed: "Payment failed",
    refund_pending: "Refund pending",
    refunded: "Refunded",
  };

  const bookById = new Map((books || []).map((b) => [String(b.id), b]));

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const name = `${o.delivery_details?.firstName || ""} ${o.delivery_details?.lastName || ""}`.toLowerCase();
    const ms = statusFilter === "All" || o.status === statusFilter;
    const mq =
      !search ||
      o.id.toLowerCase().includes(q) ||
      name.includes(q) ||
      (o.delivery_details?.city || "").toLowerCase().includes(q) ||
      (o.delivery_details?.phone || "").includes(q);
    return ms && mq;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  async function callAdmin(path, options) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session has expired — please sign in again.");
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${session.access_token}`,
        ...(options?.headers || {}),
      },
    });
    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error(`Server returned an unreadable response (${res.status})`);
    }
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  }

  const updateStatus = async (orderId, newStatus, extra = {}) => {
    setUpdating(orderId);
    try {
      await callAdmin("/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify({ id: orderId, status: newStatus, ...extra }),
      });
      showToast(newStatus === "Cancelled" ? `Order ${orderId.slice(0, 8).toUpperCase()} cancelled` : `Order updated to ${newStatus}`);
      await onReload?.();
    } catch (err) {
      showToast("Failed to update order: " + err.message, "error");
    } finally {
      setUpdating(null);
    }
  };

  const updatePayment = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await callAdmin("/api/admin/orders/payment", {
        method: "PATCH",
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      showToast(`Payment marked ${PAYMENT_LABEL[newStatus]?.toLowerCase() || newStatus}`);
      await onReload?.();
    } catch (err) {
      showToast("Failed to update payment: " + err.message, "error");
    } finally {
      setUpdating(null);
    }
  };

  const toggleSelected = (id) => {
    setBulkResult(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pageIds = paginated.map((o) => o.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const toggleAllOnPage = () => {
    setBulkResult(null);
    setSelected((prev) =>
      allOnPageSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds]))
    );
  };

  // A batch may only be sent to a status every selected order can reach.
  const selectedOrders = orders.filter((o) => selected.includes(o.id));
  const sharedTargets = selectedOrders.length
    ? Object.keys(STATUS_FLOW).filter((target) =>
        selectedOrders.every((o) => (STATUS_FLOW[o.status] || []).includes(target))
      )
    : [];

  // Derived, not stored: when the selection changes the previously chosen
  // target may no longer be valid, so fall back without an extra render pass.
  const effectiveBulkStatus = sharedTargets.includes(bulkStatus)
    ? bulkStatus
    : sharedTargets.length === 1
    ? sharedTargets[0]
    : "";

  const runBulk = async () => {
    if (!effectiveBulkStatus || selected.length === 0) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const json = await callAdmin("/api/admin/orders/bulk", {
        method: "POST",
        body: JSON.stringify({
          ids: selected,
          status: effectiveBulkStatus,
          courier: effectiveBulkStatus === "Shipped" ? courier || null : null,
        }),
      });
      setBulkResult(json);
      const okCount = json.succeeded?.length || 0;
      const failCount = json.failed?.length || 0;
      if (failCount === 0) {
        showToast(`${okCount} order${okCount !== 1 ? "s" : ""} updated to ${effectiveBulkStatus}`);
        setSelected([]);
      } else {
        showToast(`${okCount} updated, ${failCount} failed — see the details below`, "error");
      }
      await onReload?.();
    } catch (err) {
      showToast("Batch failed: " + err.message, "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const isTerminal = (status) => status === "Delivered" || status === "Cancelled";

  return (
    <div>
      <ConfirmDialog
        open={!!confirm}
        title="Cancel order?"
        message="This will mark the order as cancelled and return the books to stock. Cancelling is final — the order cannot be reopened."
        danger
        loading={!!confirm && updating === confirm.orderId}
        confirmLabel="Cancel Order"
        loadingLabel="Cancelling…"
        onConfirm={async () => { await updateStatus(confirm.orderId, "Cancelled"); setConfirm(null); }}
        onCancel={() => setConfirm(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg font-bold text-navy">Orders</h1>
          <p className="text-muted text-xs mt-0.5">
            {orders.length} total · {orders.filter((o) => o.status === "Delivered").length} delivered ·{" "}
            {orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + (o.total || 0), 0).toLocaleString()} KSh ordered
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search orders…"
              className="bg-white border border-[#E3DCCB] rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#1B2A4A] transition w-56"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {["All", "Pending", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === s ? "bg-[#1B2A4A] text-white" : "bg-white border border-[#E3DCCB] text-stone-600 hover:border-stone-300"
            }`}
          >
            {s} <span className="opacity-60 ml-0.5">({s === "All" ? orders.length : orders.filter((o) => o.status === s).length})</span>
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="mb-4 bg-[#1B2A4A] text-white rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold">{selected.length} selected</p>

            {sharedTargets.length === 0 ? (
              <p className="text-xs text-amber-300">
                These orders have no common next step — narrow the selection.
              </p>
            ) : (
              <>
                <select
                  value={effectiveBulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="text-xs bg-white/10 border border-white/20 rounded-lg px-3 py-2 outline-none"
                >
                  <option value="" className="text-black">Choose status…</option>
                  {sharedTargets.map((s) => (
                    <option key={s} value={s} className="text-black">{s}</option>
                  ))}
                </select>

                {effectiveBulkStatus === "Shipped" && (
                  <input
                    value={courier}
                    onChange={(e) => setCourier(e.target.value)}
                    placeholder="Courier (optional)"
                    maxLength={80}
                    className="text-xs bg-white/10 border border-white/20 rounded-lg px-3 py-2 outline-none placeholder:text-white/40 w-40"
                  />
                )}

                <button
                  onClick={runBulk}
                  disabled={bulkBusy || !effectiveBulkStatus}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-[#1B2A4A] text-xs font-bold px-4 py-2 rounded-lg transition"
                >
                  {bulkBusy ? "Applying…" : `Apply to ${selected.length}`}
                </button>
              </>
            )}

            <button
              onClick={() => { setSelected([]); setBulkResult(null); }}
              className="text-xs text-white/60 hover:text-white underline ml-auto"
            >
              Clear
            </button>
          </div>

          {bulkResult && (
            <div className="mt-3 text-xs space-y-1">
              <p className="text-green-300">
                {bulkResult.succeeded?.length || 0} of {bulkResult.requested} updated.
              </p>
              {(bulkResult.failed || []).map((f) => (
                <p key={f.id} className="text-red-300">
                  {String(f.id).slice(0, 8).toUpperCase()} — {f.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E3DCCB] overflow-hidden">
        {/* Phones: a card per order. The table below needs ten columns and is
            unusable at 360px, so the same data is laid out as a card with the
            full detail panel one tap away. */}
        <ul role="list" className="lg:hidden divide-y divide-stone-100">
          {paginated.map((o) => {
            const payFlow = PAYMENT_FLOW[o.payment_status] || [];
            const isOpen = expanded === o.id;
            return (
              <li key={o.id} className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={() => toggleSelected(o.id)}
                    aria-label={`Select order ${o.id.slice(0, 8)}`}
                    className="mt-1 h-4 w-4 rounded border-stone-300"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-sienna">{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="mt-1 text-sm font-semibold text-navy truncate">
                      {o.delivery_details?.firstName} {o.delivery_details?.lastName}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {o.delivery_details?.phone}
                      {o.delivery_details?.city ? ` · ${o.delivery_details.city}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-navy">KSh {(o.total || 0).toLocaleString()}</p>
                    <p className={`mt-1 text-[10px] font-semibold ${o.payment_status === "paid" ? "text-success" : o.payment_status === "failed" ? "text-error" : "text-[#8A5A15]"}`}>
                      {PAYMENT_LABEL[o.payment_status] || o.payment_status}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge status={o.status} />
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                    disabled={updating === o.id || isTerminal(o.status)}
                    aria-label={`Fulfilment status for order ${o.id.slice(0, 8)}`}
                    className="min-h-11 text-xs bg-white border border-line rounded-control px-2 outline-none focus:border-navy disabled:opacity-50"
                  >
                    <option value={o.status}>{o.status}</option>
                    {(STATUS_FLOW[o.status] || []).map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    aria-expanded={isOpen}
                    aria-controls={`order-details-${o.id}`}
                    className="ml-auto min-h-11 px-2 text-xs font-semibold text-sienna underline underline-offset-2"
                  >
                    {isOpen ? "Hide details" : "Details"}
                  </button>
                </div>

                {isOpen && (
                  <div id={`order-details-${o.id}`} className="mt-3 rounded-card border border-line bg-stone-50 p-3 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Items</p>
                    <ul className="space-y-2">
                      {(o.items || []).map((item, i) => {
                        const book = bookById.get(String(item.id));
                        return (
                          <li key={i} className="flex items-center gap-2">
                            <div className="w-8 h-11 rounded bg-stone-200 overflow-hidden shrink-0">
                              {book?.cover_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-navy truncate">{item.title}</p>
                              <p className="text-[10px] text-muted">Qty {item.quantity || 1} × KSh {(item.price || 0).toLocaleString()}</p>
                            </div>
                            <p className="font-bold text-navy">KSh {((item.price || 0) * (item.quantity || 1)).toLocaleString()}</p>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-3 border-t border-line pt-2 space-y-0.5 text-muted">
                      <p className="font-semibold text-navy">Delivery</p>
                      <p>{o.delivery_details?.address}</p>
                      <p>{o.delivery_details?.city}</p>
                      {(o.delivery_details?.instructions || o.delivery_details?.notes) && (
                        <p className="italic">“{o.delivery_details.instructions || o.delivery_details.notes}”</p>
                      )}
                    </div>

                    <div className="mt-3 border-t border-line pt-2 space-y-0.5 text-muted">
                      <p>Subtotal <span className="float-right font-semibold text-navy">KSh {(o.subtotal ?? 0).toLocaleString()}</span></p>
                      <p>Delivery <span className="float-right font-semibold text-navy">{Number(o.delivery_fee) > 0 ? `KSh ${Number(o.delivery_fee).toLocaleString()}` : "Free"}</span></p>
                      <p>Total <span className="float-right font-bold text-navy">KSh {(o.total ?? 0).toLocaleString()}</span></p>
                      {o.payment_ref && <p>Receipt <span className="float-right font-mono">{o.payment_ref}</span></p>}
                      {o.courier && <p>Courier <span className="float-right">{o.courier}</span></p>}
                    </div>

                    {payFlow.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {payFlow.map((st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={updating === o.id}
                            onClick={() => updatePayment(o.id, st)}
                            className="min-h-11 px-3 rounded-control border border-line bg-white text-[11px] font-semibold text-ink disabled:opacity-40"
                          >
                            {st === "paid" ? "Mark paid" : st === "failed" ? "Mark failed" : st === "refund_pending" ? "Start refund" : st === "refunded" ? "Mark refunded" : "Reset to unpaid"}
                          </button>
                        ))}
                      </div>
                    )}

                    {!isTerminal(o.status) && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ orderId: o.id })}
                        className="mt-3 w-full min-h-11 rounded-control border border-error/30 text-xs font-bold text-error hover:bg-error/5"
                      >
                        Cancel this order
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {paginated.length === 0 && (
            <li className="px-4 py-12 text-center">
              <p className="text-sm text-muted">No orders match this view.</p>
            </li>
          )}
        </ul>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all orders on this page"
                    className="rounded border-stone-300"
                  />
                </th>
                {["", "Order ID", "Customer", "Address", "Books", "Total", "Payment", "Fulfilment", "Date", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {paginated.map((o) => {
                const payFlow = PAYMENT_FLOW[o.payment_status] || [];
                return (
                  <Fragment key={o.id}>
                    <tr className={`transition-colors ${selected.includes(o.id) ? "bg-amber-50/50" : "hover:bg-stone-50/50"}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(o.id)}
                          onChange={() => toggleSelected(o.id)}
                          aria-label={`Select order ${o.id.slice(0, 8)}`}
                          className="rounded border-stone-300"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="text-muted hover:text-[#1B2A4A] transition" aria-label="Toggle order details">
                          <svg className={`w-4 h-4 transition-transform ${expanded === o.id ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-[#B5532F]">{o.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={`${o.delivery_details?.firstName || ""} ${o.delivery_details?.lastName || ""}`} email="" size="sm" />
                          <div>
                            <p className="text-xs font-semibold text-[#1B2A4A]">{o.delivery_details?.firstName} {o.delivery_details?.lastName}</p>
                            <p className="text-[10px] text-muted">{o.delivery_details?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs text-stone-600 max-w-[120px] truncate">{o.delivery_details?.address}</p>
                        <p className="text-[10px] text-muted">{o.delivery_details?.city}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-stone-500">{(o.items || []).length} book{(o.items || []).length !== 1 ? "s" : ""}</td>
                      <td className="px-3 py-3 text-xs font-bold text-[#1B2A4A]">KSh {(o.total || 0).toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <p className={`text-[10px] font-semibold ${o.payment_status === "paid" ? "text-green-600" : o.payment_status === "failed" ? "text-red-600" : o.payment_status === "refunded" ? "text-purple-600" : "text-amber-600"}`}>
                          {PAYMENT_LABEL[o.payment_status] || o.payment_status}
                        </p>
                        <p className="text-[10px] text-muted">{o.payment_method}</p>
                      </td>
                      <td className="px-3 py-3"><Badge status={o.status} /></td>
                      <td className="px-3 py-3 text-[10px] text-muted whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <select
                            value={o.status}
                            onChange={(e) => updateStatus(o.id, e.target.value, e.target.value === "Shipped" && courier ? { courier } : {})}
                            disabled={updating === o.id || isTerminal(o.status)}
                            title={isTerminal(o.status) ? "Delivered and cancelled orders are final" : "Change fulfilment status"}
                            className="text-xs bg-stone-50 border border-[#E3DCCB] rounded-lg px-2 py-1 outline-none focus:border-[#B5532F] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <option value={o.status}>{o.status}</option>
                            {(STATUS_FLOW[o.status] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </td>
                    </tr>

                    {expanded === o.id && (
                      <tr key={`${o.id}-exp`}>
                        <td colSpan={11} className="px-5 py-5 bg-stone-50 border-t border-stone-100">
                          <div className="grid lg:grid-cols-3 gap-5">
                            <div className="lg:col-span-2">
                              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Items</p>
                              <div className="space-y-2">
                                {(o.items || []).map((item, i) => {
                                  const book = bookById.get(String(item.id));
                                  return (
                                    <div key={i} className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center gap-3">
                                      <div className="w-10 h-14 rounded-md bg-stone-100 overflow-hidden flex-shrink-0">
                                        {book?.cover_url && (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-[#1B2A4A] truncate">{item.title}</p>
                                        <p className="text-[10px] text-muted">
                                          {item.author} · Qty {item.quantity || 1} × KSh {(item.price || 0).toLocaleString()}
                                        </p>
                                      </div>
                                      <p className="text-xs font-bold text-[#1B2A4A]">
                                        KSh {((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs">
                                <div className="bg-white rounded-xl border border-stone-100 p-4">
                                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Delivery</p>
                                  <p className="text-stone-700 font-semibold">{o.delivery_details?.firstName} {o.delivery_details?.lastName}</p>
                                  <p className="text-stone-500">{o.delivery_details?.phone}</p>
                                  <p className="text-stone-500">{o.delivery_details?.address}</p>
                                  <p className="text-stone-500">{o.delivery_details?.city}</p>
                                  {(o.delivery_details?.instructions || o.delivery_details?.notes) && (
                                    <p className="text-stone-500 mt-1 italic">
                                      “{o.delivery_details.instructions || o.delivery_details.notes}”
                                    </p>
                                  )}
                                </div>
                                <div className="bg-white rounded-xl border border-stone-100 p-4">
                                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Money & dispatch</p>
                                  <p className="text-stone-500">Subtotal: <span className="font-semibold text-[#1B2A4A]">KSh {(o.subtotal ?? 0).toLocaleString()}</span></p>
                                  <p className="text-stone-500">Delivery: <span className="font-semibold text-[#1B2A4A]">{Number(o.delivery_fee) > 0 ? `KSh ${Number(o.delivery_fee).toLocaleString()}` : "Free"}</span></p>
                                  <p className="text-stone-500">Total: <span className="font-bold text-[#1B2A4A]">KSh {(o.total ?? 0).toLocaleString()}</span></p>
                                  {o.payment_ref && <p className="text-stone-500 mt-1">Receipt: <span className="font-mono font-bold">{o.payment_ref}</span></p>}
                                  {o.courier && <p className="text-stone-500 mt-1">Courier: {o.courier}</p>}
                                  {o.tracking_ref && <p className="text-stone-500">Tracking: <span className="font-mono">{o.tracking_ref}</span></p>}
                                  {o.dispatched_at && <p className="text-muted mt-1 text-[10px]">Dispatched {new Date(o.dispatched_at).toLocaleString("en-KE")}</p>}
                                  {o.delivered_at && <p className="text-muted text-[10px]">Delivered {new Date(o.delivered_at).toLocaleString("en-KE")}</p>}
                                </div>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Payment</p>
                              <div className="bg-white rounded-xl border border-stone-100 p-4">
                                <p className="text-sm font-bold text-[#1B2A4A]">{PAYMENT_LABEL[o.payment_status] || o.payment_status}</p>
                                <p className="text-[10px] text-muted mt-0.5">via {o.payment_method}</p>

                                {payFlow.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {payFlow.map((s) => (
                                      <button
                                        key={s}
                                        disabled={updating === o.id}
                                        onClick={() => updatePayment(o.id, s)}
                                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#E3DCCB] hover:border-stone-300 hover:bg-stone-50 disabled:opacity-40 transition"
                                      >
                                        {s === "paid" ? "Mark paid" : s === "failed" ? "Mark failed" : s === "refund_pending" ? "Start refund" : s === "refunded" ? "Mark refunded" : "Reset to unpaid"}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-muted mt-3">No further payment changes.</p>
                                )}
                                <p className="text-[10px] text-muted mt-3 pt-2 border-t border-stone-100">
                                  A COD order stays unpaid until the courier collects the cash.
                                </p>
                              </div>

                              {!isTerminal(o.status) && (
                                <button
                                  onClick={() => setConfirm({ orderId: o.id })}
                                  className="w-full mt-3 text-xs font-bold text-red-600 border border-red-200 rounded-xl py-2 hover:bg-red-50 transition"
                                >
                                  Cancel this order
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
                    <div className="text-3xl mb-2">📦</div>
                    <p className="text-muted text-sm">No orders found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100">
            <p className="text-xs text-muted">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-[#E3DCCB] rounded-lg disabled:opacity-40 hover:bg-stone-50">Prev</button>
              {[...Array(totalPages)].map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`w-7 h-7 text-xs rounded-lg border transition ${page === i + 1 ? "bg-[#1B2A4A] text-white border-[#1B2A4A]" : "border-[#E3DCCB] hover:bg-stone-50"}`}>{i + 1}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs border border-[#E3DCCB] rounded-lg disabled:opacity-40 hover:bg-stone-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// BOOKS TAB — data comes from AdminClient's shared `books` state (one
// source of truth, also used by Overview and Inventory) instead of its
// own separate fetch.
const COVER_BUCKET = "book-covers";
const MAX_COVER_BYTES = 2 * 1024 * 1024; // matches the bucket's 2 MB limit
const COVER_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Storage path from a public URL, or null if it isn't one of ours.
function coverPathFromUrl(url) {
  const marker = `/storage/v1/object/public/${COVER_BUCKET}/`;
  const i = url ? url.indexOf(marker) : -1;
  return i >= 0 ? url.slice(i + marker.length) : null;
}

function BooksTab({ books, loading, error, onRetry, reloadBooks, showToast }) {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const emptyForm = {title:"",author:"",price:"",original_price:"",category:"Self-Help",format:"Paperback",badge:"",stock_quantity:"0",low_stock_threshold:"5",is_featured:false,description:"",pages:"",publisher:"",year:"",isbn:""};
  const [form, setForm] = useState(emptyForm);
  const [coverFile, setCoverFile] = useState(null);      // newly chosen file, not yet uploaded
  const [coverPreview, setCoverPreview] = useState(null); // blob: preview or the saved cover_url
  const [removeCover, setRemoveCover] = useState(false);
  const [saveStage, setSaveStage] = useState("");

  const categories = ["Self-Help","Finance","Productivity","Psychology","History","Philosophy","Fiction","Biography"];
  const coverMap = {"Self-Help":["#2d4a22","#86efac"],"Finance":["#0f3460","#fbbf24"],"Productivity":["#1b1b2f","#f87171"],"Psychology":["#3b1f5e","#a78bfa"],"History":["#2c1810","#fb923c"],"Philosophy":["#0d0d0d","#f9a8d4"],"Fiction":["#1a3a4a","#67e8f9"],"Biography":["#1c3a5e","#6ee7b7"]};

  // Throws a real Error (with a useful message) instead of ever returning
  // a value that lets the caller pretend the request succeeded.
  async function authedFetch(method, body) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session has expired — please sign in again.");
    const res = await fetch("/api/admin/books", { method, headers:{ "Content-Type":"application/json", authorization:`Bearer ${session.access_token}` }, body: body?JSON.stringify(body):undefined });
    let json;
    try { json = await res.json(); }
    catch { throw new Error(`Server returned an unreadable response (${res.status})`); }
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  }

  const filtered = books
    .filter(b => showArchived ? true : !b.is_archived)
    .filter(b=>b.title.toLowerCase().includes(search.toLowerCase())||b.author.toLowerCase().includes(search.toLowerCase())||b.category.toLowerCase().includes(search.toLowerCase()));

  const resetCover = (url = null) => { setCoverFile(null); setCoverPreview(url); setRemoveCover(false); };
  const openAdd = () => { setEditBook(null); setForm(emptyForm); setFormErrors({}); resetCover(); setShowForm(true); };
  const openEdit = (book) => { setEditBook(book); setForm({title:book.title,author:book.author,price:book.price,original_price:book.original_price||"",category:book.category,format:book.format,badge:book.badge||"",stock_quantity:String(book.stock_quantity ?? 0),low_stock_threshold:String(book.low_stock_threshold ?? 5),is_featured:!!book.is_featured,description:book.description||"",pages:book.pages||"",publisher:book.publisher||"",year:book.year||"",isbn:book.isbn||""}); setFormErrors({}); resetCover(book.cover_url || null); setShowForm(true); };

  function onCoverSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!COVER_TYPES[file.type]) { setFormErrors(p => ({...p, cover: "Use a JPG, PNG or WebP image"})); return; }
    if (file.size > MAX_COVER_BYTES) { setFormErrors(p => ({...p, cover: `Image is ${(file.size/1024/1024).toFixed(1)} MB — the limit is 2 MB`})); return; }
    setFormErrors(p => { const { cover, ...rest } = p; return rest; });
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
  }

  function onCoverRemoved() {
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
  }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.author.trim()) errs.author = "Author is required";
    if (form.price === "" || isNaN(Number(form.price)) || Number(form.price) < 0) errs.price = "Enter a valid, non-negative price";
    if (form.original_price !== "" && (isNaN(Number(form.original_price)) || Number(form.original_price) < 0)) errs.original_price = "Must be a non-negative number";
    if (form.stock_quantity === "" || !Number.isInteger(Number(form.stock_quantity)) || Number(form.stock_quantity) < 0) errs.stock_quantity = "Enter a whole number, 0 or more";
    if (form.pages !== "" && (!Number.isInteger(Number(form.pages)) || Number(form.pages) < 0)) errs.pages = "Must be a whole number";
    if (form.year !== "" && (!Number.isInteger(Number(form.year)) || Number(form.year) < 1000 || Number(form.year) > new Date().getFullYear()+1)) errs.year = "Enter a valid year";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const save = async () => {
    if (!validate()) { showToast("Please fix the highlighted fields", "error"); return; }
    setSaving(true);
    let uploadedPath = null; // file we uploaded in THIS attempt (to clean up on failure)
    try {
      const [bg,accent] = coverMap[form.category]||["#1B2A4A","#B5532F"];
      const payload = {
        title:form.title.trim(), author:form.author.trim(), price:Number(form.price),
        original_price:form.original_price?Number(form.original_price):null,
        category:form.category, format:form.format, badge:form.badge||null,
        stock_quantity: Math.max(0, Number(form.stock_quantity) || 0),
        low_stock_threshold: Math.max(1, Math.round(Number(form.low_stock_threshold)) || 5),
        is_featured: !!form.is_featured,
        description:form.description.trim(), pages:form.pages?Number(form.pages):null,
        publisher:form.publisher.trim(), year:form.year?Number(form.year):null,
        cover:{bg,accent,pattern:"dots"},
        isbn: form.isbn.trim() || null,
      };

      // Image first: if the upload fails we stop here, so no book row is
      // ever created pointing at an image that doesn't exist.
      let cover_url = editBook?.cover_url || null;
      if (coverFile) {
        setSaveStage("Uploading image…");
        const path = `${crypto.randomUUID()}.${COVER_TYPES[coverFile.type]}`;
        const { error: upError } = await supabase.storage.from(COVER_BUCKET)
          .upload(path, coverFile, { contentType: coverFile.type, upsert: false, cacheControl: "3600" });
        if (upError) throw new Error("Image upload failed: " + upError.message);
        uploadedPath = path;
        cover_url = supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
      } else if (removeCover) {
        cover_url = null;
      }
      payload.cover_url = cover_url;

      setSaveStage("Saving…");
      if (editBook) await authedFetch("PATCH", { id: editBook.id, ...payload });
      else await authedFetch("POST", payload);

      // Only now — after the server has confirmed success — do we touch
      // the UI as if the book actually exists in the database.
      // Replaced or removed an image → delete the old file (best effort; a
      // leftover file is harmless, so this never fails the save).
      const oldPath = editBook ? coverPathFromUrl(editBook.cover_url) : null;
      if (oldPath && (coverFile || removeCover)) {
        const { error: rmError } = await supabase.storage.from(COVER_BUCKET).remove([oldPath]);
        if (rmError) console.error("Old cover cleanup failed:", rmError.message);
      }

      showToast(`"${form.title}" ${editBook?"updated":"added to catalogue"}`);
      await reloadBooks();
      setShowForm(false);
    } catch (err) {
      // The database write failed after the image went up — don't leave an
      // orphaned file behind.
      if (uploadedPath) {
        const { error: rmError } = await supabase.storage.from(COVER_BUCKET).remove([uploadedPath]);
        if (rmError) console.error("Cleanup of uploaded cover failed:", rmError.message);
      }
      // Modal stays open, form data stays exactly as the admin left it —
      // no fake success, nothing pretends to have worked.
      showToast((editBook?"Failed to update book: ":"Failed to add book: ")+err.message, "error");
    } finally {
      setSaving(false);
      setSaveStage("");
    }
  };

  const deleteBook = async () => {
    setDeleting(true);
    try {
      const json = await authedFetch("DELETE", { id: deleteConfirm });
      if (json.archived) showToast("This book has order history — archived instead of deleted, so past orders stay intact.");
      else showToast("Book removed");
      await reloadBooks();
      setDeleteConfirm(null);
    } catch (err) {
      showToast("Failed to delete book: "+err.message, "error");
      // Deliberately do NOT clear deleteConfirm here — keep the dialog up
      // so the admin can see the error and retry, instead of it vanishing
      // as if the delete had gone through.
    } finally {
      setDeleting(false);
    }
  };

  // NOTE: F is called as a plain function ({F({...})}), NOT rendered as <F />.
  // A component defined inside BooksTab gets a new identity every render, so React
  // remounts the <input> on each keystroke and focus/cursor is lost.
  const F = ({label,name,type="text",placeholder,full}) => (
    <div className={full?"col-span-2":""}>
      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
      <input type={type} value={form[name]} placeholder={placeholder} onChange={e=>setForm(p=>({...p,[name]:e.target.value}))}
        className={`w-full bg-stone-50 border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 transition ${formErrors[name]?"border-red-400 focus:border-red-500 focus:ring-red-100":"border-[#E3DCCB] focus:border-[#B5532F] focus:ring-[#B5532F]/20"}`}/>
      {formErrors[name] && <p className="text-red-500 text-xs mt-1">{formErrors[name]}</p>}
    </div>
  );

  return (
    <div>
      <ConfirmDialog open={!!deleteConfirm} title="Delete book?" message="If this book has no order history it's removed permanently. If it does, it's archived instead (hidden from the store, order records kept intact)." danger loading={deleting} confirmLabel="Delete" loadingLabel="Deleting…" onConfirm={deleteBook} onCancel={()=>setDeleteConfirm(null)}/>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg font-bold text-navy">Products</h1>
          <p className="text-muted text-xs mt-0.5">{books.filter(b=>!b.is_archived).length} active · {books.filter(b=>b.is_archived).length} archived</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-[#1B2A4A] hover:bg-[#B5532F] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Add book
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-[#E3DCCB] rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#1B2A4A]">{editBook?`Editing: ${editBook.title}`:"Add new book"}</h3>
              <p className="text-xs text-muted mt-0.5">{editBook?"Update the book details below":"Fill in the details for the new title"}</p>
            </div>
            <button onClick={()=>setShowForm(false)} aria-label="Close the book form" className="p-2 hover:bg-stone-100 rounded-full transition text-muted">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {F({label:"Title *",name:"title",placeholder:"Book title",full:true})}
            {F({label:"Author *",name:"author",placeholder:"Author name"})}
            {F({label:"Price (KSh) *",name:"price",type:"number",placeholder:"1299"})}
            {F({label:"Original price (KSh)",name:"original_price",type:"number",placeholder:"Leave blank if no discount"})}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Category</label>
              <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="w-full bg-stone-50 border border-[#E3DCCB] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B5532F] transition">
                {categories.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Format</label>
              <select value={form.format} onChange={e=>setForm(p=>({...p,format:e.target.value}))} className="w-full bg-stone-50 border border-[#E3DCCB] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B5532F] transition">
                {["Paperback","Hardcover","eBook"].map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Badge</label>
              <select value={form.badge} onChange={e=>setForm(p=>({...p,badge:e.target.value}))} className="w-full bg-stone-50 border border-[#E3DCCB] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B5532F] transition">
                <option value="">No badge</option>
                {["Bestseller","New","Trending","Staff Pick","Award Winner","Classic","Top Rated"].map(b=><option key={b}>{b}</option>)}
              </select>
            </div>
            {F({label:"Stock quantity *",name:"stock_quantity",type:"number",placeholder:"20"})}
            {F({label:"Low-stock warning below",name:"low_stock_threshold",type:"number",placeholder:"5"})}
            {F({label:"Pages",name:"pages",type:"number",placeholder:"320"})}
            {F({label:"Publisher",name:"publisher",placeholder:"Publisher name"})}
            {F({label:"Year",name:"year",type:"number",placeholder:"2024"})}
            {F({label:"ISBN",name:"isbn",placeholder:"9780735211292"})}
            <div className="col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Cover image</label>
              <div className="flex items-start gap-4">
                <div className="w-20 flex-shrink-0 rounded-lg overflow-hidden border border-[#E3DCCB] bg-stone-100 flex items-center justify-center text-stone-300 text-2xl" style={{aspectRatio:"2/3"}}>
                  {coverPreview ? <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover"/> : "📖"}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    <label className={`px-4 py-2 rounded-xl text-sm font-semibold border border-[#E3DCCB] bg-white hover:bg-stone-50 cursor-pointer transition ${saving?"opacity-50 pointer-events-none":""}`}>
                      {coverPreview ? "Replace image" : "Choose image"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onCoverSelected} disabled={saving} className="sr-only"/>
                    </label>
                    {coverPreview && (
                      <button type="button" onClick={onCoverRemoved} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition disabled:opacity-50">Remove</button>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-2">JPG, PNG or WebP, up to 2 MB. Without an image the store shows the styled text cover.</p>
                  {formErrors.cover && <p className="text-red-500 text-xs mt-1">{formErrors.cover}</p>}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 mt-6 cursor-pointer">
              <input type="checkbox" checked={form.is_featured} onChange={e=>setForm(p=>({...p,is_featured:e.target.checked}))} className="w-4 h-4 accent-[#B5532F]"/>
              <span className="text-sm text-stone-600">Show in &quot;Recommended&quot; on the homepage</span>
            </label>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Description</label>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3} placeholder="Book description…" className="w-full bg-stone-50 border border-[#E3DCCB] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B5532F] transition resize-none"/>
            </div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-stone-100">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#1B2A4A] hover:bg-[#B5532F] disabled:bg-stone-200 disabled:text-stone-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95">
              {saving?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>{saveStage||"Saving…"}</>:editBook?"Save changes":"Add book"}
            </button>
            <button onClick={()=>setShowForm(false)} className="border border-[#E3DCCB] text-stone-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-50 transition">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search books…"
            className="w-full bg-white border border-[#E3DCCB] rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#B5532F] transition"/>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-500 whitespace-nowrap">
          <input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)} className="w-4 h-4 accent-[#B5532F]"/>
          Show archived
        </label>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-800 font-semibold text-sm mb-1">Failed to load books</p>
          <p className="text-red-600 text-xs mb-4">{error}</p>
          <button onClick={onRetry} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition">Retry</button>
        </div>
      ) : loading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-14"/>)}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E3DCCB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Title</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Category</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Stock</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Featured</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Rating</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(book=>(
                  <tr key={book.id} className={`hover:bg-stone-50/50 transition-colors group ${book.is_archived?"opacity-50":""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {book.cover_url && <img src={book.cover_url} alt="" loading="lazy" className="w-8 h-12 object-cover rounded border border-[#E3DCCB] flex-shrink-0"/>}
                        <div>
                          <p className="text-sm font-semibold text-[#1B2A4A]">{book.title} {book.is_archived && <span className="text-[10px] text-muted font-normal">(archived)</span>}</p>
                          <p className="text-xs text-muted">{book.author}</p>
                          <p className="sm:hidden mt-0.5 text-xs font-bold text-[#1B2A4A]">KSh {book.price.toLocaleString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3"><Badge status={book.category}/></td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <p className="text-xs font-bold text-[#1B2A4A]">KSh {book.price.toLocaleString()}</p>
                      {book.original_price&&<p className="text-[10px] text-muted line-through">KSh {book.original_price.toLocaleString()}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-semibold" style={{color:book.stock_quantity<=0?"#dc2626":book.stock_quantity<=(book.low_stock_threshold||5)?"#d97706":"#16a34a"}}>
                        {book.stock} · {book.stock_quantity ?? 0} units
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">{book.is_featured?<span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md">★ Featured</span>:<span className="text-stone-300 text-xs">—</span>}</td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-amber-400 text-xs">★</span>
                        <span className="text-xs font-semibold text-stone-600">{book.rating}</span>
                        <span className="text-[10px] text-muted">({book.reviews||0})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                        <button onClick={()=>openEdit(book)} className="text-xs text-[#B5532F] font-semibold hover:underline">Edit</button>
                        <button onClick={()=>setDeleteConfirm(book.id)} className="text-xs text-muted hover:text-red-600 font-semibold">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center"><div className="text-3xl mb-2">📚</div><p className="text-muted text-sm">No books found</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// INVENTORY TAB — fast stock adjustments + low-stock triage
// ─────────────────────────────────────────────────────────
function InventoryTab({ books, loading, error, onRetry, reloadBooks, showToast }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);

  const categories = ["All", ...Array.from(new Set(books.map((b) => b.category)))];
  const active = books.filter((b) => !b.is_archived);

  const withStatus = (b) =>
    (b.stock_quantity ?? 0) <= 0
      ? "Out of Stock"
      : (b.stock_quantity ?? 0) <= (b.low_stock_threshold || 5)
      ? "Low Stock"
      : "In Stock";

  const filtered = active.filter((b) => {
    const matchesSearch =
      !search ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || b.category === categoryFilter;
    const matchesStatus = statusFilter === "All" || withStatus(b) === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const outOfStock = active.filter((b) => (b.stock_quantity ?? 0) <= 0);
  const lowStock = active.filter(
    (b) => (b.stock_quantity ?? 0) > 0 && (b.stock_quantity ?? 0) <= (b.low_stock_threshold || 5)
  );

  async function callAdmin(path, options) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session has expired — please sign in again.");
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${session.access_token}`,
        ...(options?.headers || {}),
      },
    });
    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error(`Server returned an unreadable response (${res.status})`);
    }
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  }

  const openAdjust = (book) => {
    setModal({
      book,
      quantity: String(book.stock_quantity ?? 0),
      reason: "restock",
      note: "",
    });
  };

  const submitAdjust = async () => {
    if (!modal) return;
    const qty = Number(modal.quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      showToast("Quantity must be a whole number, 0 or more", "error");
      return;
    }
    if (modal.note.trim().length < 3) {
      showToast("Add a short note explaining the change", "error");
      return;
    }
    setBusy(true);
    try {
      await callAdmin("/api/admin/inventory", {
        method: "POST",
        body: JSON.stringify({
          book_id: modal.book.id,
          quantity: qty,
          reason: modal.reason,
          note: modal.note.trim(),
        }),
      });
      showToast(`${modal.book.title}: stock set to ${qty}`);
      setModal(null);
      await reloadBooks();
      if (history?.book?.id === modal.book.id) openHistory(modal.book);
    } catch (err) {
      showToast("Stock update failed: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  async function openHistory(book) {
    setHistory({ book, rows: [], loading: true });
    try {
      const json = await callAdmin(`/api/admin/inventory?book_id=${book.id}`, { method: "GET" });
      setHistory({ book, rows: json.movements || [], loading: false });
    } catch (err) {
      setHistory({ book, rows: [], loading: false, error: err.message });
    }
  }

  const REASONS = [
    { id: "restock", label: "Restock — new copies received" },
    { id: "correction", label: "Correction — stock count was wrong" },
    { id: "damage", label: "Damage — copies written off" },
    { id: "return", label: "Return — customer sent books back" },
    { id: "manual_adjustment", label: "Other adjustment" },
  ];

  return (
    <div>
      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {lowStock.length > 0 && (
            <button onClick={() => setStatusFilter("Low Stock")} className="text-left bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100 transition">
              <p className="font-bold text-amber-800 text-sm">⚠️ {lowStock.length} book{lowStock.length !== 1 ? "s" : ""} running low on stock</p>
              <p className="text-amber-600 text-xs mt-0.5">Click to view them</p>
            </button>
          )}
          {outOfStock.length > 0 && (
            <button onClick={() => setStatusFilter("Out of Stock")} className="text-left bg-red-50 border border-red-200 rounded-2xl p-4 hover:bg-red-100 transition">
              <p className="font-bold text-red-800 text-sm">🚫 {outOfStock.length} book{outOfStock.length !== 1 ? "s" : ""} out of stock</p>
              <p className="text-red-600 text-xs mt-0.5">Customers cannot buy these</p>
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg font-bold text-navy">Inventory</h1>
          <p className="text-muted text-xs mt-0.5">{active.length} active titles · every change is recorded</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory…"
            className="w-full bg-white border border-[#E3DCCB] rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#B5532F] transition"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white border border-[#E3DCCB] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B5532F] transition"
        >
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="flex gap-2">
          {["All", "In Stock", "Low Stock", "Out of Stock"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === s ? "bg-[#1B2A4A] text-white" : "bg-white border border-[#E3DCCB] text-stone-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-800 font-semibold text-sm mb-1">Failed to load inventory</p>
          <p className="text-red-600 text-xs mb-4">{error}</p>
          <button onClick={onRetry} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition">Retry</button>
        </div>
      ) : loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E3DCCB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Book</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">In stock</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Threshold</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Last updated</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Adjust</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider sr-only">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map((book) => {
                  const status = withStatus(book);
                  const statusColor = status === "Out of Stock" ? "text-red-600" : status === "Low Stock" ? "text-amber-600" : "text-green-600";
                  return (
                    <tr key={book.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#1B2A4A]">{book.title}</p>
                        <p className="text-xs text-muted">{book.author}</p>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-stone-500">{book.category}</td>
                      <td className="px-4 py-3 font-bold text-[#1B2A4A] text-sm whitespace-nowrap">{book.stock_quantity ?? 0}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-stone-500">{book.low_stock_threshold ?? 5}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold ${statusColor}`}>{status}</span></td>
                      <td className="hidden lg:table-cell px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {book.updated_at ? new Date(book.updated_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openAdjust(book)}
                          className="min-h-9 text-xs font-semibold border border-[#E3DCCB] rounded-lg px-3 py-1.5 hover:border-stone-300 hover:bg-stone-50 transition"
                        >
                          Adjust
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openHistory(book)}
                          className="min-h-9 text-xs font-semibold text-[#B5532F] hover:underline whitespace-nowrap"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="text-3xl mb-2">🏪</div>
                      <p className="text-muted text-sm">No books match these filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust modal */}
      <Modal open={Boolean(modal)} onClose={() => setModal(null)} labelledBy="adjust-title" className="max-w-md p-6">
        {modal && (
          <div>
            <h3 id="adjust-title" className="font-black text-[#1B2A4A]">Adjust stock</h3>
            <p className="text-xs text-muted mt-0.5 mb-4">{modal.book.title}</p>

            <label className="block text-xs font-semibold text-stone-600 mb-1" htmlFor="inv-qty">
              New stock level (currently {modal.book.stock_quantity ?? 0})
            </label>
            <input
              id="inv-qty"
              type="number"
              min="0"
              value={modal.quantity}
              onChange={(e) => setModal({ ...modal, quantity: e.target.value })}
              className="w-full bg-stone-50 border border-[#E3DCCB] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#B5532F] mb-3"
            />

            <label className="block text-xs font-semibold text-stone-600 mb-1" htmlFor="inv-reason">Reason</label>
            <select
              id="inv-reason"
              value={modal.reason}
              onChange={(e) => setModal({ ...modal, reason: e.target.value })}
              className="w-full bg-stone-50 border border-[#E3DCCB] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#B5532F] mb-3"
            >
              {REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>

            <label className="block text-xs font-semibold text-stone-600 mb-1" htmlFor="inv-note">
              Note (required — visible in the history)
            </label>
            <textarea
              id="inv-note"
              rows={3}
              maxLength={300}
              value={modal.note}
              onChange={(e) => setModal({ ...modal, note: e.target.value })}
              placeholder="e.g. Received 20 copies from supplier, invoice #4471"
              className="w-full bg-stone-50 border border-[#E3DCCB] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#B5532F] mb-4 resize-none"
            />

            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 border border-[#E3DCCB] rounded-xl py-2.5 text-sm font-bold text-stone-600 hover:bg-stone-50 transition">
                Cancel
              </button>
              <button onClick={submitAdjust} disabled={busy} className="flex-1 bg-[#1B2A4A] hover:bg-[#B5532F] disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition">
                {busy ? "Saving…" : "Save change"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Movement history */}
      <Modal open={Boolean(history)} onClose={() => setHistory(null)} labelledBy="history-title" className="max-w-2xl p-6">
        {history && (
          <div className="flex max-h-[80dvh] flex-col">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 id="history-title" className="font-black text-[#1B2A4A]">Stock history</h3>
                <p className="text-xs text-muted mt-0.5">{history.book.title}</p>
              </div>
              <button onClick={() => setHistory(null)} className="text-muted hover:text-[#1B2A4A] text-xl leading-none" aria-label="Close">×</button>
            </div>

            <div className="overflow-y-auto overflow-x-auto -mx-2 px-2">
              {history.loading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : history.error ? (
                <p className="text-xs text-red-600">{history.error}</p>
              ) : history.rows.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">
                  No movements recorded yet. Changes made from now on will appear here.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted text-[10px] uppercase tracking-wider">
                      <th className="text-left py-2">When</th>
                      <th className="text-left py-2">Change</th>
                      <th className="text-left py-2">Result</th>
                      <th className="text-left py-2">Reason</th>
                      <th className="text-left py-2">Note / who</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {history.rows.map((m) => (
                      <tr key={m.id}>
                        <td className="py-2 text-muted whitespace-nowrap">
                          {new Date(m.created_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className={`py-2 font-bold ${m.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                          {m.delta > 0 ? "+" : ""}{m.delta}
                        </td>
                        <td className="py-2 text-stone-600">{m.quantity_before} → {m.quantity_after}</td>
                        <td className="py-2 text-stone-600 capitalize">{String(m.reason).replace(/_/g, " ")}</td>
                        <td className="py-2 text-stone-500">
                          {m.note || "—"}
                          {m.admin_email && <span className="block text-[10px] text-muted">{m.admin_email}</span>}
                          {m.order_id && <span className="block text-[10px] text-muted font-mono">order {String(m.order_id).slice(0, 8)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CUSTOMERS TAB
// ─────────────────────────────────────────────────────────
function CustomersTab({ users, orders }) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(u=>!search||`${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())||u.email?.toLowerCase().includes(search.toLowerCase()));
  const getUserOrders = id=>orders.filter(o=>o.user_id===id);
  const getLTV = id=>getUserOrders(id).reduce((s,o)=>s+(o.total||0),0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg font-bold text-navy">Customers</h1>
          <p className="text-muted text-xs mt-0.5">{users.length} registered users</p>
        </div>
        <div className="relative">
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers…"
            className="bg-white border border-[#E3DCCB] rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#1B2A4A] transition w-56"/>
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 mb-5 sm:grid-cols-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-[#E3DCCB] p-4 text-center">
          <p className="text-2xl font-black text-[#1B2A4A]">{users.length}</p>
          <p className="text-xs text-muted mt-0.5">Total users</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E3DCCB] p-4 text-center">
          <p className="text-2xl font-black text-green-600">{users.filter(u=>getUserOrders(u.id).length>0).length}</p>
          <p className="text-xs text-muted mt-0.5">Have ordered</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E3DCCB] p-4 text-center">
          <p className="text-2xl font-black text-[#B5532F]">KSh {Math.round(users.reduce((s,u)=>s+getLTV(u.id),0)/Math.max(users.filter(u=>getLTV(u.id)>0).length,1)).toLocaleString()}</p>
          <p className="text-xs text-muted mt-0.5">Avg lifetime value</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E3DCCB] overflow-hidden">
        {/* Phones: a card per order. The table below needs ten columns and is
            unusable at 360px, so the same data is laid out as a card with the
            full detail panel one tap away. */}
        {/* Phones: one card per customer. The table below carries seven
            columns and is unreadable at 360px. This is the same data. */}
        <ul role="list" className="lg:hidden divide-y divide-stone-100">
          {filtered.map((u) => {
            const orderCount = getUserOrders(u.id).length;
            const ltv = getLTV(u.id);
            return (
              <li key={u.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={`${u.first_name} ${u.last_name}`} email={u.email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || "No name"}
                    </p>
                    <p className="truncate text-xs text-muted">{u.email || "—"}</p>
                    <p className="mt-0.5 text-xs text-muted">{u.phone || "No phone"}</p>
                  </div>
                  <Badge status={u.role || "customer"} />
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-2 text-xs">
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Orders</dt>
                    <dd className="font-bold text-navy">{orderCount}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Lifetime</dt>
                    <dd className="font-bold text-success">
                      {ltv > 0 ? `KSh ${ltv.toLocaleString("en-KE")}` : "—"}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Joined</dt>
                    <dd className="text-ink">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "2-digit" })
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center">
              <p className="text-sm text-muted">No customers match this search.</p>
            </li>
          )}
        </ul>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Customer","Email","Phone","Orders","Lifetime value","Joined","Role"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(u=>(
                <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${u.first_name} ${u.last_name}`} email={u.email}/>
                      <div>
                        <p className="text-xs font-semibold text-[#1B2A4A]">{u.first_name||""} {u.last_name||""||<span className="text-muted italic">No name</span>}</p>
                        <p className="text-[10px] text-muted">{u.id.slice(0,8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">{u.email||"—"}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{u.phone||"—"}</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#1B2A4A]">{getUserOrders(u.id).length}</td>
                  <td className="px-4 py-3 text-xs font-bold text-green-600">{getLTV(u.id)>0?`KSh ${getLTV(u.id).toLocaleString()}`:"—"}</td>
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{new Date(u.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}</td>
                  <td className="px-4 py-3"><Badge status={u.role}/></td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center"><div className="text-3xl mb-2">👥</div><p className="text-muted text-sm">No customers found</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// USERS TAB
// ─────────────────────────────────────────────────────────
function UsersTab({ users, orders, session, showToast }) {
  const [search, setSearch] = useState("");
  const [localUsers, setLocalUsers] = useState(users);
  const [previousUsers, setPreviousUsers] = useState(users);
  const [updating, setUpdating] = useState(null);
  const [roleConfirm, setRoleConfirm] = useState(null); // { id, role, label }
  if (users !== previousUsers) {
    setPreviousUsers(users);
    setLocalUsers(users);
  }

  const filtered = localUsers.filter(u=>!search||u.email?.toLowerCase().includes(search.toLowerCase())||`${u.first_name||""} ${u.last_name||""}`.toLowerCase().includes(search.toLowerCase()));

  const toggleRole = async (userId, currentRole) => {
    if (userId===session?.id) { showToast("You cannot change your own role","error"); return; }
    setUpdating(userId);
    const newRole = currentRole==="admin"?"customer":"admin";
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) throw new Error("Your session has expired — please sign in again.");
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ id: userId, role: newRole }),
      });
      let json;
      try { json = await res.json(); } catch { throw new Error(`Server returned an unreadable response (${res.status})`); }
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);

      setLocalUsers(prev=>prev.map(u=>u.id===userId?{...u,role:newRole}:u));
      showToast(`Role updated to ${newRole}`);
    } catch (err) {
      showToast("Failed to change role: "+err.message, "error");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <ConfirmDialog
        open={!!roleConfirm}
        title={roleConfirm?.role==="admin" ? "Remove administrator access?" : "Make this user an administrator?"}
        message={roleConfirm?.role==="admin"
          ? `${roleConfirm?.label} will lose access to the admin dashboard and become a regular customer.`
          : `${roleConfirm?.label} will get full access to the admin dashboard: books, orders, customers and roles. Only do this for people you trust.`}
        danger={roleConfirm?.role==="admin"}
        loading={!!roleConfirm && updating===roleConfirm.id}
        confirmLabel={roleConfirm?.role==="admin" ? "Remove admin" : "Make admin"}
        loadingLabel="Saving…"
        onConfirm={async ()=>{ await toggleRole(roleConfirm.id, roleConfirm.role); setRoleConfirm(null); }}
        onCancel={()=>setRoleConfirm(null)}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#1B2A4A]">Users & Roles</h2>
          <p className="text-muted text-xs mt-0.5">{localUsers.length} users · {localUsers.filter(u=>u.role==="admin").length} admins</p>
        </div>
        <div className="relative">
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users…"
            className="bg-white border border-[#E3DCCB] rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#1B2A4A] transition w-56"/>
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E3DCCB] overflow-hidden">
        {/* Phones: a card per order. The table below needs ten columns and is
            unusable at 360px, so the same data is laid out as a card with the
            full detail panel one tap away. */}
        {/* Phones: one card per user, with the same role control as the
            table. Changing a role is the one action this tab exists for, so
            it is not hidden behind a breakpoint. */}
        <ul role="list" className="lg:hidden divide-y divide-stone-100">
          {filtered.map((u) => {
            const isYou = u.id === session?.id;
            const userOrders = orders.filter((o) => o.user_id === u.id);
            return (
              <li key={u.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={`${u.first_name} ${u.last_name}`} email={u.email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || "No name"}
                      {isYou && <span className="ml-1 text-[10px] font-bold text-sienna">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{u.email || "—"}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {userOrders.length} {userOrders.length === 1 ? "order" : "orders"}
                      {u.created_at
                        ? ` · joined ${new Date(u.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "2-digit" })}`
                        : ""}
                    </p>
                  </div>
                  <Badge status={u.role || "customer"} />
                </div>

                <div className="mt-3 border-t border-line pt-2">
                  <label htmlFor={`role-${u.id}`} className="sr-only">
                    Role for {u.email || "this user"}
                  </label>
                  <select
                    id={`role-${u.id}`}
                    value={u.role || "customer"}
                    disabled={isYou || updating === u.id}
                    onChange={(e) => {
                      // Pass the CURRENT role: toggleRole flips it, and the
                      // confirmation dialog wording ("Remove administrator
                      // access?") is written from the same side.
                      const next = e.target.value;
                      if (next === (u.role || "customer")) return;
                      setRoleConfirm({ id: u.id, role: u.role || "customer", label: u.email || "this user" });
                    }}
                    className="min-h-11 w-full rounded-control border border-line bg-white px-3 text-sm outline-none focus:border-navy disabled:opacity-50"
                  >
                    <option value="customer">customer</option>
                    <option value="admin">admin</option>
                  </select>
                  {isYou && (
                    <p className="mt-1 text-[11px] text-muted">You cannot change your own role.</p>
                  )}
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center">
              <p className="text-sm text-muted">No users match this search.</p>
            </li>
          )}
        </ul>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["User","Email","Phone","Role","Orders","Total Spent","Joined","Actions"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(u=>{
                const isYou = u.id===session?.id;
                const userOrders = orders.filter(o=>o.user_id===u.id);
                const spent = userOrders.reduce((s,o)=>s+(o.total||0),0);
                return (
                  <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${u.first_name} ${u.last_name}`} email={u.email}/>
                        <div>
                          <p className="text-xs font-semibold text-[#1B2A4A]">{u.first_name||""} {u.last_name||""}
                            {isYou&&<span className="text-[10px] text-[#B5532F] ml-1">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">{u.email||"—"}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">{u.phone||"—"}</td>
                    <td className="px-4 py-3"><Badge status={u.role||"customer"}/></td>
                    <td className="px-4 py-3 text-xs font-bold text-[#1B2A4A]">{userOrders.length}</td>
                    <td className="px-4 py-3 text-xs font-bold text-green-600">{spent>0?`KSh ${spent.toLocaleString()}`:"—"}</td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{new Date(u.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}</td>
                    <td className="px-4 py-3">
                      {!isYou&&(
                        <button onClick={()=>setRoleConfirm({ id:u.id, role:u.role, label: `${u.first_name||""} ${u.last_name||""}`.trim() || u.email || "This user" })} disabled={updating===u.id}
                          className={`text-xs font-semibold transition disabled:opacity-50 ${u.role==="admin"?"text-purple-600 hover:text-red-600":"text-muted hover:text-[#B5532F]"}`}>
                          {updating===u.id?"…":u.role==="admin"?"Remove admin":"Make admin"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={8} className="px-4 py-12 text-center"><div className="text-3xl mb-2">🛡️</div><p className="text-muted text-sm">No users found</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ACTIVITY LOG TAB — real rows from admin_activity_log
// ─────────────────────────────────────────────────────────
function ActivityLogTab() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/activity", { headers: { authorization: `Bearer ${session?.access_token}` } });
      const json = await res.json();
      setLog(json.log || []);
      setLoading(false);
    })();
  }, []);

  function describeActivity(entry) {
    const d = entry.details || {};
    const shortId = entry.target_id ? String(entry.target_id).slice(0,8).toUpperCase() : "";
    switch (entry.action) {
      case "book_added": return `Added "${d.title || "a book"}"`;
      case "book_updated": return `Updated book${d.title?` "${d.title}"`:` (#${shortId})`}${d.fields?.length ? ` — changed: ${d.fields.join(", ")}` : ""}`;
      case "book_deleted": return `Deleted "${d.title || `book #${shortId}`}"`;
      case "book_archived": return `Archived "${d.title || `book #${shortId}`}"${d.reason?` — ${d.reason}`:""}`;
      case "order_status_updated": return `Order #${shortId} changed from ${d.from || "?"} to ${d.to || "?"}`;
      case "user_role_changed": return `Changed a user's role to ${d.newRole || "?"}`;
      default: return entry.action.replace(/_/g, " ");
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-[#1B2A4A]">Activity Log</h2>
        <p className="text-muted text-xs mt-0.5">Every admin change — books, stock, and order status — recorded automatically</p>
      </div>
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12"/>)}</div>
      ) : (
                <div className="bg-white rounded-2xl border border-[#E3DCCB] overflow-hidden">
          {/* Phones get a list: the three-column table forced the admin
              email and the timestamp onto one line and pushed the row wider
              than a 320px screen. */}
          <ul className="divide-y divide-stone-50 lg:hidden">
            {log.map((entry) => (
              <li key={entry.id} className="px-4 py-3">
                <p className="text-xs font-medium leading-snug text-[#1B2A4A]">{describeActivity(entry)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-500">
                  <span className="truncate max-w-[16rem]">{entry.admin_email}</span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(entry.created_at).toLocaleString("en-KE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                </p>
              </li>
            ))}
            {log.length === 0 && (
              <li className="px-4 py-12 text-center">
                <p className="text-3xl mb-2" aria-hidden="true">📋</p>
                <p className="text-muted text-sm">No admin actions recorded yet</p>
              </li>
            )}
          </ul>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>{["Admin","What happened","When"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {log.map(entry=>(
                  <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-stone-600 whitespace-nowrap">{entry.admin_email}</td>
                    <td className="px-4 py-3 text-xs font-medium text-[#1B2A4A]">{describeActivity(entry)}</td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{new Date(entry.created_at).toLocaleString("en-KE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
                  </tr>
                ))}
                {log.length===0&&<tr><td colSpan={3} className="px-4 py-12 text-center"><div className="text-3xl mb-2">📋</div><p className="text-muted text-sm">No admin actions recorded yet</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PLACEHOLDER TABS
// ─────────────────────────────────────────────────────────
function PaymentsTab({ onNavigate, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState(null);

  const load = useCallback(async (status) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session has expired — please sign in again.");
      const res = await fetch(`/api/admin/payments?status=${status}`, {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      let json;
      try { json = await res.json(); } catch { throw new Error(`Server returned an unreadable response (${res.status})`); }
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(filter); }, [load, filter]);

  const statusLabel = { completed: "Paid", pending: "Pending", failed: "Failed" };

  // "Why is M-Pesa unavailable?" is not answerable from a generic message, so
  // the owner can ask the server to probe both Daraja hosts and report which
  // one these credentials belong to.
  const runConnectionTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session has expired — please sign in again.");
      const res = await fetch("/api/mpesa/token", {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Test failed (${res.status})`);
      setTest(json);
    } catch (err) {
      setTest({ ok: false, problem: "request-failed", advice: err.message });
    } finally {
      setTesting(false);
    }
  };

  // Opening this tab is already an explicit request for M-Pesa's state, so
  // probe it once on arrival rather than making the owner find the button.
  // The failure they are trying to explain is the reason they came here.
  const autoTested = useRef(false);
  useEffect(() => {
    if (autoTested.current) return;
    autoTested.current = true;
    runConnectionTest();
  }, []);

  const summary = data?.summary;
  const config = data?.configuration;
  const payments = data?.payments || [];

  const statusChip = (key, label, count) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
      className={`min-h-9 rounded-control border px-3 text-xs font-semibold transition ${
        filter === key ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:border-navy hover:text-navy"
      }`}
    >
      {label}{typeof count === "number" ? ` (${count})` : ""}
    </button>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-navy">M-Pesa payments</h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted">
            The last 100 payment attempts, newest first. An order is only marked paid when
            Safaricom confirms the amount, never because a browser said so.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by payment status">
            {statusChip("all", "All", summary?.total)}
            {statusChip("completed", "Paid", summary?.completed)}
            {statusChip("pending", "Pending", summary?.pending)}
            {statusChip("failed", "Failed", summary?.failed)}
          </div>
          <button
            type="button"
            onClick={() => { load(filter); showToast?.("M-Pesa payments refreshed"); }}
            className="min-h-9 rounded-control border border-line bg-white px-3 text-xs font-semibold text-navy transition hover:border-navy"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={runConnectionTest}
            disabled={testing}
            className="min-h-9 rounded-control border border-navy bg-navy px-3 text-xs font-semibold text-white transition hover:bg-sienna disabled:opacity-60"
          >
            {testing ? "Testing…" : test ? "Test again" : "Test connection"}
          </button>
        </div>
      </div>

      {config && !config.enabled && (
        <div className="mb-4 rounded-control border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            M-Pesa is not live yet — checkout is taking cash on delivery only.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            {config.reason === "not-configured" && (
              <>Set <code className="font-mono">MPESA_CONSUMER_KEY</code>, <code className="font-mono">MPESA_CONSUMER_SECRET</code>,{" "}
              <code className="font-mono">MPESA_SHORTCODE</code> and <code className="font-mono">MPESA_PASSKEY</code> in the
              deployment, then redeploy. The callback address defaults to this site&apos;s own domain.</>
            )}
            {config.reason === "pricing-migration" && (
              <>Run <code className="font-mono">20261021110000_delivery_rate.sql</code> in Supabase. Until it is applied the
              database would charge a delivery fee the customer was never shown, so payments stay switched off.</>
            )}
            {config.reason === "pricing-mismatch" && <>{config.detail}</>}
            {config.reason === "server" && <>The server is missing <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>.</>}
          </p>
        </div>
      )}

      {config?.enabled && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-control border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
          <span aria-hidden="true">✓</span>
          M-Pesa is live · {config.environment === "sandbox" ? "Safaricom sandbox" : "production"}
        </p>
      )}

      {test && (
        <div className={`mb-4 rounded-control border p-4 ${test.ok ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`} role="status">
          <p className={`text-sm font-semibold ${test.ok ? "text-green-900" : "text-amber-900"}`}>
            {test.ok ? "M-Pesa authentication works" : "M-Pesa authentication is failing"}
          </p>

          {test.advice && (
            <p className={`mt-1 text-xs leading-relaxed ${test.ok ? "text-green-800" : "text-amber-800"}`}>
              {test.advice}
            </p>
          )}

          {Array.isArray(test.checks) && (
            <ul className="mt-3 space-y-1.5">
              {test.checks.map((check) => (
                <li key={check.environment} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span aria-hidden="true">{check.ok ? "✓" : "×"}</span>
                  <span className="font-semibold text-ink">{check.environment}</span>
                  <span className="text-muted">
                    {check.ok
                      ? "token issued"
                      : `${check.status ? `HTTP ${check.status}` : "no response"}${check.code ? ` · ${check.code}` : ""}${check.message ? ` · ${check.message}` : ""}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {test.configured && (
            <dl className="mt-3 grid gap-x-6 gap-y-1 border-t border-current/10 pt-3 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Host in use</dt>
                <dd className="font-semibold text-ink">{test.environment}{test.environmentAssumed ? " (assumed)" : ""}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Short code</dt>
                <dd className="text-right font-mono font-semibold text-ink">
                  {test.shortcode || "—"}
                  {test.shortcodeKind === "till" && <span className="ml-1.5 font-sans text-[11px] font-normal text-muted">Buy Goods (till)</span>}
                  {test.shortcodeKind === "paybill" && <span className="ml-1.5 font-sans text-[11px] font-normal text-muted">paybill</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Transaction type</dt>
                <dd className="font-semibold text-ink">{test.transactionType}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Callback</dt>
                <dd className="max-w-[60%] truncate font-mono text-ink" title={test.callbackHost}>{test.callbackHost}</dd>
              </div>
            </dl>
          )}

          {test.problem === "transaction-type" && (
            <p className="mt-3 rounded-control border border-current/20 p-3 text-xs leading-relaxed">
              Safaricom will accept the login and then refuse the payment prompt, so this does not
              show up until a customer tries to pay. Fix it before taking a live order.
            </p>
          )}

          {test.shortcodeLooksLikeSandboxTest && test.environment === "production" && (
            <p className="mt-3 text-xs text-amber-800">
              174379 is Safaricom&apos;s sandbox test shortcode. With production credentials, use the
              paybill or till number from your Daraja app instead.
            </p>
          )}

          <button type="button" onClick={() => setTest(null)} className="mt-3 text-xs font-semibold text-muted underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-control border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
          <button type="button" onClick={() => load(filter)} className="ml-2 font-semibold underline">Try again</button>
        </div>
      )}

      {summary && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Collected", value: `KSh ${summary.collected.toLocaleString("en-KE")}`, accent: "text-success" },
            { label: "Paid attempts", value: summary.completed, accent: "text-navy" },
            { label: "Awaiting PIN", value: summary.pending, accent: "text-navy" },
            { label: "Failed or cancelled", value: summary.failed, accent: summary.failed ? "text-error" : "text-navy" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="rounded-card border border-line bg-white p-4">
              <p className={`text-xl font-bold tabular-nums ${accent}`}>{value}</p>
              <p className="mt-0.5 text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-card border border-line bg-white overflow-hidden">
        {loading && !data ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-navy">
              {filter === "all" ? "No M-Pesa attempts yet" : `No ${statusLabel[filter]?.toLowerCase() || filter} payments`}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              {config?.enabled
                ? "Payments appear here the moment a customer is sent a prompt, including ones they cancel."
                : "Once M-Pesa is configured, every attempt will be listed here with its receipt and a link to the order it paid for."}
            </p>
          </div>
        ) : (
          <>
            <table className="hidden w-full lg:table">
              <thead>
                <tr className="border-b border-line bg-subtle/60 text-left text-[11px] uppercase tracking-wider text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">When</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Amount</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Receipt</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {payments.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {new Date(p.created_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-navy">{p.customer.name || "Customer"}</p>
                      <p className="text-xs text-muted">{p.phone || p.customer.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-navy whitespace-nowrap">
                      KSh {Number(p.amount || 0).toLocaleString("en-KE")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{p.receipt || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge status={statusLabel[p.status] || p.status} />
                      {p.status === "failed" && p.result_desc && (
                        <p className="mt-1 max-w-[16rem] text-[11px] text-muted">{p.result_desc}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.order_id ? (
                        <button
                          type="button"
                          onClick={() => onNavigate?.("orders")}
                          className="font-mono font-semibold text-sienna underline underline-offset-2 hover:text-sienna-hover"
                        >
                          {p.order_id.slice(0, 8).toUpperCase()}
                        </button>
                      ) : (
                        <span className="text-muted">Not ordered</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phones: one card per attempt, same fields, no horizontal scroll. */}
            <ul role="list" className="divide-y divide-stone-100 lg:hidden">
              {payments.map((p) => (
                <li key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">{p.customer.name || "Customer"}</p>
                      <p className="text-xs text-muted truncate">{p.phone || p.customer.email || "—"}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-navy">KSh {Number(p.amount || 0).toLocaleString("en-KE")}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge status={statusLabel[p.status] || p.status} />
                    <span className="text-[11px] text-muted">
                      {new Date(p.created_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                    <span className="font-mono">{p.receipt || "No receipt"}</span>
                    {p.order_id ? (
                      <button
                        type="button"
                        onClick={() => onNavigate?.("orders")}
                        className="font-mono font-semibold text-sienna underline underline-offset-2"
                      >
                        Order {p.order_id.slice(0, 8).toUpperCase()}
                      </button>
                    ) : (
                      <span>Not ordered</span>
                    )}
                  </div>
                  {p.status === "failed" && p.result_desc && (
                    <p className="mt-1 text-[11px] text-muted">{p.result_desc}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function PlaceholderTab({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-xl font-bold text-[#1B2A4A] mb-2">{title}</h2>
      <p className="text-muted text-sm max-w-sm">{description}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN CLIENT COMPONENT
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// EMAIL / NOTIFICATIONS TAB
// ─────────────────────────────────────────────────────────
function NotificationsTab({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session has expired — please sign in again.");
      const res = await fetch("/api/admin/emails", {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      let json;
      try { json = await res.json(); } catch { throw new Error(`Server returned an unreadable response (${res.status})`); }
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dispatch = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session has expired — please sign in again.");
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Dispatch failed");
      const r = json.result || {};
      if (r.reason) showToast(r.reason, "error");
      else showToast(`Checked ${r.checked ?? 0} · sent ${r.sent ?? 0} · failed ${r.failed ?? 0}`);
      await load();
    } catch (err) {
      showToast("Dispatch failed: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const tone = {
    sent: "text-green-600",
    queued: "text-amber-600",
    failed: "text-red-600",
    skipped: "text-stone-500",
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#1B2A4A]">Customer emails</h2>
          <p className="text-muted text-xs mt-0.5">
            Queued in the same transaction as the order, so nothing is lost if the mail provider is down.
          </p>
        </div>
        <button
          onClick={dispatch}
          disabled={busy}
          className="bg-[#1B2A4A] hover:bg-[#B5532F] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
        >
          {busy ? "Sending…" : "Retry pending"}
        </button>
      </div>

      {loading && !data ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-800 text-sm font-semibold mb-1">Could not load the email queue</p>
          <p className="text-red-600 text-xs mb-3">{error}</p>
          <button onClick={load} className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Retry</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {["queued", "sent", "failed", "skipped"].map((k) => (
              <div key={k} className="bg-white border border-[#E3DCCB] rounded-2xl p-4">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{k}</p>
                <p className={`text-2xl font-black ${tone[k]}`}>{data?.summary?.[k] ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-[#E3DCCB] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Queued</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">To</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Order</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wider">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {(data?.emails || []).map((m) => (
                    <tr key={m.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 text-[10px] text-muted whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-stone-600">{m.to_email || "—"}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-stone-600">{String(m.template).replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted">{m.order_id ? String(m.order_id).slice(0, 8).toUpperCase() : "—"}</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${tone[m.status] || ""}`}>{m.status}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-[10px] text-stone-500 max-w-[280px] truncate" title={m.last_error || ""}>
                        {m.last_error || (m.attempts ? `${m.attempts} attempt${m.attempts !== 1 ? "s" : ""}` : "—")}
                      </td>
                    </tr>
                  ))}
                  {(data?.emails || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="text-3xl mb-2">✉️</div>
                        <p className="text-muted text-sm">No emails queued yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Rolling ranges for the dashboard. Recomputed on each fetch so "today"
// really means today, not the moment the page was opened.
function rangeBounds(range) {
  const to = new Date();
  const from = new Date(to);
  if (range === "today") from.setHours(0, 0, 0, 0);
  else if (range === "7d") from.setDate(from.getDate() - 7);
  else if (range === "90d") from.setDate(from.getDate() - 90);
  else from.setDate(from.getDate() - 30);
  return { from, to };
}

// The same navigation as the sidebar, in a slide-over panel for phones and
// small tablets. Rendered only when open so focus handling stays simple.
function MobileNav({ open, activeTab, onSelect, onClose }) {
  const panelRef = useDialog(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] lg:hidden">
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin menu"
        className="absolute left-0 top-0 h-[100dvh] w-[280px] max-w-[85%] bg-white shadow-pop flex flex-col animate-slide-in-left"
      >
        <div className="h-14 flex items-center justify-between gap-2 px-4 border-b border-line flex-shrink-0">
          <span className="font-playfair text-base font-bold text-navy">Book Haven</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin menu"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-navy hover:bg-subtle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Admin sections">
          {NAV.map((item, i) => {
            if (item.section) {
              return <p key={i} className="px-2 pt-4 pb-1 text-[10px] font-bold text-muted uppercase tracking-widest">{item.section}</p>;
            }
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect(item.id); onClose(); }}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm min-h-11 transition-colors ${
                  isActive ? "bg-navy text-white" : "text-ink hover:bg-subtle"
                }`}
              >
                <NavIcon name={item.icon} className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : "text-stone-500"}`} />
                <span className="flex-1 text-left font-medium text-[13px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function AdminClient({ initialOrders, initialUsers, initialBooksCount, sessionUser, canMutate = true }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState(initialOrders);
  const [users, setUsers] = useState(initialUsers);
  const [usersDetailLoaded, setUsersDetailLoaded] = useState(false);
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  // Distinguishes "genuinely zero books" from "the request failed" — the
  // old code collapsed both into an empty array via `json.books || []`,
  // so a broken API call looked identical to an empty catalogue.
  const [booksError, setBooksError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Server already verified admin access in page.js — start as true
  const [verified, setVerified] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(null);
  const [range, setRange] = useState("30d");
  // Whether the shop can actually take an order right now. Null until known,
  // so no banner flashes on a healthy deployment.
  const [checkout, setCheckout] = useState(null);

  // Guards against an older, slower request overwriting a newer one's
  // result if the admin reloads quickly (e.g. Save → immediate manual
  // refresh) — only the response matching the most recent call is applied.
  const booksRequestId = useRef(0);

  const loadBooks = useCallback(async () => {
    const requestId = ++booksRequestId.current;
    setBooksLoading(true);
    setBooksError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session has expired — please sign in again.");

      const res = await fetch("/api/admin/books", {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });

      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Server returned an unreadable response (${res.status})`);
      }

      if (!res.ok) throw new Error(json?.error || `Failed to load books (${res.status})`);
      if (!Array.isArray(json.books)) throw new Error("Server response was missing the books list");

      if (requestId === booksRequestId.current) {
        setBooks(json.books);
      }
    } catch (err) {
      if (requestId === booksRequestId.current) {
        setBooksError(err.message || "Failed to load books");
      }
    } finally {
      if (requestId === booksRequestId.current) setBooksLoading(false);
    }
  }, []);

  // Initial data load. State is only set from the async callback once the
  // request resolves, which is the intended fetch-on-mount pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadBooks(); }, [loadBooks]);

  // A paused checkout is a revenue emergency, not a detail: check it on load
  // and put it at the top of every tab.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/admin/checkout-status", {
          headers: { authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCheckout(json);
      } catch { /* the banner is an extra; never break the dashboard for it */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/orders", {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.orders)) setOrders(json.orders);
    } catch {
      // Keep the orders already on screen — a failed refresh must not blank
      // the table or pretend the orders disappeared.
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session has expired — please sign in again.");
      const { from, to } = rangeBounds(range);
      const res = await fetch(
        `/api/admin/metrics?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store" }
      );
      let json;
      try { json = await res.json(); } catch { throw new Error(`Server returned an unreadable response (${res.status})`); }
      if (!res.ok) throw new Error(json?.error || `Failed to load metrics (${res.status})`);
      setMetrics(json.metrics);
    } catch (err) {
      setMetricsError(err.message || "Failed to load metrics");
    } finally {
      setMetricsLoading(false);
    }
  }, [range]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  // Realtime: the dashboard follows the database instead of requiring a
  // refresh. Events are coalesced because one order write can produce several
  // (order row + stock rows), and the refetch is authoritative — the event
  // payload is never used to patch state directly.
  useEffect(() => {
    let timer = null;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadOrders();
        loadBooks();
        loadMetrics();
      }, 400);
    };

    const channel = supabase
      .channel("admin-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, refresh)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [loadOrders, loadBooks, loadMetrics]);

  // The full user list (with real emails, via the Auth Admin API) is
  // expensive, so it's fetched once, lazily, the first time the admin
  // actually opens Users or Customers — not on every dashboard load.
  const loadFullUsers = useCallback(async () => {
    if (usersDetailLoaded) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/users", {
        headers: { authorization: `Bearer ${session?.access_token}` },
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.users)) {
        setUsers(json.users);
        setUsersDetailLoaded(true);
      }
    } catch { /* keep showing the profiles-only list already in state */ }
  }, [usersDetailLoaded]);

  // Lazy fetch when the tab opens; state is set after the request resolves.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === "users" || activeTab === "customers") loadFullUsers();
  }, [activeTab, loadFullUsers]);

  const showToast = useCallback((msg, type="success") => {
    const id = Date.now();
    setToasts(prev=>[...prev,{id,msg,type}]);
    setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),4000);
  },[]);

  const removeToast = useCallback(id=>setToasts(prev=>prev.filter(t=>t.id!==id)),[]);

  // Lightweight client-side session check — just redirect if session lost.
  // The actual authorization boundary is server-side (page.js's redirect
  // before this component ever renders, and requireAdmin() on every
  // /api/admin/* call) — this is only a UX safety net for a session that
  // expires while the tab is already open, so it doesn't need to know or
  // re-check the admin email itself.
  useEffect(()=>{
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (!session) router.replace("/login");
    }).catch(()=>{}); // Never block the UI on this
  },[router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const processingCount = orders.filter(o=>o.status==="Pending"||o.status==="Processing").length;

  if (!verified) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#E3DCCB] border-t-[#1B2A4A] rounded-full animate-spin mx-auto"/>
        <p className="text-muted text-sm">Verifying access…</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-stone-50">
      <Toast toasts={toasts} onRemove={removeToast}/>

      <Sidebar activeTab={activeTab} setTab={setActiveTab} collapsed={collapsed} setCollapsed={setCollapsed} pendingCount={processingCount}/>
      <MobileNav
        open={mobileNavOpen}
        activeTab={activeTab}
        onSelect={setActiveTab}
        onClose={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          activeTab={activeTab}
          sessionUser={sessionUser}
          onLogout={handleLogout}
          onMenu={() => setMobileNavOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {checkout?.checkoutPaused && (
            <div className="mb-5 rounded-control border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-bold text-red-900">Checkout is paused — no order can be saved</p>
              <p className="mt-1 text-xs leading-relaxed text-red-800">
                The database and the app disagree about delivery pricing, so every order is being
                refused rather than charged a fee the customer never saw (the app charges 20% of the
                book total).{" "}
                {checkout.mpesa?.reason === "pricing-migration" ? (
                  <>Run <code className="font-mono">supabase/migrations/20261021110000_delivery_rate.sql</code> in
                  the Supabase SQL editor. Checkout resumes as soon as it finishes; nothing needs redeploying.</>
                ) : (
                  <>Run the migration again and check it returned <code className="font-mono">0</code>.</>
                )}
              </p>
            </div>
          )}
          {!canMutate && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-lg leading-none">⚠️</span>
              <div className="text-sm text-amber-800">
                <p className="font-bold">Read-only mode on this deployment</p>
                <p className="text-xs mt-0.5">
                  <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is not set here, so
                  saving books, changing order status and changing roles will fail. Add it to this
                  environment in Vercel, or use the production deployment.
                </p>
              </div>
            </div>
          )}
          {activeTab==="overview"&&<OverviewTab metrics={metrics} loading={metricsLoading} error={metricsError} range={range} setRange={setRange} onRetry={loadMetrics} onNavigate={setActiveTab}/>}
          {activeTab==="assistant"&&<AssistantTab/>}
          {activeTab==="orders"&&<OrdersTab orders={orders} books={books} onReload={loadOrders} showToast={showToast}/>}
          {activeTab==="books"&&<BooksTab books={books} loading={booksLoading} error={booksError} onRetry={loadBooks} reloadBooks={loadBooks} showToast={showToast}/>}
          {activeTab==="customers"&&<CustomersTab users={users} orders={orders}/>}
          {activeTab==="payments"&&<PaymentsTab onNavigate={setActiveTab} showToast={showToast}/>}
          {activeTab==="reports"&&<PlaceholderTab icon="📈" title="Reports" description="Generate sales, inventory, customer, and revenue reports. Export as CSV or PDF."/>}
          {activeTab==="inventory"&&<InventoryTab books={books} loading={booksLoading} error={booksError} onRetry={loadBooks} reloadBooks={loadBooks} showToast={showToast}/>}
          {activeTab==="notifications"&&<NotificationsTab showToast={showToast}/>}
          {activeTab==="reviews"&&<PlaceholderTab icon="⭐" title="Reviews" description="Manage customer reviews and ratings for all books."/>}
          {activeTab==="coupons"&&<PlaceholderTab icon="🏷️" title="Coupons" description="Create and manage discount codes and promotional offers."/>}
          {activeTab==="users"&&<UsersTab users={users} orders={orders} session={sessionUser} showToast={showToast}/>}
          {activeTab==="activity"&&<ActivityLogTab showToast={showToast}/>}
          {activeTab==="settings"&&<PlaceholderTab icon="⚙️" title="Settings" description="Configure store information, payment gateways, email templates, and more."/>}
        </main>
      </div>
    </div>
  );
}