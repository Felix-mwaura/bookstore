"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import localBooks from   "../books";
async function checkAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
  return profile?.role === "admin";
}

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = "bg-white" }) {
  return (
    <div className={`${color} rounded-2xl border border-stone-200 p-5 sm:p-6`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{label}</p>
          <p className="text-2xl sm:text-3xl font-black text-[#1C1917] mt-1">{value}</p>
          {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────
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

// ── Mini bar chart ────────────────────────────────────────
function MiniBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full bg-[#991B1B] rounded-t-sm transition-all duration-500"
            style={{ height: `${(d.value / max) * 64}px`, minHeight: d.value > 0 ? "4px" : "0" }} />
          <span className="text-[9px] text-stone-400 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────
function OverviewTab({ orders, users }) {
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length;
  const delivered = orders.filter(o => o.status === "Delivered").length;
  const processing = orders.filter(o => o.status === "Processing").length;

  // Monthly revenue for last 6 months
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const chartData = [...Array(6)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const monthOrders = orders.filter(o => {
      const od = new Date(o.created_at);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    });
    return { label: months[d.getMonth()], value: monthOrders.reduce((s, o) => s + (o.total || 0), 0) };
  });

  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💰" label="Total Revenue" value={`KSh ${totalRevenue.toLocaleString()}`} sub="All time" />
        <StatCard icon="📦" label="Total Orders" value={orders.length} sub={`${todayOrders} today`} />
        <StatCard icon="👥" label="Registered Users" value={users.length} sub="All time" />
        <StatCard icon="📚" label="Books in Catalogue" value={localBooks.length} sub="Active listings" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
          <h3 className="font-bold text-[#1C1917] mb-1">Revenue (Last 6 Months)</h3>
          <p className="text-xs text-stone-400 mb-5">KSh {totalRevenue.toLocaleString()} total</p>
          <MiniBarChart data={chartData} />
        </div>

        {/* Order status breakdown */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
          <h3 className="font-bold text-[#1C1917] mb-5">Order Status Breakdown</h3>
          <div className="space-y-4">
            {[
              { label: "Processing", count: processing, color: "bg-amber-400", pct: orders.length ? (processing / orders.length) * 100 : 0 },
              { label: "Shipped", count: orders.filter(o => o.status === "Shipped").length, color: "bg-blue-400", pct: orders.length ? (orders.filter(o => o.status === "Shipped").length / orders.length) * 100 : 0 },
              { label: "Delivered", count: delivered, color: "bg-green-500", pct: orders.length ? (delivered / orders.length) * 100 : 0 },
              { label: "Cancelled", count: orders.filter(o => o.status === "Cancelled").length, color: "bg-red-400", pct: orders.length ? (orders.filter(o => o.status === "Cancelled").length / orders.length) * 100 : 0 },
            ].map(({ label, count, color, pct }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-stone-600">{label}</span>
                  <span className="font-bold text-[#1C1917]">{count}</span>
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
          <span className="text-xs text-stone-400">{orders.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Order ID", "Customer", "Items", "Total", "Status", "Date"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {recentOrders.map(order => (
                <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{order.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1C1917] text-xs">{order.delivery_details?.firstName} {order.delivery_details?.lastName}</p>
                    <p className="text-stone-400 text-xs">{order.delivery_details?.city}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{(order.items || []).length} book{(order.items || []).length !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3 font-bold text-[#1C1917] text-xs">KSh {(order.total || 0).toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">{new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400 text-sm">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Books Tab ─────────────────────────────────────────────
function BooksTab() {
  const [bookList, setBookList] = useState(localBooks);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [form, setForm] = useState({ title: "", author: "", price: "", originalPrice: "", category: "", format: "Paperback", badge: "", stock: "In Stock", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const categories = ["Self-Help", "Finance", "Productivity", "Psychology", "History", "Philosophy", "Fiction", "Biography"];

  const filtered = bookList.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase()) ||
    b.category.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditBook(null); setForm({ title: "", author: "", price: "", originalPrice: "", category: categories[0], format: "Paperback", badge: "", stock: "In Stock", description: "" }); setShowForm(true); };
  const openEdit = (book) => { setEditBook(book); setForm({ title: book.title, author: book.author, price: book.price, originalPrice: book.originalPrice || "", category: book.category, format: book.format, badge: book.badge || "", stock: book.stock, description: book.description || "" }); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600)); // Simulate save
    if (editBook) {
      setBookList(prev => prev.map(b => b.id === editBook.id ? { ...b, ...form, price: Number(form.price), originalPrice: form.originalPrice ? Number(form.originalPrice) : null } : b));
    } else {
      const newBook = { ...form, id: Date.now(), price: Number(form.price), originalPrice: form.originalPrice ? Number(form.originalPrice) : null, rating: 4.5, reviews: 0, cover: { bg: "#1C1917", accent: "#991B1B", pattern: "dots" }, tags: [] };
      setBookList(prev => [...prev, newBook]);
    }
    setSaving(false);
    setShowForm(false);
  };

  const confirmDelete = (id) => setDeleteId(id);
  const deleteBook = () => { setBookList(prev => prev.filter(b => b.id !== deleteId)); setDeleteId(null); };

  const InputField = ({ label, name, type = "text", placeholder, half }) => (
    <div className={half ? "" : "sm:col-span-2"}>
      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
      <input type={type} value={form[name]} placeholder={placeholder}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B]/20 transition" />
    </div>
  );

  return (
    <div>
      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-[#1C1917] text-lg mb-2">Delete Book?</h3>
            <p className="text-stone-500 text-sm mb-6">This action cannot be undone. The book will be removed from the catalogue.</p>
            <div className="flex gap-3">
              <button onClick={deleteBook} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm transition">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl font-bold text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">Books Catalogue</h2>
          <p className="text-stone-500 text-sm">{bookList.length} titles</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Book
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-[#1C1917] mb-4">{editBook ? "Edit Book" : "Add New Book"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Title" name="title" placeholder="Book title" />
            <InputField label="Author" name="author" placeholder="Author name" half />
            <InputField label="Price (KSh)" name="price" type="number" placeholder="1299" half />
            <InputField label="Original Price (KSh)" name="originalPrice" type="number" placeholder="Leave blank if no discount" half />
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Format</label>
              <select value={form.format} onChange={e => setForm(p => ({ ...p, format: e.target.value }))}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                {["Paperback", "Hardcover", "eBook"].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Badge</label>
              <select value={form.badge} onChange={e => setForm(p => ({ ...p, badge: e.target.value }))}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                <option value="">No badge</option>
                {["Bestseller", "New", "Trending", "Staff Pick", "Award Winner", "Classic", "Top Rated"].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Stock Status</label>
              <select value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                {["In Stock", "Out of Stock", "Only 3 left", "Only 1 left", "Pre-order"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Book description..."
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving || !form.title || !form.price}
              className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] disabled:bg-stone-200 disabled:text-stone-400 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Saving…</> : editBook ? "Save Changes" : "Add Book"}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-stone-200 text-stone-600 px-5 py-2.5 rounded-xl font-semibold text-sm transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search books..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition" />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Books table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Title", "Category", "Price", "Stock", "Badge", "Rating", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(book => (
                <tr key={book.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1C1917] text-sm">{book.title}</p>
                    <p className="text-stone-400 text-xs">{book.author}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">{book.category}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#1C1917] text-xs">KSh {book.price.toLocaleString()}</p>
                    {book.originalPrice && <p className="text-stone-400 text-xs line-through">KSh {book.originalPrice.toLocaleString()}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${book.stock === "In Stock" ? "text-green-600" : book.stock === "Out of Stock" ? "text-red-600" : "text-amber-600"}`}>
                      {book.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {book.badge ? <span className="px-2 py-0.5 bg-[#991B1B] text-white text-[10px] font-bold rounded-md">{book.badge}</span> : <span className="text-stone-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      <span className="text-xs font-semibold text-stone-600">{book.rating}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(book)} className="text-xs text-stone-400 hover:text-[#991B1B] font-semibold transition">Edit</button>
                      <button onClick={() => confirmDelete(book.id)} className="text-xs text-stone-400 hover:text-red-600 font-semibold transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────
function OrdersTab({ orders, onUpdateStatus }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updating, setUpdating] = useState(null);

  const statuses = ["All", "Processing", "Shipped", "Delivered", "Cancelled"];

  const filtered = orders.filter(o => {
    const matchesSearch = !search ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      `${o.delivery_details?.firstName} ${o.delivery_details?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      o.delivery_details?.city?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (!error) onUpdateStatus(orderId, newStatus);
    setUpdating(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">All Orders</h2>
          <p className="text-stone-500 text-sm">{orders.length} total orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order ID, customer, city..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${statusFilter === s ? "bg-[#1C1917] text-white" : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Order ID", "Customer", "Items", "Total", "Payment", "Status", "Date", "Update Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{order.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1C1917] text-xs">{order.delivery_details?.firstName} {order.delivery_details?.lastName}</p>
                    <p className="text-stone-400 text-xs">{order.delivery_details?.city}</p>
                    <p className="text-stone-400 text-xs">{order.delivery_details?.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {(order.items || []).slice(0, 2).map((item, i) => (
                        <p key={i} className="text-xs text-stone-500 line-clamp-1">{item.title}</p>
                      ))}
                      {(order.items || []).length > 2 && <p className="text-xs text-stone-400">+{(order.items || []).length - 2} more</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#1C1917] text-xs whitespace-nowrap">KSh {(order.total || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">{order.payment_method}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">
                    {new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      onChange={e => updateStatus(order.id, e.target.value)}
                      disabled={updating === order.id}
                      className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#991B1B] transition disabled:opacity-50 cursor-pointer"
                    >
                      {["Processing", "Shipped", "Delivered", "Cancelled"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400 text-sm">No orders found</td></tr>
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

  const filtered = users.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    `${u.user_metadata?.first_name} ${u.user_metadata?.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const getUserOrders = (userId) => orders.filter(o => o.user_id === userId);
  const getUserRevenue = (userId) => getUserOrders(userId).reduce((s, o) => s + (o.total || 0), 0);

  const toggleRole = async (userId, currentRole) => {
    setUpdating(userId);
    const newRole = currentRole === "admin" ? "customer" : "admin";
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    setUpdating(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">Registered Users</h2>
          <p className="text-stone-500 text-sm">{users.length} total users</p>
        </div>
      </div>

      <div className="relative mb-5">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition" />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["User", "Joined", "Orders", "Total Spent", "Role", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(user => {
                const meta = user.user_metadata || {};
                const name = `${meta.first_name || ""} ${meta.last_name || ""}`.trim() || "—";
                const userOrders = getUserOrders(user.id);
                const isCurrentUser = user.id === session?.user?.id;
                return (
                  <tr key={user.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#991B1B]/10 flex items-center justify-center text-[#991B1B] font-black text-sm flex-shrink-0">
                          {(meta.first_name || user.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#1C1917] text-xs">{name} {isCurrentUser && <span className="text-[#991B1B] text-[10px]">(you)</span>}</p>
                          <p className="text-stone-400 text-xs">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#1C1917] text-xs">{userOrders.length}</td>
                    <td className="px-4 py-3 font-bold text-[#1C1917] text-xs whitespace-nowrap">KSh {getUserRevenue(user.id).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${user.role === "admin" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-stone-50 text-stone-600 border-stone-200"}`}>
                        {user.role || "customer"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isCurrentUser && (
                        <button
                          onClick={() => toggleRole(user.id, user.role)}
                          disabled={updating === user.id}
                          className="text-xs text-stone-400 hover:text-[#991B1B] font-semibold transition disabled:opacity-50"
                        >
                          {updating === user.id ? "…" : user.role === "admin" ? "Remove Admin" : "Make Admin"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400 text-sm">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────
const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "books", label: "Books", icon: "📚" },
  { id: "orders", label: "Orders", icon: "📦" },
  { id: "users", label: "Users", icon: "👥" },
];

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Auth check
  useEffect(() => {
    const check = async () => {
      const isAdmin = await checkAdmin();
      if (!isAdmin) { router.push("/"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setAuthorized(true);
      setLoading(false);
    };
    check();
  }, []);

  // Fetch data
  useEffect(() => {
    if (!authorized) return;
    const fetchData = async () => {
      setDataLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      // Fetch all orders (admin can read all via service role or RLS)
      const { data: ordersData } = await supabase.from("orders").select("*").order("created_at", { ascending: false });

      // Fetch all profiles joined with auth users (admin only)
      const { data: profilesData } = await supabase.from("profiles").select("id, role, created_at");

      // Get user emails from session user (we can only get emails we have access to)
      // Combine profile data with what we know
      const usersWithRoles = (profilesData || []).map(p => ({
        ...p,
        email: p.id === session?.user?.id ? session.user.email : `user_${p.id.slice(0, 6)}@private`,
        user_metadata: p.id === session?.user?.id ? session.user.user_metadata : {},
      }));

      setOrders(ordersData || []);
      setUsers(usersWithRoles);
      setDataLoading(false);
    };
    fetchData();
  }, [authorized]);

  const handleUpdateStatus = (orderId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin mx-auto" />
        <p className="text-stone-500 text-sm">Verifying access…</p>
      </div>
    </div>
  );

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Admin header */}
      <header className="bg-[#1C1917] text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl sm:text-2xl">📚</span>
            <div>
              <p className="font-black text-sm sm:text-base leading-none">Book Haven</p>
              <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-stone-400 hover:text-white transition hidden sm:block">← View Store</Link>
            <button onClick={handleLogout} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
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
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? "border-[#991B1B] text-[#991B1B]" : "border-transparent text-stone-500 hover:text-[#1C1917]"}`}>
                <span>{tab.icon}</span> {tab.label}
                {tab.id === "orders" && orders.filter(o => o.status === "Processing").length > 0 && (
                  <span className="bg-[#991B1B] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {orders.filter(o => o.status === "Processing").length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {dataLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab orders={orders} users={users} />}
            {activeTab === "books" && <BooksTab />}
            {activeTab === "orders" && <OrdersTab orders={orders} onUpdateStatus={handleUpdateStatus} />}
            {activeTab === "users" && <UsersTab users={users} orders={orders} session={session} />}
          </>
        )}
      </main>
    </div>
  );
}