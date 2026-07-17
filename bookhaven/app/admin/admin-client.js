"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const ADMIN_EMAIL = "mwaurafelix754@gmail.com";

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    Processing:"bg-amber-50 text-amber-700 border border-amber-200",
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
    customer:"bg-stone-50 text-stone-600 border border-stone-200",
    "In Stock":"bg-green-50 text-green-700 border border-green-200",
    "Out of Stock":"bg-red-50 text-red-700 border border-red-200",
    "Only 3 left":"bg-amber-50 text-amber-700 border border-amber-200",
    "Only 1 left":"bg-orange-50 text-orange-700 border border-orange-200",
    "Pre-order":"bg-blue-50 text-blue-700 border border-blue-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]||"bg-stone-50 text-stone-600 border border-stone-200"}`}>
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
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white min-w-[280px] ${t.type==="error"?"bg-red-600":"bg-[#1C1917]"}`}>
          <span>{t.type==="error"?"⚠️":"✓"}</span>
          <span className="flex-1">{t.msg}</span>
          <button onClick={()=>onRemove(t.id)} className="text-white/60 hover:text-white">✕</button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-stone-200">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${danger?"bg-red-50":"bg-amber-50"}`}>
          <svg className={`w-6 h-6 ${danger?"text-red-500":"text-amber-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[#1C1917] mb-2">{title}</h3>
        <p className="text-stone-500 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition active:scale-95 ${danger?"bg-red-600 hover:bg-red-700":"bg-[#1C1917] hover:bg-[#991B1B]"}`}>Confirm</button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className="" }) {
  return <div className={`bg-stone-100 rounded-lg animate-pulse ${className}`}/>;
}

