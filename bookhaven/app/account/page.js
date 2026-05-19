"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookCover } from "../components/BookCard";
import { StoreHeader, StoreFooter, CartDrawer, useStore } from "../components/StoreShell";
import WishlistDrawer from "../components/WishlistDrawer";
import BookDetailPage from "../components/BookCard";

// ── Sample order history ──────────────────────────────────
const SAMPLE_ORDERS = [
  {
    id: "BH-A7K2P",
    date: "14 May 2026",
    status: "Delivered",
    items: [
      { title: "Atomic Habits", author: "James Clear", price: 1499, cover: { bg: "#1a1a2e", accent: "#e94560", pattern: "dots" } },
      { title: "Sapiens", author: "Yuval Noah Harari", price: 1599, cover: { bg: "#2c1810", accent: "#e8a020", pattern: "dots" } },
    ],
    total: 3098,
    payment: "M-Pesa",
  },
  {
    id: "BH-M3X9Q",
    date: "2 Apr 2026",
    status: "Delivered",
    items: [
      { title: "The Alchemist", author: "Paulo Coelho", price: 1099, cover: { bg: "#1a3a4a", accent: "#f39c12", pattern: "diagonal" } },
    ],
    total: 1399,
    payment: "Card",
  },
  {
    id: "BH-R5T1W",
    date: "18 Mar 2026",
    status: "Processing",
    items: [
      { title: "Can't Hurt Me", author: "David Goggins", price: 1550, cover: { bg: "#111111", accent: "#e67e22", pattern: "lines" } },
      { title: "Deep Work", author: "Cal Newport", price: 1399, cover: { bg: "#1b1b2f", accent: "#c84b31", pattern: "grid" } },
    ],
    total: 2949,
    payment: "Cash on Delivery",
  },
];

const SAMPLE_ADDRESSES = [
  { id: 1, label: "Home", name: "Grace Wambui", address: "Apt 4B, Westlands Gardens", city: "Nairobi", phone: "0712 345 678", isDefault: true },
  { id: 2, label: "Work", name: "Grace Wambui", address: "4th Floor, ABC Place, Waiyaki Way", city: "Nairobi", phone: "0712 345 678", isDefault: false },
];

