"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
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
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d, i) => (
        <div key={`bar-${i}`} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full bg-[#991B1B] rounded-t-sm transition-all duration-500"
            style={{ height: `${(d.value / max) * 64}px`, minHeight: d.value > 0 ? "4px" : "0" }} />
          <span className="text-[9px] text-stone-400 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────
function OverviewTab({ orders, users, booksCount }) {
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length;
  const processing = orders.filter(o => o.status === "Processing").length;
  const delivered = orders.filter(o => o.status === "Delivered").length;

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💰" label="Total Revenue" value={`KSh ${totalRevenue.toLocaleString()}`} sub="All time" />
        <StatCard icon="📦" label="Total Orders" value={orders.length} sub={`${todayOrders} today`} />
        <StatCard icon="👥" label="Registered Users" value={users.length} />
        <StatCard icon="📚" label="Books in Catalogue" value={booksCount} sub="Active listings" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
          <h3 className="font-bold text-[#1C1917] mb-1">Revenue (Last 6 Months)</h3>
          <p className="text-xs text-stone-400 mb-5">KSh {totalRevenue.toLocaleString()} total</p>
          <MiniBarChart data={chartData} />
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
          <h3 className="font-bold text-[#1C1917] mb-5">Order Status</h3>
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

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-[#1C1917]">Recent Orders</h3>
          <span className="text-xs text-stone-400">{orders.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Order ID","Customer","Items","Total","Status","Date"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {recentOrders.map(order => (
                <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{order.id.slice(0,8).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1C1917] text-xs">{order.delivery_details?.firstName} {order.delivery_details?.lastName}</p>
                    <p className="text-stone-400 text-xs">{order.delivery_details?.city}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{(order.items||[]).length} book{(order.items||[]).length!==1?"s":""}</td>
                  <td className="px-4 py-3 font-bold text-[#1C1917] text-xs">KSh {(order.total||0).toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">{new Date(order.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short"})}</td>
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

// ── Books Tab — full Supabase CRUD ────────────────────────
function BooksTab() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    title: "", author: "", price: "", original_price: "",
    category: "Self-Help", format: "Paperback", badge: "",
    stock: "In Stock", description: "", pages: "", publisher: "", year: "",
  });

  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  const categories = ["Self-Help","Finance","Productivity","Psychology","History","Philosophy","Fiction","Biography"];
  const coverPatterns = {
    "Self-Help":"#2d4a22","Finance":"#0f3460","Productivity":"#1b1b2f",
    "Psychology":"#3b1f5e","History":"#2c1810","Philosophy":"#0d0d0d",
    "Fiction":"#1a3a4a","Biography":"#1c3a5e"
  };
  const accentColors = {
    "Self-Help":"#86efac","Finance":"#fbbf24","Productivity":"#f87171",
    "Psychology":"#a78bfa","History":"#fb923c","Philosophy":"#f9a8d4",
    "Fiction":"#67e8f9","Biography":"#6ee7b7"
  };

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => { if (isMountedRef.current) setToast(null); }, 3000);
  }, []);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("books").select("*").order("id");
      if (!isMountedRef.current) return;
      if (error) { showToast("Failed to load books: " + error.message, "error"); }
      else setBooks(data || []);
    } catch (err) {
      if (isMountedRef.current) showToast("Network error loading books", "error");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase()) ||
    b.category.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditBook(null);
    setForm({ title:"",author:"",price:"",original_price:"",category:"Self-Help",format:"Paperback",badge:"",stock:"In Stock",description:"",pages:"",publisher:"",year:"" });
    setShowForm(true);
  };

  const openEdit = (book) => {
    setEditBook(book);
    setForm({
      title: book.title, author: book.author, price: book.price,
      original_price: book.original_price || "", category: book.category,
      format: book.format, badge: book.badge || "", stock: book.stock,
      description: book.description || "", pages: book.pages || "",
      publisher: book.publisher || "", year: book.year || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (!form.title.trim() || !form.price) { showToast("Title and price are required", "error"); return; }
    setSaving(true);

    const cover = {
      bg: coverPatterns[form.category] || "#1C1917",
      accent: accentColors[form.category] || "#991B1B",
      pattern: form.category === "Fiction" ? "waves" : form.category === "History" ? "lines" : "dots"
    };

    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      price: Number(form.price),
      original_price: form.original_price ? Number(form.original_price) : null,
      category: form.category,
      format: form.format,
      badge: form.badge || null,
      stock: form.stock,
      description: form.description.trim(),
      pages: form.pages ? Number(form.pages) : null,
      publisher: form.publisher.trim(),
      year: form.year ? Number(form.year) : null,
      cover,
    };

    try {
      if (editBook) {
        const { error } = await supabase.from("books").update(payload).eq("id", editBook.id);
        if (error) { showToast("Failed to update: " + error.message, "error"); }
        else { showToast(`"${form.title}" updated successfully`); await loadBooks(); setShowForm(false); }
      } else {
        const { error } = await supabase.from("books").insert({ ...payload, rating: 4.5, reviews: 0, tags: [] });
        if (error) { showToast("Failed to add: " + error.message, "error"); }
        else { showToast(`"${form.title}" added to catalogue`); await loadBooks(); setShowForm(false); }
      }
    } catch (err) {
      showToast("Network error while saving", "error");
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  const deleteBook = async () => {
    try {
      const { error } = await supabase.from("books").delete().eq("id", deleteId);
      if (error) { showToast("Failed to delete: " + error.message, "error"); }
      else { showToast("Book removed from catalogue"); await loadBooks(); }
    } catch (err) {
      showToast("Network error while deleting", "error");
    } finally {
      if (isMountedRef.current) setDeleteId(null);
    }
  };

  const updateStock = async (id, newStock) => {
    try {
      const { error } = await supabase.from("books").update({ stock: newStock }).eq("id", id);
      if (!error) {
        setBooks(prev => prev.map(b => b.id === id ? { ...b, stock: newStock } : b));
        showToast("Stock updated");
      } else {
        showToast("Failed to update stock", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  const InputField = ({ label, name, type="text", placeholder, span2 }) => (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
      <input type={type} value={form[name]} placeholder={placeholder}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B]/20 transition" />
    </div>
  );

  return (
    <div>
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 whitespace-nowrap ${toast.type === "error" ? "bg-red-600" : "bg-[#1C1917]"} text-white`}>
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-[#1C1917] text-lg mb-2">Delete Book?</h3>
            <p className="text-stone-500 text-sm mb-6">This will permanently remove the book from your catalogue.</p>
            <div className="flex gap-3">
              <button onClick={deleteBook} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm transition">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl font-bold text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">Books Catalogue</h2>
          <p className="text-stone-500 text-sm">{books.length} titles in database</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add New Book
        </button>
      </div>

      {showForm && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1C1917]">{editBook ? `Editing: ${editBook.title}` : "Add New Book"}</h3>
            <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Title *" name="title" placeholder="Book title" span2 />
            <InputField label="Author *" name="author" placeholder="Author name" />
            <InputField label="Price (KSh) *" name="price" type="number" placeholder="1299" />
            <InputField label="Original Price (KSh)" name="original_price" type="number" placeholder="Leave blank if no discount" />
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
                {["Paperback","Hardcover","eBook"].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Badge</label>
              <select value={form.badge} onChange={e => setForm(p => ({ ...p, badge: e.target.value }))}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                <option value="">No badge</option>
                {["Bestseller","New","Trending","Staff Pick","Award Winner","Classic","Top Rated"].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Stock Status</label>
              <select value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                {["In Stock","Out of Stock","Only 3 left","Only 1 left","Pre-order"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <InputField label="Pages" name="pages" type="number" placeholder="320" />
            <InputField label="Publisher" name="publisher" placeholder="Publisher name" />
            <InputField label="Year" name="year" type="number" placeholder="2024" />
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3} placeholder="Book description..."
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] disabled:bg-stone-200 disabled:text-stone-400 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Saving…</> : editBook ? "Save Changes" : "Add Book"}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-stone-200 text-stone-600 px-5 py-2.5 rounded-xl font-semibold text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search books..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition" />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>{["Title","Category","Price","Stock","Badge","Rating","Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(book => (
                  <tr key={book.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1C1917] text-sm">{book.title}</p>
                      <p className="text-stone-400 text-xs">{book.author}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">{book.category}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#1C1917] text-xs">KSh {book.price.toLocaleString()}</p>
                      {book.original_price && <p className="text-stone-400 text-xs line-through">KSh {book.original_price.toLocaleString()}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <select value={book.stock} onChange={e => updateStock(book.id, e.target.value)}
                        className={`text-xs font-semibold bg-transparent border-none outline-none cursor-pointer ${book.stock==="In Stock"?"text-green-600":book.stock==="Out of Stock"?"text-red-600":"text-amber-600"}`}>
                        {["In Stock","Out of Stock","Only 3 left","Only 1 left","Pre-order"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {book.badge ? <span className="px-2 py-0.5 bg-[#991B1B] text-white text-[10px] font-bold rounded-md">{book.badge}</span> : <span className="text-stone-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        <span className="text-xs font-semibold text-stone-600">{book.rating}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(book)} className="text-xs text-[#991B1B] font-semibold hover:underline transition">Edit</button>
                        <button onClick={() => setDeleteId(book.id)} className="text-xs text-stone-400 hover:text-red-600 font-semibold transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400 text-sm">No books found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Orders Tab (ENHANCED — shows linked user info) ────────
function OrdersTab({ orders, users, onUpdateStatus }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState("");

  // Build a map of user_id → user for quick lookup
  const userMap = new Map(users.map(u => [u.id, u]));

  const filtered = orders.filter(o => {
    const user = userMap.get(o.user_id);
    const matchesSearch = !search ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      `${o.delivery_details?.firstName} ${o.delivery_details?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      o.delivery_details?.city?.toLowerCase().includes(search.toLowerCase()) ||
      user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      user?.phone?.includes(search);
    const matchesStatus = statusFilter === "All" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    setError("");
    try {
      const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
      if (error) {
        setError(`Failed to update order: ${error.message}`);
      } else {
        onUpdateStatus(orderId, newStatus);
      }
    } catch (err) {
      setError("Network error while updating order");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">All Orders</h2>
          <p className="text-stone-500 text-sm">{orders.length} total</p>
        </div>
      </div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order ID, customer, email, phone, city..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All","Processing","Shipped","Delivered","Cancelled"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${statusFilter===s?"bg-[#1C1917] text-white":"bg-white border border-stone-200 text-stone-600 hover:border-stone-300"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Order ID","Customer","Contact","Items","Total","Payment","Status","Date","Update"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(order => {
                const user = userMap.get(order.user_id);
                return (
                  <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-stone-500">{order.id.slice(0,8).toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1C1917] text-xs">{order.delivery_details?.firstName} {order.delivery_details?.lastName}</p>
                      <p className="text-stone-400 text-xs">{order.delivery_details?.city}</p>
                    </td>
                    <td className="px-4 py-3">
                      {user && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-stone-600 font-medium">{user.email}</p>
                          {user.phone && <p className="text-xs text-stone-400">{user.phone}</p>}
                          {order.delivery_details?.phone && order.delivery_details.phone !== user.phone && (
                            <p className="text-xs text-stone-400">📦 {order.delivery_details.phone}</p>
                          )}
                        </div>
                      )}
                      {!user && (
                        <p className="text-xs text-stone-400 italic">Guest / unlinked</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {(order.items||[]).slice(0,2).map((item,i) => <p key={i} className="text-xs text-stone-500 line-clamp-1">{item.title}</p>)}
                        {(order.items||[]).length > 2 && <p className="text-xs text-stone-400">+{(order.items||[]).length-2} more</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#1C1917] text-xs whitespace-nowrap">KSh {(order.total||0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">{order.payment_method}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}
                    </td>
                    <td className="px-4 py-3">
                      <select value={order.status} onChange={e => updateStatus(order.id, e.target.value)} disabled={updating===order.id}
                        className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#991B1B] transition disabled:opacity-50 cursor-pointer">
                        {["Processing","Shipped","Delivered","Cancelled"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-stone-400 text-sm">No orders found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab (ENHANCED — shows real data) ────────────────
function UsersTab({ users, orders, session }) {
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(null);
  const [localUsers, setLocalUsers] = useState(users);
  const [error, setError] = useState("");

  useEffect(() => { setLocalUsers(users); }, [users]);

  const filtered = localUsers.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) ||
    `${u.first_name||""} ${u.last_name||""}`.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );

  const getUserOrders = (userId) => orders.filter(o => o.user_id === userId);
  const getUserRevenue = (userId) => getUserOrders(userId).reduce((s,o) => s+(o.total||0), 0);

  const toggleRole = async (userId, currentRole) => {
    setUpdating(userId);
    setError("");
    const newRole = currentRole === "admin" ? "customer" : "admin";
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
      if (error) {
        setError(`Failed to update role: ${error.message}`);
      } else {
        setLocalUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (err) {
      setError("Network error while updating role");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1917]">Registered Users</h2>
          <p className="text-stone-500 text-sm">{users.length} total</p>
        </div>
      </div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}
      <div className="relative mb-5">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#991B1B] transition" />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["User","Email","Phone","Joined","Orders","Total Spent","Role","Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(user => {
                const isCurrentUser = user.id === session?.user?.id;
                const userOrders = getUserOrders(user.id);
                return (
                  <tr key={user.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#991B1B]/10 flex items-center justify-center text-[#991B1B] font-black text-sm flex-shrink-0">
                          {(user.first_name||user.email||"?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#1C1917] text-xs">
                            {user.first_name} {user.last_name}
                            {isCurrentUser && <span className="text-[#991B1B] text-[10px] ml-1">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-xs">{user.email}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{user.phone || <span className="text-stone-300">—</span>}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"2-digit"})}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#1C1917] text-xs">{userOrders.length}</td>
                    <td className="px-4 py-3 font-bold text-[#1C1917] text-xs whitespace-nowrap">KSh {getUserRevenue(user.id).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${user.role==="admin"?"bg-purple-50 text-purple-700 border-purple-200":"bg-stone-50 text-stone-600 border-stone-200"}`}>
                        {user.role||"customer"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isCurrentUser && (
                        <button onClick={() => toggleRole(user.id, user.role)} disabled={updating===user.id}
                          className="text-xs text-stone-400 hover:text-[#991B1B] font-semibold transition disabled:opacity-50">
                          {updating===user.id?"…":user.role==="admin"?"Remove Admin":"Make Admin"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400 text-sm">No users found</td></tr>}
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

// ── Main Admin Client Component ───────────────────────────
export default function AdminClient({ initialOrders, initialUsers, initialBooksCount, sessionUser }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState(initialOrders);
  const [users, setUsers] = useState(initialUsers);
  const [booksCount, setBooksCount] = useState(initialBooksCount);
  const [dataLoading, setDataLoading] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Optional client-side refresh to keep data current
  useEffect(() => {
    const refresh = async () => {
      setDataLoading(true);
      try {
        const { data: ordersData } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const currentUser = currentSession?.user;

        if (isMountedRef.current) {
          setOrders(ordersData || []);
        }
      } catch (err) {
        // Silent fail — we already have server-fetched data
      } finally {
        if (isMountedRef.current) setDataLoading(false);
      }
    };
    refresh();
  }, []);

  const handleUpdateStatus = useCallback((orderId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
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
            <div className="text-xs text-stone-400 hidden sm:block">
              {sessionUser?.email}
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
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
                className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${activeTab===tab.id?"border-[#991B1B] text-[#991B1B]":"border-transparent text-stone-500 hover:text-[#1C1917]"}`}>
                <span>{tab.icon}</span> {tab.label}
                {tab.id==="orders" && orders.filter(o=>o.status==="Processing").length>0 && (
                  <span className="bg-[#991B1B] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {orders.filter(o=>o.status==="Processing").length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {dataLoading && orders.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab==="overview" && <OverviewTab orders={orders} users={users} booksCount={booksCount} />}
            {activeTab==="books" && <BooksTab />}
            {activeTab==="orders" && <OrdersTab orders={orders} users={users} onUpdateStatus={handleUpdateStatus} />}
            {activeTab==="users" && <UsersTab users={users} orders={orders} session={{ user: sessionUser }} />}
          </>
        )}
      </main>
    </div>
  );
}