"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ icon, label, value, sub, highlight }) {
  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${highlight ? "bg-[#1C1917] border-[#1C1917]" : "bg-white border-stone-200"}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${highlight ? "text-stone-400" : "text-stone-400"}`}>{label}</p>
          <p className={`text-2xl sm:text-3xl font-black mt-1 ${highlight ? "text-amber-400" : "text-[#1C1917]"}`}>{value}</p>
          {sub && <p className={`text-xs mt-1 ${highlight ? "text-stone-400" : "text-stone-400"}`}>{sub}</p>}
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = {
    Processing: "bg-amber-50 text-amber-700 border-amber-200",
    Shipped: "bg-blue-50 text-blue-700 border-blue-200",
    Delivered: "bg-green-50 text-green-700 border-green-200",
    Cancelled: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${s[status] || "bg-stone-50 text-stone-600 border-stone-200"}`}>
      {status}
    </span>
  );
}

function MiniBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <p className="text-[9px] text-stone-400 font-medium">
            {d.value > 0 ? `${(d.value/1000).toFixed(0)}k` : ""}
          </p>
          <div className="w-full bg-[#991B1B]/20 rounded-t-sm relative flex-1 flex items-end">
            <div className="w-full bg-[#991B1B] rounded-t-sm transition-all duration-700"
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 5 : 0)}%` }} />
          </div>
          <span className="text-[9px] text-stone-400 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 whitespace-nowrap text-white transition-all ${toast.type === "error" ? "bg-red-600" : "bg-[#1C1917]"}`}>
      <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
      <span className="text-sm font-medium">{toast.msg}</span>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────
