"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookCover } from "../components/BookCard";
import { StoreHeader, StoreFooter, CartDrawer, useStore } from "../components/StoreShell";
import WishlistDrawer from "../components/WishlistDrawer";
import BookDetailPage from "../components/BookCard";
import { useAuth, signOut, getUserName } from "../lib/auth";
import { supabase } from "../lib/supabase";
import books from "../books";

export const dynamic = 'force-dynamic';

// ── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = { Delivered:"bg-green-50 text-green-700 border-green-200", Processing:"bg-amber-50 text-amber-700 border-amber-200", Shipped:"bg-blue-50 text-blue-700 border-blue-200", Cancelled:"bg-red-50 text-red-700 border-red-200" };
  const icons = { Delivered:"✓", Processing:"⏳", Shipped:"🚚", Cancelled:"✕" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]||"bg-stone-50 text-stone-600 border-stone-200"}`}>
      <span>{icons[status]}</span> {status}
    </span>
  );
}

// ── Orders Tab ────────────────────────────────────────────
function OrdersTab({ session }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/orders", { headers: { authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then(({ orders }) => { setOrders(orders || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [session]);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin" /></div>;

  if (orders.length === 0) return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">📦</div>
      <p className="text-stone-500 font-medium">No orders yet</p>
      <Link href="/books" className="inline-block mt-4 text-[#991B1B] font-semibold hover:underline">Browse books →</Link>
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-[#1C1917] mb-6">Order History</h2>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="border border-stone-200 rounded-2xl overflow-hidden hover:border-stone-300 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-stone-50/50 cursor-pointer" onClick={() => setExpanded(expanded===order.id?null:order.id)}>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {(order.items||[]).slice(0,3).map((item,i) => (
                    <div key={i} className="w-8 rounded-r-sm overflow-hidden border border-white flex-shrink-0" style={{ aspectRatio:"2/3", zIndex:(order.items||[]).length-i }}>
                      <BookCover book={item} className="w-full h-full" />
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-bold text-[#1C1917] font-mono text-sm">{order.id.slice(0,8).toUpperCase()}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{new Date(order.created_at).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})} · {(order.items||[]).length} book{(order.items||[]).length!==1?"s":""}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={order.status} />
                <div className="text-right">
                  <p className="font-bold text-[#1C1917]">KSh {(order.total||0).toLocaleString()}</p>
                  <p className="text-xs text-stone-400">{order.payment_method}</p>
                </div>
                <svg className={`w-5 h-5 text-stone-400 transition-transform duration-200 ${expanded===order.id?"rotate-180":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            {expanded===order.id && (
              <div className="p-5 border-t border-stone-100">
                <div className="space-y-4">
                  {(order.items||[]).map((item,i)=>(
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-12 rounded-r-sm overflow-hidden flex-shrink-0" style={{ aspectRatio:"2/3", boxShadow:"-1px 0 3px rgba(0,0,0,0.1)" }}>
                        <BookCover book={item} className="w-full h-full" />
                      </div>
                      <div className="flex-1"><p className="font-semibold text-[#1C1917] text-sm">{item.title}</p><p className="text-xs text-stone-400">{item.author}</p></div>
                      <p className="font-bold text-[#1C1917] text-sm">KSh {(item.price*(item.quantity||1)).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-stone-100 text-sm text-stone-500">
                  <p><span className="font-semibold text-stone-700">Deliver to:</span> {order.delivery_details?.address}, {order.delivery_details?.city}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Addresses Tab ─────────────────────────────────────────
function AddressesTab({ session }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label:"", name:"", address:"", city:"", phone:"" });

  const headers = { "Content-Type":"application/json", authorization:`Bearer ${session?.access_token}` };

  useEffect(() => {
    if (!session) return;
    fetch("/api/addresses", { headers }).then(r=>r.json()).then(({addresses})=>{setAddresses(addresses||[]);setLoading(false);}).catch(()=>setLoading(false));
  }, [session]);

  const addAddress = async () => {
    setSaving(true);
    const res = await fetch("/api/addresses", { method:"POST", headers, body:JSON.stringify({...form,isDefault:addresses.length===0}) });
    const { address } = await res.json();
    setAddresses([...addresses, address]);
    setForm({ label:"", name:"", address:"", city:"", phone:"" });
    setShowForm(false);
    setSaving(false);
  };

  const setDefault = async (id) => {
    await fetch("/api/addresses", { method:"PATCH", headers, body:JSON.stringify({id,isDefault:true}) });
    setAddresses(addresses.map(a=>({...a,is_default:a.id===id})));
  };

  const remove = async (id) => {
    await fetch("/api/addresses", { method:"DELETE", headers, body:JSON.stringify({id}) });
    setAddresses(addresses.filter(a=>a.id!==id));
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#1C1917]">Saved Addresses</h2>
        <button onClick={()=>setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-[#1C1917] hover:bg-[#991B1B] text-white rounded-xl text-sm font-semibold transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add New
        </button>
      </div>
      {showForm && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 mb-5">
          <h3 className="font-bold text-[#1C1917] mb-4">New Address</h3>
          <div className="grid grid-cols-2 gap-3">
            {[{l:"Label",k:"label",p:"Home / Work",s:false},{l:"Full Name",k:"name",p:"Grace Wambui",s:false},{l:"Street Address",k:"address",p:"Estate, street...",s:true},{l:"Phone",k:"phone",p:"0712 345 678",s:false}].map(({l,k,p,s})=>(
              <div key={k} className={s?"col-span-2":""}>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{l}</label>
                <input type="text" value={form[k]} placeholder={p} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">City</label>
              <select value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#991B1B] transition">
                <option value="">Select city</option>
                {["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos","Meru"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addAddress} disabled={saving} className="bg-[#1C1917] hover:bg-[#991B1B] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center gap-2">
              {saving?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Saving…</>:"Save Address"}
            </button>
            <button onClick={()=>setShowForm(false)} className="border border-stone-200 text-stone-600 px-5 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}
      {addresses.length===0&&!showForm&&(
        <div className="text-center py-16"><div className="text-5xl mb-4">📍</div><p className="text-stone-500">No saved addresses yet</p></div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {addresses.map(addr=>(
          <div key={addr.id} className={`relative p-5 rounded-2xl border-2 transition-colors ${addr.is_default?"border-[#991B1B]/40 bg-[#991B1B]/5":"border-stone-200 bg-white"}`}>
            {addr.is_default&&<span className="absolute top-3 right-3 text-[10px] font-bold text-[#991B1B] bg-[#991B1B]/10 px-2 py-0.5 rounded-full">Default</span>}
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${addr.is_default?"bg-[#991B1B]/10 text-[#991B1B]":"bg-stone-100 text-stone-500"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1C1917] text-sm">{addr.label||"Address"}</p>
                <p className="text-sm text-stone-600 mt-1">{addr.name}</p>
                <p className="text-sm text-stone-500">{addr.address}</p>
                <p className="text-sm text-stone-500">{addr.city}</p>
                <p className="text-xs text-stone-400 mt-1">{addr.phone}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              {!addr.is_default&&<button onClick={()=>setDefault(addr.id)} className="text-xs text-[#991B1B] font-semibold hover:underline">Set as default</button>}
              {!addr.is_default&&<button onClick={()=>remove(addr.id)} className="text-xs text-stone-400 hover:text-red-600 transition ml-auto">Remove</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wishlist Tab ──────────────────────────────────────────
function WishlistTab({ wishlist, onRemove, onAddToCart, onViewDetail }) {
  if (wishlist.length===0) return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">♡</div>
      <p className="text-stone-500 font-medium text-lg">Your wishlist is empty</p>
      <Link href="/books" className="inline-block mt-5 bg-[#1C1917] hover:bg-[#991B1B] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all">Browse Books</Link>
    </div>
  );
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#1C1917]">My Wishlist <span className="text-stone-400 font-normal text-base">({wishlist.length})</span></h2>
        <button onClick={()=>wishlist.forEach(onAddToCart)} className="flex items-center gap-2 px-4 py-2 bg-[#1C1917] hover:bg-[#991B1B] text-white rounded-xl text-sm font-semibold transition-all active:scale-95">Add All to Cart</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wishlist.map(book=>(
          <div key={book.id} className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-all">
            <div className="bg-stone-50 p-5 flex justify-center cursor-pointer" onClick={()=>onViewDetail(book)}>
              <div className="w-24 rounded-r-sm overflow-hidden transform group-hover:scale-105 transition duration-300" style={{ aspectRatio:"2/3", boxShadow:"-1px 0 3px rgba(0,0,0,0.1), 3px 6px 16px rgba(0,0,0,0.12)" }}>
                <BookCover book={book} className="w-full h-full" />
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mb-1">{book.category}</p>
              <h3 className="font-bold text-[#1C1917] text-sm line-clamp-2 cursor-pointer hover:text-[#991B1B] transition" onClick={()=>onViewDetail(book)}>{book.title}</h3>
              <p className="text-xs text-stone-500 mt-0.5">{book.author}</p>
              <p className="font-bold text-[#1C1917] mt-3">KSh {book.price.toLocaleString()}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={()=>onAddToCart(book)} className="flex-1 bg-[#1C1917] hover:bg-[#991B1B] text-white py-2 rounded-lg text-xs font-semibold transition-all active:scale-95">Add to Cart</button>
                <button onClick={()=>onRemove(book.id)} className="p-2 border border-stone-200 hover:border-red-200 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-lg transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Toggle Component ──────────────────────────────────────
function Toggle({ label, sub, id, notifications, setNotifications }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-stone-100 last:border-0">
      <div><p className="font-semibold text-[#1C1917] text-sm">{label}</p>{sub&&<p className="text-xs text-stone-400 mt-0.5">{sub}</p>}</div>
      <div onClick={()=>setNotifications(p=>({...p,[id]:!p[id]}))} className={`w-11 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${notifications[id]?"bg-[#1C1917]":"bg-stone-200"}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${notifications[id]?"left-5":"left-0.5"}`} />
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────
function SettingsTab({ user, onLogout }) {
  const meta = user?.user_metadata || {};
  const [form, setForm] = useState({ name: meta.first_name || user?.email?.split("@")[0] || "", email: user?.email || "", phone: meta.phone || "" });
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({ orders:true, promos:false, newsletter:true });

  const save = async () => {
    await supabase.auth.updateUser({ data: { first_name: form.name, phone: form.phone } });
    setSaved(true);
    setTimeout(()=>setSaved(false), 2500);
  };
  
  

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-[#1C1917] mb-5">Profile Information</h2>
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-full bg-[#991B1B] flex items-center justify-center text-white font-black text-2xl shadow-lg">
            {(meta.first_name||user?.email||"?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-[#1C1917] text-lg">{meta.first_name} {meta.last_name}</p>
            <p className="text-stone-500 text-sm">{user?.email}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[{l:"Display Name",k:"name",p:"Your name"},{l:"Email Address",k:"email",p:"your@email.com",span:true},{l:"Phone Number",k:"phone",p:"0712 345 678"}].map(({l,k,p,span})=>(
            <div key={k} className={span?"sm:col-span-2":""}>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">{l}</label>
              <input type="text" value={form[k]} placeholder={p} disabled={k==="email"}
                onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                className={`w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B]/20 transition ${k==="email"?"opacity-50 cursor-not-allowed":""}`} />
            </div>
          ))}
        </div>
        <button onClick={save} className="mt-5 flex items-center gap-2 bg-[#1C1917] hover:bg-[#991B1B] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95">
          {saved?<><span>✓</span> Saved!</>:"Save Changes"}
        </button>
      </div>
      <div>
        <h3 className="text-lg font-bold text-[#1C1917] mb-4">Notifications</h3>
        <div className="bg-white border border-stone-200 rounded-2xl px-5">
          <Toggle label="Order updates" sub="Shipping, delivery, and order status" id="orders" />
          <Toggle label="Promotions & deals" sub="Sales, discounts, and special offers" id="promos" />
          <Toggle label="Newsletter" sub="Weekly book recommendations" id="newsletter" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-[#1C1917] mb-4">Account Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={onLogout} className="flex items-center gap-2 border border-stone-200 hover:border-stone-300 text-stone-600 px-5 py-2.5 rounded-xl font-semibold text-sm transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Sign Out
          </button>
          <button className="flex items-center gap-2 border border-red-200 hover:border-red-300 text-red-600 px-5 py-2.5 rounded-xl font-semibold text-sm transition">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Account Page ─────────────────────────────────────
const TABS = [
  { id:"orders", label:"Orders", icon:"📦" },
  { id:"wishlist", label:"Wishlist", icon:"♡" },
  { id:"addresses", label:"Addresses", icon:"📍" },
  { id:"settings", label:"Settings", icon:"⚙️" },
];

function AccountInner() {
  const searchParams = useSearchParams();

  return (
    <div>
      {/* existing page content */}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AccountInner />
    </Suspense>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useStore();
  const { user, session, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "orders");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t); }, []);
  useEffect(() => { if (!loading && !user) router.push("/login"); }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut();
    localStorage.removeItem("bh_cart");
    localStorage.removeItem("bh_wishlist");
    router.push("/");
  };

  if (!mounted || loading || !user) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin" />
    </div>
  );

  const meta = user.user_metadata || {};
  const displayName = `${meta.first_name||""} ${meta.last_name||""}`.trim() || user.email;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <StoreHeader cartCount={store.cartCount} wishlistCount={store.wishlist.length} onCartClick={()=>store.setIsCartOpen(true)} onWishlistClick={()=>store.setIsWishlistOpen(true)} />

      <div className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[#991B1B] flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-0.5">My Account</p>
              <h1 className="text-2xl font-bold text-[#1C1917]">{displayName}</h1>
              <p className="text-stone-500 text-sm">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-0 sm:gap-1 mt-6 border-b border-stone-200 overflow-x-auto">
            {TABS.map(tab=>(
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap flex-shrink-0 ${activeTab===tab.id?"border-[#991B1B] text-[#991B1B]":"border-transparent text-stone-500 hover:text-[#1C1917]"}`}>
                <span>{tab.icon}</span>
                <span className="hidden xs:inline">{tab.label}</span>
                <span className="xs:hidden">{tab.label.split(" ")[0]}</span>
                {tab.id==="wishlist"&&store.wishlist.length>0&&(
                  <span className="bg-[#991B1B] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{store.wishlist.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {activeTab==="orders"&&<OrdersTab session={session} />}
        {activeTab==="addresses"&&<AddressesTab session={session} />}
        {activeTab==="wishlist"&&<WishlistTab wishlist={store.wishlist} onRemove={id=>store.toggleWishlist(store.wishlist.find(b=>b.id===id))} onAddToCart={store.addToCart} onViewDetail={store.setSelectedBook} />}
        {activeTab==="settings"&&<SettingsTab user={user} onLogout={handleLogout} />}
      </div>

      <StoreFooter />
      <CartDrawer cart={store.cart} isOpen={store.isCartOpen} onClose={()=>store.setIsCartOpen(false)} onUpdateQty={store.updateQty} onRemove={store.removeFromCart} total={store.cartTotal} />
      <WishlistDrawer wishlist={store.wishlist} isOpen={store.isWishlistOpen} onClose={()=>store.setIsWishlistOpen(false)} onRemove={id=>store.toggleWishlist(store.wishlist.find(b=>b.id===id))} onAddToCart={book=>{store.addToCart(book);store.setIsWishlistOpen(false);}} onViewDetail={store.setSelectedBook} />
      <BookDetailPage book={store.selectedBook} isWishlisted={store.selectedBook?store.wishlist.some(b=>b.id===store.selectedBook.id):false} onToggleWishlist={store.toggleWishlist} onAddToCart={store.addToCart} onClose={()=>store.setSelectedBook(null)} />
      {store.toast&&<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1C1917] text-white px-6 py-3 rounded-lg shadow-2xl animate-slide-up flex items-center gap-3 whitespace-nowrap"><span className="text-green-400">✓</span><span className="text-sm font-medium">{store.toast}</span></div>}
    </div>
  );
}