// ── Status badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    Delivered: "bg-green-50 text-green-700 border-green-200",
    Processing: "bg-amber-50 text-amber-700 border-amber-200",
    Shipped: "bg-blue-50 text-blue-700 border-blue-200",
    Cancelled: "bg-red-50 text-red-700 border-red-200",
  };
  const icons = { Delivered: "✓", Processing: "⏳", Shipped: "🚚", Cancelled: "✕" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || "bg-stone-50 text-stone-600 border-stone-200"}`}>
      <span>{icons[status]}</span> {status}
    </span>
  );
}

// ── Orders Tab ────────────────────────────────────────────
function OrdersTab() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <h2 className="text-xl font-bold text-[#1C1917] mb-6">Order History</h2>
      {SAMPLE_ORDERS.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-stone-500 font-medium">No orders yet</p>
          <Link href="/books" className="inline-block mt-4 text-[#991B1B] font-semibold hover:underline">Browse books →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {SAMPLE_ORDERS.map((order) => (
            <div key={order.id} className="border border-stone-200 rounded-2xl overflow-hidden hover:border-stone-300 transition-colors">
              {/* Order header */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-stone-50/50 cursor-pointer"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
                <div className="flex items-center gap-4">
                  {/* Mini book covers */}
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 3).map((item, i) => (
                      <div key={i} className="w-8 rounded-r-sm overflow-hidden border border-white flex-shrink-0"
                        style={{ aspectRatio: "2/3", boxShadow: "-1px 0 2px rgba(0,0,0,0.1)", zIndex: order.items.length - i }}>
                        <BookCover book={item} className="w-full h-full" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-bold text-[#1C1917] font-mono text-sm">{order.id}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{order.date} · {order.items.length} {order.items.length === 1 ? "book" : "books"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={order.status} />
                  <div className="text-right">
                    <p className="font-bold text-[#1C1917]">KSh {order.total.toLocaleString()}</p>
                    <p className="text-xs text-stone-400">{order.payment}</p>
                  </div>
                  <svg className={`w-5 h-5 text-stone-400 transition-transform duration-200 ${expanded === order.id ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded order details */}
              {expanded === order.id && (
                <div className="p-5 border-t border-stone-100">
                  <div className="space-y-4">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-12 rounded-r-sm overflow-hidden flex-shrink-0"
                          style={{ aspectRatio: "2/3", boxShadow: "-1px 0 3px rgba(0,0,0,0.1), 2px 4px 10px rgba(0,0,0,0.1)" }}>
                          <BookCover book={item} className="w-full h-full" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[#1C1917] text-sm">{item.title}</p>
                          <p className="text-xs text-stone-400">{item.author}</p>
                        </div>
                        <p className="font-bold text-[#1C1917] text-sm">KSh {item.price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-stone-100">
                    <button className="flex items-center gap-2 px-4 py-2 border border-stone-200 hover:border-stone-300 rounded-xl text-sm font-medium text-stone-600 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reorder
                    </button>
                    {order.status === "Processing" && (
                      <button className="flex items-center gap-2 px-4 py-2 border border-stone-200 hover:border-stone-300 rounded-xl text-sm font-medium text-stone-600 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Track Order
                      </button>
                    )}
                    {order.status === "Delivered" && (
                      <button className="flex items-center gap-2 px-4 py-2 border border-stone-200 hover:border-stone-300 rounded-xl text-sm font-medium text-stone-600 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        Leave a Review
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Addresses Tab ─────────────────────────────────────────
function AddressesTab() {
  const [addresses, setAddresses] = useState(SAMPLE_ADDRESSES);
  const [showForm, setShowForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "", name: "", address: "", city: "", phone: "" });

  const addAddress = () => {
    if (!newAddress.address.trim() || !newAddress.city) return;
    setAddresses([...addresses, { ...newAddress, id: Date.now(), isDefault: false }]);
    setNewAddress({ label: "", name: "", address: "", city: "", phone: "" });
    setShowForm(false);
  };

  const setDefault = (id) => setAddresses(addresses.map((a) => ({ ...a, isDefault: a.id === id })));
  const remove = (id) => setAddresses(addresses.filter((a) => a.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#1C1917]">Saved Addresses</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1C1917] hover:bg-[#991B1B] text-white rounded-xl text-sm font-semibold transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New
        </button>
      </div>

      {showForm && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 mb-5">
          <h3 className="font-bold text-[#1C1917] mb-4">New Address</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Label", key: "label", placeholder: "Home / Work / Other", span: false },
              { label: "Full Name", key: "name", placeholder: "Grace Wambui", span: false },
              { label: "Street Address", key: "address", placeholder: "Estate, street, building...", span: true },
              { label: "Phone", key: "phone", placeholder: "0712 345 678", span: false },
            ].map(({ label, key, placeholder, span }) => (
              <div key={key} className={span ? "col-span-2" : ""}>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
                <input type="text" value={newAddress[key]} placeholder={placeholder}
                  onChange={(e) => setNewAddress((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B]/20 transition" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">City</label>
              <select value={newAddress.city} onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                <option value="">Select city</option>
                {["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos","Meru"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addAddress} className="bg-[#1C1917] hover:bg-[#991B1B] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95">Save Address</button>
            <button onClick={() => setShowForm(false)} className="border border-stone-200 hover:border-stone-300 text-stone-600 px-5 py-2.5 rounded-xl text-sm font-semibold transition">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div key={addr.id} className={`relative p-5 rounded-2xl border-2 transition-colors ${addr.isDefault ? "border-[#991B1B]/40 bg-[#991B1B]/5" : "border-stone-200 bg-white"}`}>
            {addr.isDefault && (
              <span className="absolute top-3 right-3 text-[10px] font-bold text-[#991B1B] bg-[#991B1B]/10 px-2 py-0.5 rounded-full">Default</span>
            )}
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${addr.isDefault ? "bg-[#991B1B]/10 text-[#991B1B]" : "bg-stone-100 text-stone-500"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#1C1917] text-sm">{addr.label || "Address"}</p>
                </div>
                <p className="text-sm text-stone-600 mt-1">{addr.name}</p>
                <p className="text-sm text-stone-500">{addr.address}</p>
                <p className="text-sm text-stone-500">{addr.city}</p>
                <p className="text-xs text-stone-400 mt-1">{addr.phone}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              {!addr.isDefault && (
                <button onClick={() => setDefault(addr.id)} className="text-xs text-[#991B1B] font-semibold hover:underline">Set as default</button>
              )}
              <button className="text-xs text-stone-400 hover:text-stone-600 transition ml-auto">Edit</button>
              {!addr.isDefault && (
                <button onClick={() => remove(addr.id)} className="text-xs text-stone-400 hover:text-red-600 transition">Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wishlist Tab ──────────────────────────────────────────
function WishlistTab({ wishlist, onRemove, onAddToCart, onViewDetail }) {
  if (wishlist.length === 0) return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">♡</div>
      <p className="text-stone-500 font-medium text-lg">Your wishlist is empty</p>
      <p className="text-stone-400 text-sm mt-1">Save books you love by tapping the heart icon</p>
      <Link href="/books" className="inline-block mt-5 bg-[#1C1917] hover:bg-[#991B1B] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all">Browse Books</Link>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#1C1917]">My Wishlist <span className="text-stone-400 font-normal text-base">({wishlist.length})</span></h2>
        <button onClick={() => wishlist.forEach(onAddToCart)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1C1917] hover:bg-[#991B1B] text-white rounded-xl text-sm font-semibold transition-all active:scale-95">
          Add All to Cart
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wishlist.map((book) => (
          <div key={book.id} className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-all">
            <div className="bg-stone-50 p-5 flex justify-center cursor-pointer" onClick={() => onViewDetail(book)}>
              <div className="w-24 rounded-r-sm overflow-hidden transform group-hover:scale-105 transition duration-300"
                style={{ aspectRatio: "2/3", boxShadow: "-1px 0 3px rgba(0,0,0,0.1), 3px 6px 16px rgba(0,0,0,0.12)" }}>
                <BookCover book={book} className="w-full h-full" />
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mb-1">{book.category}</p>
              <h3 className="font-bold text-[#1C1917] text-sm line-clamp-2 cursor-pointer hover:text-[#991B1B] transition" onClick={() => onViewDetail(book)}>{book.title}</h3>
              <p className="text-xs text-stone-500 mt-0.5">{book.author}</p>
              <p className="font-bold text-[#1C1917] mt-3">KSh {book.price.toLocaleString()}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => onAddToCart(book)}
                  className="flex-1 bg-[#1C1917] hover:bg-[#991B1B] text-white py-2 rounded-lg text-xs font-semibold transition-all active:scale-95">
                  Add to Cart
                </button>
                <button onClick={() => onRemove(book.id)}
                  className="p-2 border border-stone-200 hover:border-red-200 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-lg transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────
function SettingsTab({ user, onUpdate, onLogout }) {
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", phone: "" });
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({ orders: true, promos: false, newsletter: true });

  const handleChange = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const save = () => {
    localStorage.setItem("bh_user", JSON.stringify({ ...user, name: form.name, email: form.email }));
    onUpdate({ ...user, name: form.name, email: form.email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Toggle = ({ label, sub, id }) => (
    <div className="flex items-center justify-between py-4 border-b border-stone-100 last:border-0">
      <div>
        <p className="font-semibold text-[#1C1917] text-sm">{label}</p>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      </div>
      <div onClick={() => setNotifications((p) => ({ ...p, [id]: !p[id] }))}
        className={`w-11 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${notifications[id] ? "bg-[#1C1917]" : "bg-stone-200"}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${notifications[id] ? "left-5" : "left-0.5"}`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Profile */}
      <div>
        <h2 className="text-xl font-bold text-[#1C1917] mb-5">Profile Information</h2>
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-full bg-[#991B1B] flex items-center justify-center text-white font-black text-2xl shadow-lg">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-bold text-[#1C1917] text-lg">{user?.name}</p>
            <p className="text-stone-500 text-sm">{user?.email}</p>
            <button className="text-xs text-[#991B1B] font-semibold hover:underline mt-1">Change photo</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "Full Name", key: "name", placeholder: "Your name" },
            { label: "Email Address", key: "email", placeholder: "your@email.com", type: "email" },
            { label: "Phone Number", key: "phone", placeholder: "0712 345 678", type: "tel" },
          ].map(({ label, key, placeholder, type = "text" }) => (
            <div key={key} className={key === "email" ? "sm:col-span-2" : ""}>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">{label}</label>
              <input type={type} value={form[key]} placeholder={placeholder}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B]/20 transition" />
            </div>
          ))}
        </div>

        <button onClick={save}
          className="mt-5 flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95">
          {saved ? <><span>✓</span> Saved!</> : "Save Changes"}
        </button>
      </div>

      {/* Password */}
      <div>
        <h3 className="text-lg font-bold text-[#1C1917] mb-4">Change Password</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {["Current Password", "New Password", "Confirm New"].map((label) => (
            <div key={label}>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">{label}</label>
              <input type="password" placeholder="••••••••"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#991B1B] transition" />
            </div>
          ))}
        </div>
        <button className="mt-4 border border-stone-200 hover:border-stone-300 text-stone-600 px-6 py-3 rounded-xl font-semibold text-sm transition">
          Update Password
        </button>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-lg font-bold text-[#1C1917] mb-4">Notifications</h3>
        <div className="bg-white border border-stone-200 rounded-2xl px-5">
          <Toggle label="Order updates" sub="Shipping, delivery, and order status" id="orders" />
          <Toggle label="Promotions & deals" sub="Sales, discounts, and special offers" id="promos" />
          <Toggle label="Newsletter" sub="Weekly book recommendations" id="newsletter" />
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <h3 className="text-lg font-bold text-[#1C1917] mb-4">Account Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={onLogout}
            className="flex items-center gap-2 border border-stone-200 hover:border-stone-300 text-stone-600 px-5 py-2.5 rounded-xl font-semibold text-sm transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
          <button className="flex items-center gap-2 border border-red-200 hover:border-red-300 text-red-600 px-5 py-2.5 rounded-xl font-semibold text-sm transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Account Page ─────────────────────────────────────
const TABS = [
  { id: "orders", label: "Orders", icon: "📦" },
  { id: "wishlist", label: "Wishlist", icon: "♡" },
  { id: "addresses", label: "Addresses", icon: "📍" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export default function AccountPage() {
  const router = useRouter();
  const store = useStore();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const u = localStorage.getItem("bh_user");
      if (u) setUser(JSON.parse(u));
      else router.push("/login");
    } catch { router.push("/login"); }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("bh_user");
    router.push("/");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <StoreHeader
        cartCount={store.cartCount}
        wishlistCount={store.wishlist.length}
        onCartClick={() => store.setIsCartOpen(true)}
        onWishlistClick={() => store.setIsWishlistOpen(true)}
      />

      {/* Page header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[#991B1B] flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-0.5">My Account</p>
              <h1 className="text-2xl font-bold text-[#1C1917]">{user.name}</h1>
              <p className="text-stone-500 text-sm">{user.email}</p>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex gap-1 mt-6 border-b border-stone-200">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                  activeTab === tab.id
                    ? "border-[#991B1B] text-[#991B1B]"
                    : "border-transparent text-stone-500 hover:text-[#1C1917]"
                }`}>
                <span>{tab.icon}</span> {tab.label}
                {tab.id === "wishlist" && store.wishlist.length > 0 && (
                  <span className="bg-[#991B1B] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {store.wishlist.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {activeTab === "orders" && <OrdersTab />}
        {activeTab === "addresses" && <AddressesTab />}
        {activeTab === "wishlist" && (
          <WishlistTab
            wishlist={store.wishlist}
            onRemove={(id) => store.toggleWishlist(store.wishlist.find((b) => b.id === id))}
            onAddToCart={store.addToCart}
            onViewDetail={store.setSelectedBook}
          />
        )}
        {activeTab === "settings" && (
          <SettingsTab user={user} onUpdate={setUser} onLogout={handleLogout} />
        )}
      </div>

      <StoreFooter />

      <CartDrawer
        cart={store.cart}
        isOpen={store.isCartOpen}
        onClose={() => store.setIsCartOpen(false)}
        onUpdateQty={store.updateQty}
        onRemove={store.removeFromCart}
        total={store.cartTotal}
      />

      <WishlistDrawer
        wishlist={store.wishlist}
        isOpen={store.isWishlistOpen}
        onClose={() => store.setIsWishlistOpen(false)}
        onRemove={(id) => store.toggleWishlist(store.wishlist.find((b) => b.id === id))}
        onAddToCart={(book) => { store.addToCart(book); store.setIsWishlistOpen(false); }}
        onViewDetail={store.setSelectedBook}
      />

      <BookDetailPage
        book={store.selectedBook}
        isWishlisted={store.selectedBook ? store.wishlist.some((b) => b.id === store.selectedBook.id) : false}
        onToggleWishlist={store.toggleWishlist}
        onAddToCart={store.addToCart}
        onClose={() => store.setSelectedBook(null)}
      />

      {store.toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1C1917] text-white px-6 py-3 rounded-lg shadow-2xl animate-slide-up flex items-center gap-3 whitespace-nowrap">
          <span className="text-green-400">✓</span>
          <span className="text-sm font-medium">{store.toast}</span>
        </div>
      )}
    </div>
  );
}