function OverviewTab({ orders, users, booksCount }) {
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length;
  const processing = orders.filter(o => o.status === "Processing").length;
  const delivered = orders.filter(o => o.status === "Delivered").length;
  const thisMonth = orders.filter(o => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, o) => s + (o.total || 0), 0);

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const chartData = [...Array(6)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const mo = orders.filter(o => {
      const od = new Date(o.created_at);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    });
    return { label: months[d.getMonth()], value: mo.reduce((s, o) => s + (o.total || 0), 0) };
  });

  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💰" label="Total Revenue" value={`KSh ${totalRevenue.toLocaleString()}`} sub="All time" highlight />
        <StatCard icon="📦" label="Total Orders" value={orders.length} sub={`${todayOrders} today`} />
        <StatCard icon="👥" label="Users" value={users.length} sub="Registered" />
        <StatCard icon="📚" label="Books" value={booksCount} sub="In catalogue" />
      </div>

      {/* This month highlight */}
      <div className="bg-gradient-to-r from-[#991B1B] to-[#7F1D1D] rounded-2xl p-5 sm:p-6 text-white flex items-center justify-between">
        <div>
          <p className="text-red-200 text-xs font-bold uppercase tracking-widest mb-1">This Month's Revenue</p>
          <p className="text-3xl sm:text-4xl font-black">KSh {thisMonth.toLocaleString()}</p>
          <p className="text-red-200 text-sm mt-1">{orders.filter(o => { const d = new Date(o.created_at); const n = new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }).length} orders this month</p>
        </div>
        <div className="text-6xl opacity-30">💰</div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#1C1917]">Revenue Trend</h3>
              <p className="text-xs text-stone-400 mt-0.5">Last 6 months</p>
            </div>
            <span className="text-xs font-bold text-[#991B1B] bg-[#991B1B]/10 px-3 py-1 rounded-full">
              KSh {totalRevenue.toLocaleString()} total
            </span>
          </div>
          <MiniBarChart data={chartData} />
        </div>

        {/* Order status */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
          <h3 className="font-bold text-[#1C1917] mb-5">Order Status Breakdown</h3>
          <div className="space-y-4">
            {[
              { label: "Processing", count: processing, color: "bg-amber-400", pct: orders.length ? (processing/orders.length)*100 : 0 },
              { label: "Shipped", count: orders.filter(o=>o.status==="Shipped").length, color: "bg-blue-400", pct: orders.length ? (orders.filter(o=>o.status==="Shipped").length/orders.length)*100 : 0 },
              { label: "Delivered", count: delivered, color: "bg-green-500", pct: orders.length ? (delivered/orders.length)*100 : 0 },
              { label: "Cancelled", count: orders.filter(o=>o.status==="Cancelled").length, color: "bg-red-400", pct: orders.length ? (orders.filter(o=>o.status==="Cancelled").length/orders.length)*100 : 0 },
            ].map(({ label, count, color, pct }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-stone-600">{label}</span>
                  <span className="font-bold text-[#1C1917]">{count} <span className="text-stone-400 font-normal text-xs">({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-[#1C1917]">Recent Orders</h3>
          <span className="text-xs font-semibold text-[#991B1B] bg-[#991B1B]/10 px-3 py-1 rounded-full">{orders.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Order ID","Customer","City","Items","Total","Payment","Status","Date"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {recentOrders.map(order => (
                <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{order.id.slice(0,8).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1C1917] text-xs">{order.delivery_details?.firstName} {order.delivery_details?.lastName}</p>
                    <p className="text-stone-400 text-xs">{order.delivery_details?.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{order.delivery_details?.city}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{(order.items||[]).length}</td>
                  <td className="px-4 py-3 font-bold text-[#1C1917] text-xs whitespace-nowrap">KSh {(order.total||0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">{order.payment_method}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">{new Date(order.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short"})}</td>
                </tr>
              ))}
              {recentOrders.length===0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400 text-sm">No orders yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Books Tab ─────────────────────────────────────────────
function BooksTab() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ title:"",author:"",price:"",original_price:"",category:"Self-Help",format:"Paperback",badge:"",stock:"In Stock",description:"",pages:"",publisher:"",year:"" });

  const categories = ["Self-Help","Finance","Productivity","Psychology","History","Philosophy","Fiction","Biography"];
  const coverMap = { "Self-Help":["#2d4a22","#86efac"],"Finance":["#0f3460","#fbbf24"],"Productivity":["#1b1b2f","#f87171"],"Psychology":["#3b1f5e","#a78bfa"],"History":["#2c1810","#fb923c"],"Philosophy":["#0d0d0d","#f9a8d4"],"Fiction":["#1a3a4a","#67e8f9"],"Biography":["#1c3a5e","#6ee7b7"] };

  const showToast = (msg, type="success") => { setToast({ msg, type }); setTimeout(()=>setToast(null),3500); };

  const loadBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("books").select("*").order("id");
    if (error) showToast("Failed to load books: "+error.message,"error");
    else setBooks(data||[]);
    setLoading(false);
  };

  useEffect(()=>{ loadBooks(); },[]);

  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase()) ||
    b.category.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => setForm({ title:"",author:"",price:"",original_price:"",category:"Self-Help",format:"Paperback",badge:"",stock:"In Stock",description:"",pages:"",publisher:"",year:"" });

  const openAdd = () => { setEditBook(null); resetForm(); setShowForm(true); window.scrollTo({top:0,behavior:"smooth"}); };
  const openEdit = (book) => {
    setEditBook(book);
    setForm({ title:book.title,author:book.author,price:book.price,original_price:book.original_price||"",category:book.category,format:book.format,badge:book.badge||"",stock:book.stock,description:book.description||"",pages:book.pages||"",publisher:book.publisher||"",year:book.year||"" });
    setShowForm(true);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const save = async () => {
    if (!form.title.trim()||!form.price) { showToast("Title and price are required","error"); return; }
    setSaving(true);
    const [bg,accent] = coverMap[form.category]||["#1C1917","#991B1B"];
    const payload = {
      title:form.title.trim(), author:form.author.trim(), price:Number(form.price),
      original_price:form.original_price?Number(form.original_price):null,
      category:form.category, format:form.format, badge:form.badge||null,
      stock:form.stock, description:form.description.trim(),
      pages:form.pages?Number(form.pages):null, publisher:form.publisher.trim(),
      year:form.year?Number(form.year):null,
      cover:{ bg, accent, pattern:"dots" },
    };
    if (editBook) {
      const { error } = await supabase.from("books").update(payload).eq("id",editBook.id);
      if (error) showToast("Update failed: "+error.message,"error");
      else { showToast(`"${form.title}" updated!`); await loadBooks(); setShowForm(false); }
    } else {
      const { error } = await supabase.from("books").insert({...payload,rating:4.5,reviews:0,tags:[]});
      if (error) showToast("Add failed: "+error.message,"error");
      else { showToast(`"${form.title}" added to catalogue!`); await loadBooks(); setShowForm(false); }
    }
    setSaving(false);
  };

  const deleteBook = async () => {
    const { error } = await supabase.from("books").delete().eq("id",deleteId);
    if (error) showToast("Delete failed: "+error.message,"error");
    else { showToast("Book removed from catalogue"); await loadBooks(); }
    setDeleteId(null);
  };

  const updateStock = async (id, newStock) => {
    const { error } = await supabase.from("books").update({stock:newStock}).eq("id",id);
    if (!error) { setBooks(prev=>prev.map(b=>b.id===id?{...b,stock:newStock}:b)); showToast("Stock updated"); }
    else showToast("Stock update failed","error");
  };

  const Field = ({ label, name, type="text", placeholder, span2 }) => (
    <div className={span2?"sm:col-span-2":""}>
      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
      <input type={type} value={form[name]} placeholder={placeholder}
        onChange={e=>setForm(p=>({...p,[name]:e.target.value}))}
        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B]/20 transition" />
    </div>
  );

  const Select = ({ label, name, options }) => (
    <div>
      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
      <select value={form[name]} onChange={e=>setForm(p=>({...p,[name]:e.target.value}))}
        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
        {options.map(o=><option key={o.value||o}>{o.label||o}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <Toast toast={toast} />
      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-4xl text-center mb-3">🗑️</div>
            <h3 className="font-bold text-[#1C1917] text-lg text-center mb-2">Delete Book?</h3>
            <p className="text-stone-500 text-sm text-center mb-6">This will permanently remove the book from your catalogue and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={deleteBook} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-sm transition active:scale-95">Yes, Delete</button>
              <button onClick={()=>setDeleteId(null)} className="flex-1 border border-stone-200 text-stone-600 py-3 rounded-xl font-bold text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">Books Catalogue</h2>
          <p className="text-stone-500 text-sm">{books.length} titles in database</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Add New Book
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#1C1917] text-lg">{editBook?`Editing: ${editBook.title}`:"Add New Book"}</h3>
              <p className="text-stone-400 text-xs mt-0.5">{editBook?"Update book details below":"Fill in the details for the new book"}</p>
            </div>
            <button onClick={()=>setShowForm(false)} className="p-2 hover:bg-stone-100 rounded-full transition text-stone-400 hover:text-stone-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Title *" name="title" placeholder="Book title" span2 />
            <Field label="Author *" name="author" placeholder="Author full name" />
            <Field label="Price (KSh) *" name="price" type="number" placeholder="1299" />
            <Field label="Original Price (KSh)" name="original_price" type="number" placeholder="Leave blank if no discount" />
            <Field label="Original Price (KSh)" name="original_price" type="number" placeholder="1599 (blank = no discount)" />
            <Select label="Category" name="category" options={categories} />
            <Select label="Format" name="format" options={["Paperback","Hardcover","eBook"]} />
            <Select label="Badge" name="badge" options={["","Bestseller","New","Trending","Staff Pick","Award Winner","Classic","Top Rated"]} />
            <Select label="Stock Status" name="stock" options={["In Stock","Out of Stock","Only 3 left","Only 1 left","Pre-order"]} />
            <Field label="Pages" name="pages" type="number" placeholder="320" />
            <Field label="Publisher" name="publisher" placeholder="Publisher name" />
            <Field label="Year Published" name="year" type="number" placeholder="2024" />
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Description</label>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                rows={3} placeholder="Brief description of the book..."
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-stone-100">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] disabled:bg-stone-200 disabled:text-stone-400 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95">
              {saving?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Saving…</>:editBook?"Save Changes":"Add Book"}
            </button>
            <button onClick={()=>setShowForm(false)} className="border border-stone-200 text-stone-600 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-stone-50 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title, author or category..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition" />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        {search && <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">✕</button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin"/></div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">{filtered.length} books</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100">
                <tr>{["Title & Author","Category","Price","Stock","Badge","Rating","Actions"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(book=>(
                  <tr key={book.id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1C1917] text-sm">{book.title}</p>
                      <p className="text-stone-400 text-xs">{book.author}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded-full">{book.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#1C1917] text-xs">KSh {book.price.toLocaleString()}</p>
                      {book.original_price && <p className="text-stone-400 text-xs line-through">KSh {book.original_price.toLocaleString()}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <select value={book.stock} onChange={e=>updateStock(book.id,e.target.value)}
                        className={`text-xs font-semibold bg-transparent border-none outline-none cursor-pointer ${book.stock==="In Stock"?"text-green-600":book.stock==="Out of Stock"?"text-red-600":"text-amber-600"}`}>
                        {["In Stock","Out of Stock","Only 3 left","Only 1 left","Pre-order"].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {book.badge
                        ? <span className="px-2 py-0.5 bg-[#991B1B] text-white text-[10px] font-bold rounded-md">{book.badge}</span>
                        : <span className="text-stone-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        <span className="text-xs font-semibold text-stone-600">{book.rating}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>openEdit(book)} className="text-xs text-[#991B1B] font-semibold hover:underline">Edit</button>
                        <button onClick={()=>setDeleteId(book.id)} className="text-xs text-stone-400 hover:text-red-600 font-semibold">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length===0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center">
                    <div className="text-4xl mb-2">📚</div>
                    <p className="text-stone-400 text-sm">No books found</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────
function OrdersTab({ orders, users, onUpdateStatus }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updating, setUpdating] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const getUserName = (userId) => {
    const u = users.find(u=>u.id===userId);
    return u ? `${u.first_name||""} ${u.last_name||""}`.trim() || u.email : "Unknown";
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const name = `${o.delivery_details?.firstName||""} ${o.delivery_details?.lastName||""}`.toLowerCase();
    const matchesSearch = !search || o.id.toLowerCase().includes(q) || name.includes(q) || (o.delivery_details?.city||"").toLowerCase().includes(q) || (o.delivery_details?.phone||"").includes(q);
    return matchesSearch && (statusFilter==="All"||o.status===statusFilter);
  });

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    const { error } = await supabase.from("orders").update({status:newStatus}).eq("id",orderId);
    if (!error) { onUpdateStatus(orderId,newStatus); showToast(`Order updated to ${newStatus}`); }
    else showToast("Update failed: "+error.message,"error");
    setUpdating(null);
  };

  const totalRevenue = filtered.reduce((s,o)=>s+(o.total||0),0);

  return (
    <div>
      <Toast toast={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">All Orders</h2>
          <p className="text-stone-500 text-sm">{orders.length} total · KSh {totalRevenue.toLocaleString()} revenue</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by order ID, name, city or phone..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition"/>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All","Processing","Shipped","Delivered","Cancelled"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${statusFilter===s?"bg-[#1C1917] text-white":"bg-white border border-stone-200 text-stone-600 hover:border-stone-300"}`}>
              {s} {s!=="All"&&<span className="ml-1 opacity-60">({orders.filter(o=>o.status===s).length})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["","Order ID","Customer","Delivery Address","Books","Total","Payment","Status","Date","Update"].map(h=>(
                <th key={h} className="text-left px-3 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(order=>(
                <>
                  <tr key={order.id} className="hover:bg-stone-50/50 transition-colors cursor-pointer" onClick={()=>setExpanded(expanded===order.id?null:order.id)}>
                    <td className="px-3 py-3">
                      <svg className={`w-4 h-4 text-stone-400 transition-transform ${expanded===order.id?"rotate-90":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-stone-500">{order.id.slice(0,8).toUpperCase()}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#1C1917] text-xs">{order.delivery_details?.firstName} {order.delivery_details?.lastName}</p>
                      <p className="text-stone-400 text-xs">{order.delivery_details?.phone}</p>
                      <p className="text-stone-400 text-xs">{order.delivery_details?.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-stone-600 text-xs">{order.delivery_details?.address}</p>
                      <p className="text-stone-400 text-xs">{order.delivery_details?.city}</p>
                    </td>
                    <td className="px-3 py-3 text-stone-500 text-xs">{(order.items||[]).length} book{(order.items||[]).length!==1?"s":""}</td>
                    <td className="px-3 py-3 font-bold text-[#1C1917] text-xs whitespace-nowrap">KSh {(order.total||0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-stone-500 text-xs whitespace-nowrap">{order.payment_method}</td>
                    <td className="px-3 py-3"><StatusBadge status={order.status}/></td>
                    <td className="px-3 py-3 text-stone-400 text-xs whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}
                    </td>
                    <td className="px-3 py-3" onClick={e=>e.stopPropagation()}>
                      <select value={order.status} onChange={e=>updateStatus(order.id,e.target.value)} disabled={updating===order.id}
                        className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#991B1B] transition disabled:opacity-50 cursor-pointer">
                        {["Processing","Shipped","Delivered","Cancelled"].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                  {/* Expanded row — shows order items */}
                  {expanded===order.id && (
                    <tr key={`${order.id}-expanded`}>
                      <td colSpan={10} className="px-6 py-4 bg-stone-50 border-t border-stone-100">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Order Items</p>
                        <div className="space-y-2">
                          {(order.items||[]).map((item,i)=>(
                            <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-stone-100">
                              <div>
                                <p className="font-semibold text-[#1C1917] text-sm">{item.title}</p>
                                <p className="text-stone-400 text-xs">{item.author} · {item.format}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-[#1C1917] text-sm">KSh {(item.price*(item.quantity||1)).toLocaleString()}</p>
                                <p className="text-stone-400 text-xs">Qty: {item.quantity||1}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.delivery_details?.notes && (
                          <p className="text-xs text-stone-500 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            📝 Note: {order.delivery_details.notes}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center">
                  <div className="text-4xl mb-2">📦</div>
                  <p className="text-stone-400 text-sm">No orders found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────
function UsersTab({ users, orders, session }) {
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(null);
  const [localUsers, setLocalUsers] = useState(users);
  const [toast, setToast] = useState(null);

  useEffect(()=>setLocalUsers(users),[users]);

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const filtered = localUsers.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    `${u.first_name||""} ${u.last_name||""}`.toLowerCase().includes(search.toLowerCase()) ||
    (u.phone||"").includes(search)
  );

  const getUserOrders = (userId) => orders.filter(o=>o.user_id===userId);
  const getUserRevenue = (userId) => getUserOrders(userId).reduce((s,o)=>s+(o.total||0),0);

  const toggleRole = async (userId, currentRole) => {
    setUpdating(userId);
    const newRole = currentRole==="admin"?"customer":"admin";
    const { error } = await supabase.from("profiles").update({role:newRole}).eq("id",userId);
    if (!error) { setLocalUsers(prev=>prev.map(u=>u.id===userId?{...u,role:newRole}:u)); showToast(`User role updated to ${newRole}`); }
    else showToast("Role update failed: "+error.message,"error");
    setUpdating(null);
  };

  const totalUsers = localUsers.length;
  const adminCount = localUsers.filter(u=>u.role==="admin").length;
  const activeUsers = localUsers.filter(u=>getUserOrders(u.id).length>0).length;

  return (
    <div>
      <Toast toast={toast}/>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">Registered Users</h2>
          <p className="text-stone-500 text-sm">{totalUsers} total · {adminCount} admin{adminCount!==1?"s":""} · {activeUsers} with orders</p>
        </div>
      </div>

      {/* User stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
          <p className="text-2xl font-black text-[#1C1917]">{totalUsers}</p>
          <p className="text-xs text-stone-400 mt-0.5">Total Users</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
          <p className="text-2xl font-black text-purple-600">{adminCount}</p>
          <p className="text-xs text-stone-400 mt-0.5">Admins</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
          <p className="text-2xl font-black text-green-600">{activeUsers}</p>
          <p className="text-xs text-stone-400 mt-0.5">Have Ordered</p>
        </div>
      </div>

      <div className="relative mb-5">
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email or phone..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition"/>
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["User","Email","Phone","Joined","Orders","Total Spent","Role","Actions"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(user=>{
                const isCurrentUser = user.id===session?.user?.id;
                const userOrders = getUserOrders(user.id);
                const revenue = getUserRevenue(user.id);
                return (
                  <tr key={user.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                          style={{ backgroundColor: user.role==="admin"?"#7c3aed":"#991B1B" }}>
                          {(user.first_name||user.email||"?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#1C1917] text-xs">
                            {user.first_name||""} {user.last_name||""}
                            {!user.first_name&&!user.last_name&&<span className="text-stone-400">No name</span>}
                            {isCurrentUser&&<span className="text-[#991B1B] text-[10px] ml-1">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-xs">{user.email||"—"}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{user.phone||<span className="text-stone-300">—</span>}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-xs ${userOrders.length>0?"text-[#1C1917]":"text-stone-400"}`}>{userOrders.length}</span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={`font-bold ${revenue>0?"text-green-600":"text-stone-400"}`}>
                        {revenue>0?`KSh ${revenue.toLocaleString()}`:"—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${user.role==="admin"?"bg-purple-50 text-purple-700 border-purple-200":"bg-stone-50 text-stone-600 border-stone-200"}`}>
                        {user.role||"customer"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isCurrentUser&&(
                        <button onClick={()=>toggleRole(user.id,user.role)} disabled={updating===user.id}
                          className={`text-xs font-semibold transition disabled:opacity-50 ${user.role==="admin"?"text-purple-600 hover:text-red-600":"text-stone-400 hover:text-[#991B1B]"}`}>
                          {updating===user.id?"…":user.role==="admin"?"Remove Admin":"Make Admin"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&(
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="text-stone-400 text-sm">No users found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────
const TABS = [
  { id:"overview", label:"Overview", icon:"📊" },
  { id:"books", label:"Books", icon:"📚" },
  { id:"orders", label:"Orders", icon:"📦" },
  { id:"users", label:"Users", icon:"👥" },
];

// ── Main Admin Client ─────────────────────────────────────
export default function AdminClient({ initialOrders, initialUsers, initialBooksCount, sessionUser }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState(initialOrders);
  const [users] = useState(initialUsers);
  const [booksCount] = useState(initialBooksCount);

  const handleUpdateStatus = useCallback((orderId, newStatus) => {
    setOrders(prev=>prev.map(o=>o.id===orderId?{...o,status:newStatus}:o));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const processingCount = orders.filter(o=>o.status==="Processing").length;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="bg-[#1C1917] text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl sm:text-2xl">📚</span>
            <div>
              <p className="font-black text-sm sm:text-base leading-none">Book Haven</p>
              <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-stone-400 hover:text-white transition hidden sm:block">
              ← View Store
            </Link>
            <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[#1C1917] font-black text-[10px]">
                {(sessionUser?.email||"A").charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-stone-300 max-w-[140px] truncate">{sessionUser?.email}</span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7"/>
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="bg-white border-b border-stone-200 sticky top-14 sm:top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex overflow-x-auto">
            {TABS.map(tab=>(
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${activeTab===tab.id?"border-[#991B1B] text-[#991B1B] bg-[#991B1B]/5":"border-transparent text-stone-500 hover:text-[#1C1917] hover:bg-stone-50"}`}>
                <span className="text-base">{tab.icon}</span>
                {tab.label}
                {tab.id==="orders"&&processingCount>0&&(
                  <span className="bg-[#991B1B] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {processingCount}
                  </span>
                )}
                {tab.id==="users"&&users.length>0&&(
                  <span className="bg-stone-200 text-stone-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {users.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab==="overview"&&<OverviewTab orders={orders} users={users} booksCount={booksCount}/>}
        {activeTab==="books"&&<BooksTab/>}
        {activeTab==="orders"&&<OrdersTab orders={orders} users={users} onUpdateStatus={handleUpdateStatus}/>}
        {activeTab==="users"&&<UsersTab users={users} orders={orders} session={{user:sessionUser}}/>}
      </main>
    </div>
  );
}