function StatCard({ icon, label, value, delta, deltaUp, sub, accent }) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${accent?"bg-[#1C1917] border-[#1C1917]":"bg-white border-stone-200 hover:shadow-sm transition-shadow"}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${accent?"text-stone-400":"text-stone-400"}`}>{label}</p>
          <p className={`text-2xl font-black mt-1 leading-none ${accent?"text-amber-400":"text-[#1C1917]"}`}>{value}</p>
          {sub && <p className={`text-xs mt-1 ${accent?"text-stone-500":"text-stone-400"}`}>{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent?"bg-white/10":"bg-stone-50"}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      {delta && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${deltaUp?"text-green-600":"text-red-500"}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={deltaUp?"M13 7h8m0 0v8m0-8l-8 8-4-4-6 6":"M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"}/>
          </svg>
          {delta}
        </div>
      )}
    </div>
  );
}

function MiniChart({ data, color="#991B1B" }) {
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
const NAV = [
  { section:"Main" },
  { id:"overview", label:"Dashboard", icon:"📊" },
  { id:"orders", label:"Orders", icon:"📦", badge:true },
  { id:"books", label:"Products", icon:"📚" },
  { id:"customers", label:"Customers", icon:"👥" },
  { section:"Finance" },
  { id:"payments", label:"Payments", icon:"💳" },
  { id:"reports", label:"Reports", icon:"📈" },
  { section:"Store" },
  { id:"inventory", label:"Inventory", icon:"🏪" },
  { id:"reviews", label:"Reviews", icon:"⭐" },
  { id:"coupons", label:"Coupons", icon:"🏷️" },
  { section:"System" },
  { id:"users", label:"Users & Roles", icon:"🛡️" },
  { id:"activity", label:"Activity Logs", icon:"📋" },
  { id:"settings", label:"Settings", icon:"⚙️" },
];

function Sidebar({ activeTab, setTab, collapsed, setCollapsed, pendingCount }) {
  return (
    <aside className={`flex flex-col border-r border-stone-200 bg-white transition-all duration-200 flex-shrink-0 ${collapsed?"w-[56px]":"w-[220px]"}`}>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-3.5 border-b border-stone-200 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-[#1C1917] flex items-center justify-center flex-shrink-0">
          <span className="text-sm">📚</span>
        </div>
        {!collapsed && <span className="font-black text-sm text-[#1C1917] tracking-tight whitespace-nowrap">Book Haven</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item, i) => {
          if (item.section) return !collapsed ? (
            <p key={i} className="px-2 pt-4 pb-1 text-[10px] font-bold text-stone-400 uppercase tracking-widest">{item.section}</p>
          ) : <div key={i} className="my-2 border-t border-stone-100"/>;

          const isActive = activeTab === item.id;
          return (
            <button key={item.id} onClick={()=>setTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all ${isActive?"bg-[#1C1917] text-white":"text-stone-600 hover:bg-stone-50 hover:text-[#1C1917]"}`}
              title={collapsed?item.label:""}>
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left font-medium whitespace-nowrap text-[13px]">{item.label}</span>
                  {item.badge && pendingCount > 0 && (
                    <span className="bg-[#991B1B] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{pendingCount}</span>
                  )}
                </>
              )}
              {collapsed && item.badge && pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#991B1B] rounded-full"/>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-stone-200 p-2 flex-shrink-0">
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
function Topbar({ activeTab, sessionUser, onLogout, darkMode, setDarkMode }) {
  const labels = { overview:"Dashboard", orders:"Orders", books:"Products", customers:"Customers", payments:"Payments", reports:"Reports", inventory:"Inventory", reviews:"Reviews", coupons:"Coupons", users:"Users & Roles", activity:"Activity Logs", settings:"Settings" };
  const [search, setSearch] = useState("");
  return (
    <div className="h-14 flex items-center gap-3 px-4 border-b border-stone-200 bg-white flex-shrink-0">
      {/* Breadcrumb */}
      <div className="hidden sm:flex items-center gap-1 text-xs text-stone-400">
        <span>Book Haven</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        <span className="text-stone-700 font-medium">{labels[activeTab]||activeTab}</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-xs ml-auto sm:ml-4 relative">
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search anything…"
          className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#1C1917] transition"/>
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-2">
        <button onClick={()=>setDarkMode(!darkMode)} className="w-8 h-8 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center text-stone-500 hover:bg-stone-100 transition" title="Toggle theme">
          {darkMode ? "☀️" : "🌙"}
        </button>
        <button className="w-8 h-8 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center text-stone-500 hover:bg-stone-100 transition relative" title="Notifications">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#991B1B] rounded-full"/>
        </button>
        <Link href="/" className="w-8 h-8 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center text-stone-500 hover:bg-stone-100 transition" title="View store">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </Link>
        <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
          <Avatar name="Felix Mwaura" email={sessionUser?.email} size="sm"/>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-[#1C1917] leading-none">Felix Mwaura</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Admin</p>
          </div>
          <button onClick={onLogout} className="ml-1 text-xs text-stone-400 hover:text-red-600 transition" title="Sign out">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────
function OverviewTab({ orders, users, booksCount, loading }) {
  const totalRevenue = orders.reduce((s,o)=>s+(o.total||0),0);
  const todayOrders = orders.filter(o=>new Date(o.created_at).toDateString()===new Date().toDateString()).length;
  const processing = orders.filter(o=>o.status==="Processing").length;
  const delivered = orders.filter(o=>o.status==="Delivered").length;
  const cancelled = orders.filter(o=>o.status==="Cancelled").length;
  const shipped = orders.filter(o=>o.status==="Shipped").length;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const monthlyRevenue = [...Array(6)].map((_,i)=>{
    const d = new Date(now.getFullYear(),now.getMonth()-5+i,1);
    return orders.filter(o=>{ const od=new Date(o.created_at); return od.getMonth()===d.getMonth()&&od.getFullYear()===d.getFullYear(); }).reduce((s,o)=>s+(o.total||0),0);
  });
  const monthLabels = [...Array(6)].map((_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-5+i,1); return months[d.getMonth()]; });
  const thisMonth = monthlyRevenue[5]||0;
  const lastMonth = monthlyRevenue[4]||0;
  const revenueChange = lastMonth>0?Math.round(((thisMonth-lastMonth)/lastMonth)*100):0;
  const recent = [...orders].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(8)].map((_,i)=><Skeleton key={i} className="h-28"/>)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon="💰" label="Total Revenue" value={`KSh ${totalRevenue.toLocaleString()}`} delta={`${revenueChange>=0?"+":""}${revenueChange}% vs last month`} deltaUp={revenueChange>=0} accent/>
        <StatCard icon="📦" label="Total Orders" value={orders.length} delta={`${todayOrders} today`} deltaUp={todayOrders>0}/>
        <StatCard icon="⏳" label="Pending" value={processing} delta={processing>0?"Needs attention":""} deltaUp={false} sub="Processing"/>
        <StatCard icon="✅" label="Delivered" value={delivered} delta={`${orders.length?Math.round((delivered/orders.length)*100):0}% success rate`} deltaUp/>
        <StatCard icon="🚚" label="Shipped" value={shipped} sub="In transit"/>
        <StatCard icon="❌" label="Cancelled" value={cancelled} delta={`${orders.length?Math.round((cancelled/orders.length)*100):0}% cancel rate`} deltaUp={false}/>
        <StatCard icon="👥" label="Customers" value={users.length} delta="+3 this week" deltaUp/>
        <StatCard icon="📚" label="Books" value={booksCount} sub="In catalogue"/>
      </div>

      {/* Revenue highlight */}
      <div className="bg-gradient-to-r from-[#1C1917] to-[#2d1a10] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">This Month</p>
          <p className="text-3xl font-black text-amber-400">KSh {thisMonth.toLocaleString()}</p>
          <p className="text-stone-500 text-sm mt-1">{orders.filter(o=>{ const d=new Date(o.created_at); const n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }).length} orders this month</p>
        </div>
        <div className="sm:w-48">
          <MiniChart data={monthlyRevenue} color="#c9a84c"/>
          <div className="flex justify-between mt-1">
            {monthLabels.map(l=><span key={l} className="text-[9px] text-stone-500">{l}</span>)}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Order status breakdown */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <h3 className="font-bold text-[#1C1917] text-sm mb-4">Order breakdown</h3>
          <div className="space-y-3">
            {[
              { label:"Processing", count:processing, color:"bg-amber-400", pct:orders.length?(processing/orders.length)*100:0 },
              { label:"Shipped", count:shipped, color:"bg-blue-400", pct:orders.length?(shipped/orders.length)*100:0 },
              { label:"Delivered", count:delivered, color:"bg-green-500", pct:orders.length?(delivered/orders.length)*100:0 },
              { label:"Cancelled", count:cancelled, color:"bg-red-400", pct:orders.length?(cancelled/orders.length)*100:0 },
            ].map(({label,count,color,pct})=>(
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-stone-600 font-medium">{label}</span>
                  <span className="font-bold text-[#1C1917]">{count} <span className="text-stone-400 font-normal">({Math.round(pct)}%)</span></span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{width:`${pct}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top customers */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <h3 className="font-bold text-[#1C1917] text-sm mb-4">Top customers</h3>
          <div className="space-y-3">
            {users.slice(0,4).map((u,i)=>{
              const spent = orders.filter(o=>o.user_id===u.id).reduce((s,o)=>s+(o.total||0),0);
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 w-4">{i+1}</span>
                  <Avatar name={`${u.first_name} ${u.last_name}`} email={u.email}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1C1917] truncate">{u.first_name||""} {u.last_name||""||u.email}</p>
                    <p className="text-[10px] text-stone-400">{orders.filter(o=>o.user_id===u.id).length} orders</p>
                  </div>
                  <span className="text-xs font-bold text-[#1C1917]">KSh {spent.toLocaleString()}</span>
                </div>
              );
            })}
            {users.length===0&&<p className="text-xs text-stone-400 text-center py-4">No customers yet</p>}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <h3 className="font-bold text-[#1C1917] text-sm mb-4">Alerts</h3>
          <div className="space-y-3">
            {processing>0&&<div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl"><span className="text-base">⏳</span><div><p className="text-xs font-bold text-amber-800">{processing} orders pending</p><p className="text-[10px] text-amber-600 mt-0.5">Need to be shipped</p></div></div>}
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl"><span className="text-base">📦</span><div><p className="text-xs font-bold text-blue-800">New order received</p><p className="text-[10px] text-blue-600 mt-0.5">Just now</p></div></div>
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-100 rounded-xl"><span className="text-base">👤</span><div><p className="text-xs font-bold text-green-800">New customer registered</p><p className="text-[10px] text-green-600 mt-0.5">2 minutes ago</p></div></div>
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl"><span className="text-base">⚠️</span><div><p className="text-xs font-bold text-red-800">3 books low stock</p><p className="text-[10px] text-red-600 mt-0.5">Restock needed</p></div></div>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-[#1C1917] text-sm">Recent orders</h3>
          <span className="text-xs text-stone-400">{orders.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Order ID","Customer","City","Items","Total","Payment","Status","Date"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {recent.map(o=>(
                <tr key={o.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#991B1B]">{o.id.slice(0,8).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={`${o.delivery_details?.firstName||""} ${o.delivery_details?.lastName||""}`} email="" size="sm"/>
                      <div>
                        <p className="text-xs font-semibold text-[#1C1917]">{o.delivery_details?.firstName} {o.delivery_details?.lastName}</p>
                        <p className="text-[10px] text-stone-400">{o.delivery_details?.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">{o.delivery_details?.city}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{(o.items||[]).length}</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#1C1917]">KSh {(o.total||0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{o.payment_method}</td>
                  <td className="px-4 py-3"><Badge status={o.status}/></td>
                  <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short"})}</td>
                </tr>
              ))}
              {recent.length===0&&<tr><td colSpan={8} className="px-4 py-10 text-center text-stone-400 text-sm">No orders yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ORDERS TAB
// ─────────────────────────────────────────────────────────
function OrdersTab({ orders, onUpdateStatus, showToast }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updating, setUpdating] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const perPage = 8;

  const filtered = orders.filter(o=>{
    const q=search.toLowerCase();
    const name=`${o.delivery_details?.firstName||""} ${o.delivery_details?.lastName||""}`.toLowerCase();
    const ms=statusFilter==="All"||o.status===statusFilter;
    const mq=!search||o.id.toLowerCase().includes(q)||name.includes(q)||(o.delivery_details?.city||"").toLowerCase().includes(q)||(o.delivery_details?.phone||"").includes(q);
    return ms&&mq;
  });

  const totalPages = Math.ceil(filtered.length/perPage);
  const paginated = filtered.slice((page-1)*perPage,page*perPage);

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: orderId, status: newStatus }),
    });
    const json = await res.json();
    if (!json.error) { onUpdateStatus(orderId, newStatus); showToast(`Order updated to ${newStatus}`); }
    else showToast("Update failed: " + json.error, "error");
    setUpdating(null);
  };

  const cancelOrder = (orderId) => {
    setConfirm({ orderId, status:"Cancelled" });
  };

  return (
    <div>
      <ConfirmDialog
        open={!!confirm}
        title="Cancel order?"
        message="This will mark the order as cancelled. This action can be reversed."
        danger
        onConfirm={()=>{ updateStatus(confirm.orderId,confirm.status); setConfirm(null); }}
        onCancel={()=>setConfirm(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#1C1917]">Orders</h2>
          <p className="text-stone-400 text-xs mt-0.5">{orders.length} total · KSh {orders.reduce((s,o)=>s+(o.total||0),0).toLocaleString()} revenue</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search orders…"
              className="bg-white border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#1C1917] transition w-56"/>
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        {["All","Processing","Shipped","Delivered","Cancelled"].map(s=>(
          <button key={s} onClick={()=>{setStatusFilter(s);setPage(1);}}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${statusFilter===s?"bg-[#1C1917] text-white":"bg-white border border-stone-200 text-stone-600 hover:border-stone-300"}`}>
            {s} <span className="opacity-60 ml-0.5">({s==="All"?orders.length:orders.filter(o=>o.status===s).length})</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["","Order ID","Customer","Address","Books","Total","Payment","Status","Date","Actions"].map(h=>(
                <th key={h} className="text-left px-3 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {paginated.map(o=>(
                <>
                  <tr key={o.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-3 py-3">
                      <button onClick={()=>setExpanded(expanded===o.id?null:o.id)} className="text-stone-400 hover:text-[#1C1917] transition">
                        <svg className={`w-4 h-4 transition-transform ${expanded===o.id?"rotate-90":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-[#991B1B]">{o.id.slice(0,8).toUpperCase()}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={`${o.delivery_details?.firstName||""} ${o.delivery_details?.lastName||""}`} email="" size="sm"/>
                        <div>
                          <p className="text-xs font-semibold text-[#1C1917]">{o.delivery_details?.firstName} {o.delivery_details?.lastName}</p>
                          <p className="text-[10px] text-stone-400">{o.delivery_details?.phone}</p>
                          <p className="text-[10px] text-stone-400">{o.delivery_details?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-stone-600 max-w-[120px] truncate">{o.delivery_details?.address}</p>
                      <p className="text-[10px] text-stone-400">{o.delivery_details?.city}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-stone-500">{(o.items||[]).length} book{(o.items||[]).length!==1?"s":""}</td>
                    <td className="px-3 py-3 text-xs font-bold text-[#1C1917]">KSh {(o.total||0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-stone-500">{o.payment_method}</td>
                    <td className="px-3 py-3"><Badge status={o.status}/></td>
                    <td className="px-3 py-3 text-[10px] text-stone-400 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)} disabled={updating===o.id}
                          className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-[#991B1B] disabled:opacity-50 cursor-pointer">
                          {["Processing","Shipped","Delivered","Cancelled"].map(s=><option key={s}>{s}</option>)}
                        </select>
                        {o.status!=="Cancelled"&&<button onClick={()=>cancelOrder(o.id)} className="p-1 text-stone-400 hover:text-red-600 transition" title="Cancel order">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>}
                      </div>
                    </td>
                  </tr>
                  {expanded===o.id&&(
                    <tr key={`${o.id}-exp`}>
                      <td colSpan={10} className="px-5 py-4 bg-stone-50 border-t border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Order items</p>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {(o.items||[]).map((item,i)=>(
                            <div key={i} className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-[#1C1917]">{item.title}</p>
                                <p className="text-[10px] text-stone-400">{item.author} · Qty {item.quantity||1}</p>
                              </div>
                              <p className="text-xs font-bold text-[#1C1917]">KSh {(item.price*(item.quantity||1)).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                        {o.payment_ref&&<p className="text-[10px] text-stone-500 mt-3">M-Pesa receipt: <span className="font-mono font-bold">{o.payment_ref}</span></p>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {paginated.length===0&&<tr><td colSpan={10} className="px-4 py-12 text-center"><div className="text-3xl mb-2">📦</div><p className="text-stone-400 text-sm">No orders found</p></td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100">
            <p className="text-xs text-stone-400">Showing {(page-1)*perPage+1}–{Math.min(page*perPage,filtered.length)} of {filtered.length}</p>
            <div className="flex gap-1">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg disabled:opacity-40 hover:bg-stone-50">Prev</button>
              {[...Array(totalPages)].map((_,i)=>(
                <button key={i} onClick={()=>setPage(i+1)} className={`w-7 h-7 text-xs rounded-lg border transition ${page===i+1?"bg-[#1C1917] text-white border-[#1C1917]":"border-stone-200 hover:bg-stone-50"}`}>{i+1}</button>
              ))}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg disabled:opacity-40 hover:bg-stone-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BOOKS TAB
// ─────────────────────────────────────────────────────────
function BooksTab({ showToast }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({title:"",author:"",price:"",original_price:"",category:"Self-Help",format:"Paperback",badge:"",stock:"In Stock",description:"",pages:"",publisher:"",year:""});

  const categories = ["Self-Help","Finance","Productivity","Psychology","History","Philosophy","Fiction","Biography"];
  const coverMap = {"Self-Help":["#2d4a22","#86efac"],"Finance":["#0f3460","#fbbf24"],"Productivity":["#1b1b2f","#f87171"],"Psychology":["#3b1f5e","#a78bfa"],"History":["#2c1810","#fb923c"],"Philosophy":["#0d0d0d","#f9a8d4"],"Fiction":["#1a3a4a","#67e8f9"],"Biography":["#1c3a5e","#6ee7b7"]};

  const load = async () => {
    setLoading(true);
    // Use secure admin API route — not direct Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/books", { headers: { authorization: `Bearer ${token}` } });
    const { books: data } = await res.json();
    setBooks(data||[]);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const filtered = books.filter(b=>b.title.toLowerCase().includes(search.toLowerCase())||b.author.toLowerCase().includes(search.toLowerCase())||b.category.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditBook(null); setForm({title:"",author:"",price:"",original_price:"",category:"Self-Help",format:"Paperback",badge:"",stock:"In Stock",description:"",pages:"",publisher:"",year:""}); setShowForm(true); };
  const openEdit = (book) => { setEditBook(book); setForm({title:book.title,author:book.author,price:book.price,original_price:book.original_price||"",category:book.category,format:book.format,badge:book.badge||"",stock:book.stock,description:book.description||"",pages:book.pages||"",publisher:book.publisher||"",year:book.year||""}); setShowForm(true); };

  const save = async () => {
    if (!form.title.trim()||!form.price) { showToast("Title and price are required","error"); return; }
    setSaving(true);
    const [bg,accent] = coverMap[form.category]||["#1C1917","#991B1B"];
    const payload = {title:form.title.trim(),author:form.author.trim(),price:Number(form.price),original_price:form.original_price?Number(form.original_price):null,category:form.category,format:form.format,badge:form.badge||null,stock:form.stock,description:form.description.trim(),pages:form.pages?Number(form.pages):null,publisher:form.publisher.trim(),year:form.year?Number(form.year):null,cover:{bg,accent,pattern:"dots"}};

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (editBook) {
      const res = await fetch("/api/admin/books", { method:"PATCH", headers:{ "Content-Type":"application/json", authorization:`Bearer ${token}` }, body:JSON.stringify({id:editBook.id,...payload}) });
      const { error } = await res.json();
      if (error) showToast("Update failed: "+error,"error");
      else { showToast(`"${form.title}" updated`); await load(); setShowForm(false); }
    } else {
      const res = await fetch("/api/admin/books", { method:"POST", headers:{ "Content-Type":"application/json", authorization:`Bearer ${token}` }, body:JSON.stringify(payload) });
      const { error } = await res.json();
      if (error) showToast("Add failed: "+error,"error");
      else { showToast(`"${form.title}" added to catalogue`); await load(); setShowForm(false); }
    }
    setSaving(false);
  };

  const deleteBook = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/books", { method:"DELETE", headers:{ "Content-Type":"application/json", authorization:`Bearer ${token}` }, body:JSON.stringify({id:deleteConfirm}) });
    const { error } = await res.json();
    if (error) showToast("Delete failed","error");
    else { showToast("Book removed"); await load(); }
    setDeleteConfirm(null);
  };

  const updateStock = async (id, stock) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch("/api/admin/books", { method:"PATCH", headers:{ "Content-Type":"application/json", authorization:`Bearer ${token}` }, body:JSON.stringify({id,stock}) });
    setBooks(prev=>prev.map(b=>b.id===id?{...b,stock}:b));
    showToast("Stock updated");
  };

  const F = ({label,name,type="text",placeholder,full}) => (
    <div className={full?"col-span-2":""}>
      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
      <input type={type} value={form[name]} placeholder={placeholder} onChange={e=>setForm(p=>({...p,[name]:e.target.value}))}
        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B]/20 transition"/>
    </div>
  );

  return (
    <div>
      <ConfirmDialog open={!!deleteConfirm} title="Delete book?" message="This will permanently remove the book from your catalogue." danger onConfirm={deleteBook} onCancel={()=>setDeleteConfirm(null)}/>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#1C1917]">Products</h2>
          <p className="text-stone-400 text-xs mt-0.5">{books.length} titles in database</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Add book
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#1C1917]">{editBook?`Editing: ${editBook.title}`:"Add new book"}</h3>
              <p className="text-xs text-stone-400 mt-0.5">{editBook?"Update the book details below":"Fill in the details for the new title"}</p>
            </div>
            <button onClick={()=>setShowForm(false)} className="p-2 hover:bg-stone-100 rounded-full transition text-stone-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F label="Title *" name="title" placeholder="Book title" full/>
            <F label="Author *" name="author" placeholder="Author name"/>
            <F label="Price (KSh) *" name="price" type="number" placeholder="1299"/>
            <F label="Original price (KSh)" name="original_price" type="number" placeholder="Leave blank if no discount"/>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Category</label>
              <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                {categories.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Format</label>
              <select value={form.format} onChange={e=>setForm(p=>({...p,format:e.target.value}))} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                {["Paperback","Hardcover","eBook"].map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Badge</label>
              <select value={form.badge} onChange={e=>setForm(p=>({...p,badge:e.target.value}))} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                <option value="">No badge</option>
                {["Bestseller","New","Trending","Staff Pick","Award Winner","Classic","Top Rated"].map(b=><option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Stock status</label>
              <select value={form.stock} onChange={e=>setForm(p=>({...p,stock:e.target.value}))} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                {["In Stock","Out of Stock","Only 3 left","Only 1 left","Pre-order"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <F label="Pages" name="pages" type="number" placeholder="320"/>
            <F label="Publisher" name="publisher" placeholder="Publisher name"/>
            <F label="Year" name="year" type="number" placeholder="2024"/>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Description</label>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3} placeholder="Book description…" className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition resize-none"/>
            </div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-stone-100">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] disabled:bg-stone-200 disabled:text-stone-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95">
              {saving?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Saving…</>:editBook?"Save changes":"Add book"}
            </button>
            <button onClick={()=>setShowForm(false)} className="border border-stone-200 text-stone-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-50 transition">Cancel</button>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search books…"
          className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition"/>
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-14"/>)}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>{["Title","Category","Price","Stock","Badge","Rating","Actions"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(book=>(
                  <tr key={book.id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#1C1917]">{book.title}</p>
                      <p className="text-xs text-stone-400">{book.author}</p>
                    </td>
                    <td className="px-4 py-3"><Badge status={book.category}/></td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-[#1C1917]">KSh {book.price.toLocaleString()}</p>
                      {book.original_price&&<p className="text-[10px] text-stone-400 line-through">KSh {book.original_price.toLocaleString()}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <select value={book.stock} onChange={e=>updateStock(book.id,e.target.value)}
                        className="text-xs font-semibold bg-transparent border-none outline-none cursor-pointer" style={{color:book.stock==="In Stock"?"#16a34a":book.stock==="Out of Stock"?"#dc2626":"#d97706"}}>
                        {["In Stock","Out of Stock","Only 3 left","Only 1 left","Pre-order"].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">{book.badge?<span className="px-2 py-0.5 bg-[#991B1B] text-white text-[10px] font-bold rounded-md">{book.badge}</span>:<span className="text-stone-300 text-xs">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-amber-400 text-xs">★</span>
                        <span className="text-xs font-semibold text-stone-600">{book.rating}</span>
                        <span className="text-[10px] text-stone-400">({book.reviews||0})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>openEdit(book)} className="text-xs text-[#991B1B] font-semibold hover:underline">Edit</button>
                        <button onClick={()=>setDeleteConfirm(book.id)} className="text-xs text-stone-400 hover:text-red-600 font-semibold">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center"><div className="text-3xl mb-2">📚</div><p className="text-stone-400 text-sm">No books found</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
          <h2 className="text-lg font-bold text-[#1C1917]">Customers</h2>
          <p className="text-stone-400 text-xs mt-0.5">{users.length} registered users</p>
        </div>
        <div className="relative">
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers…"
            className="bg-white border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#1C1917] transition w-56"/>
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
          <p className="text-2xl font-black text-[#1C1917]">{users.length}</p>
          <p className="text-xs text-stone-400 mt-0.5">Total users</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
          <p className="text-2xl font-black text-green-600">{users.filter(u=>getUserOrders(u.id).length>0).length}</p>
          <p className="text-xs text-stone-400 mt-0.5">Have ordered</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
          <p className="text-2xl font-black text-[#991B1B]">KSh {Math.round(users.reduce((s,u)=>s+getLTV(u.id),0)/Math.max(users.filter(u=>getLTV(u.id)>0).length,1)).toLocaleString()}</p>
          <p className="text-xs text-stone-400 mt-0.5">Avg lifetime value</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Customer","Email","Phone","Orders","Lifetime value","Joined","Role"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(u=>(
                <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${u.first_name} ${u.last_name}`} email={u.email}/>
                      <div>
                        <p className="text-xs font-semibold text-[#1C1917]">{u.first_name||""} {u.last_name||""||<span className="text-stone-400 italic">No name</span>}</p>
                        <p className="text-[10px] text-stone-400">{u.id.slice(0,8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">{u.email||"—"}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{u.phone||"—"}</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#1C1917]">{getUserOrders(u.id).length}</td>
                  <td className="px-4 py-3 text-xs font-bold text-green-600">{getLTV(u.id)>0?`KSh ${getLTV(u.id).toLocaleString()}`:"—"}</td>
                  <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}</td>
                  <td className="px-4 py-3"><Badge status={u.role}/></td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center"><div className="text-3xl mb-2">👥</div><p className="text-stone-400 text-sm">No customers found</p></td></tr>}
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
  const [updating, setUpdating] = useState(null);
  useEffect(()=>setLocalUsers(users),[users]);

  const filtered = localUsers.filter(u=>!search||u.email?.toLowerCase().includes(search.toLowerCase())||`${u.first_name||""} ${u.last_name||""}`.toLowerCase().includes(search.toLowerCase()));

  const toggleRole = async (userId, currentRole) => {
    if (userId===session?.id) { showToast("You cannot change your own role","error"); return; }
    setUpdating(userId);
    const newRole = currentRole==="admin"?"customer":"admin";
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${s?.access_token}` },
      body: JSON.stringify({ id: userId, role: newRole }),
    });
    const json = await res.json();
    if (!json.error) { setLocalUsers(prev=>prev.map(u=>u.id===userId?{...u,role:newRole}:u)); showToast(`Role updated to ${newRole}`); }
    else showToast("Failed: "+json.error,"error");
    setUpdating(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#1C1917]">Users & Roles</h2>
          <p className="text-stone-400 text-xs mt-0.5">{localUsers.length} users · {localUsers.filter(u=>u.role==="admin").length} admins</p>
        </div>
        <div className="relative">
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users…"
            className="bg-white border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#1C1917] transition w-56"/>
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["User","Email","Phone","Role","Orders","Total Spent","Joined","Actions"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                          <p className="text-xs font-semibold text-[#1C1917]">{u.first_name||""} {u.last_name||""}
                            {isYou&&<span className="text-[10px] text-[#991B1B] ml-1">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">{u.email||"—"}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">{u.phone||"—"}</td>
                    <td className="px-4 py-3"><Badge status={u.role||"customer"}/></td>
                    <td className="px-4 py-3 text-xs font-bold text-[#1C1917]">{userOrders.length}</td>
                    <td className="px-4 py-3 text-xs font-bold text-green-600">{spent>0?`KSh ${spent.toLocaleString()}`:"—"}</td>
                    <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}</td>
                    <td className="px-4 py-3">
                      {!isYou&&(
                        <button onClick={()=>toggleRole(u.id,u.role)} disabled={updating===u.id}
                          className={`text-xs font-semibold transition disabled:opacity-50 ${u.role==="admin"?"text-purple-600 hover:text-red-600":"text-stone-400 hover:text-[#991B1B]"}`}>
                          {updating===u.id?"…":u.role==="admin"?"Remove admin":"Make admin"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={8} className="px-4 py-12 text-center"><div className="text-3xl mb-2">🛡️</div><p className="text-stone-400 text-sm">No users found</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PLACEHOLDER TABS
// ─────────────────────────────────────────────────────────
function PlaceholderTab({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-xl font-bold text-[#1C1917] mb-2">{title}</h2>
      <p className="text-stone-400 text-sm max-w-sm">{description}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN CLIENT COMPONENT
// ─────────────────────────────────────────────────────────
export default function AdminClient({ initialOrders, initialUsers, initialBooksCount, sessionUser }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState(initialOrders);
  const [users] = useState(initialUsers);
  const [booksCount, setBooksCount] = useState(initialBooksCount);
  const [collapsed, setCollapsed] = useState(false);
  const [verified, setVerified] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg, type="success") => {
    const id = Date.now();
    setToasts(prev=>[...prev,{id,msg,type}]);
    setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),4000);
  },[]);

  const removeToast = useCallback(id=>setToasts(prev=>prev.filter(t=>t.id!==id)),[]);

  // Client-side double-check
  useEffect(()=>{
    const verify = async () => {
      const { data:{ session } } = await supabase.auth.getSession();
      if (!session||session.user.email!==ADMIN_EMAIL) { router.replace("/"); return; }
      const { data:profile } = await supabase.from("profiles").select("role").eq("id",session.user.id).single();
      if (profile?.role!=="admin") { router.replace("/"); return; }
      setVerified(true);
    };
    verify();
  },[router]);

  const handleUpdateStatus = useCallback((orderId, newStatus)=>{
    setOrders(prev=>prev.map(o=>o.id===orderId?{...o,status:newStatus}:o));
  },[]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const processingCount = orders.filter(o=>o.status==="Processing").length;

  if (!verified) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-[#1C1917] rounded-full animate-spin mx-auto"/>
        <p className="text-stone-400 text-sm">Verifying access…</p>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen overflow-hidden bg-stone-50 ${darkMode?"dark":""}`}>
      <Toast toasts={toasts} onRemove={removeToast}/>

      <Sidebar activeTab={activeTab} setTab={setActiveTab} collapsed={collapsed} setCollapsed={setCollapsed} pendingCount={processingCount}/>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar activeTab={activeTab} sessionUser={sessionUser} onLogout={handleLogout} darkMode={darkMode} setDarkMode={setDarkMode}/>

        <main className="flex-1 overflow-y-auto p-5 sm:p-6">
          {activeTab==="overview"&&<OverviewTab orders={orders} users={users} booksCount={booksCount} loading={dataLoading}/>}
          {activeTab==="orders"&&<OrdersTab orders={orders} onUpdateStatus={handleUpdateStatus} showToast={showToast}/>}
          {activeTab==="books"&&<BooksTab showToast={showToast}/>}
          {activeTab==="customers"&&<CustomersTab users={users} orders={orders}/>}
          {activeTab==="payments"&&<PlaceholderTab icon="💳" title="Payments" description="View M-Pesa transactions, card payments, refund history, and payout reports."/>}
          {activeTab==="reports"&&<PlaceholderTab icon="📈" title="Reports" description="Generate sales, inventory, customer, and revenue reports. Export as CSV or PDF."/>}
          {activeTab==="inventory"&&<PlaceholderTab icon="🏪" title="Inventory" description="Track stock levels, low stock alerts, and restock suggestions."/>}
          {activeTab==="reviews"&&<PlaceholderTab icon="⭐" title="Reviews" description="Manage customer reviews and ratings for all books."/>}
          {activeTab==="coupons"&&<PlaceholderTab icon="🏷️" title="Coupons" description="Create and manage discount codes and promotional offers."/>}
          {activeTab==="users"&&<UsersTab users={users} orders={orders} session={sessionUser} showToast={showToast}/>}
          {activeTab==="activity"&&<PlaceholderTab icon="📋" title="Activity Logs" description="Track all admin actions, logins, and system events."/>}
          {activeTab==="settings"&&<PlaceholderTab icon="⚙️" title="Settings" description="Configure store information, payment gateways, email templates, and more."/>}
        </main>
      </div>
    </div>
  );
}