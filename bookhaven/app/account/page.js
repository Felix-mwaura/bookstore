"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        // Fetch profile
        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("role, first_name, last_name, phone")
          .eq("id", session.user.id)
          .single();

        // If admin somehow lands here, redirect them to admin dashboard
        if (prof?.role === "admin") {
          router.push("/admin");
          return;
        }

        // Profile row missing — create it
        if (profError?.code === "PGRST116") {
          await supabase.from("profiles").upsert({
            id: session.user.id,
            role: "customer",
            first_name: session.user.user_metadata?.first_name || "",
            last_name: session.user.user_metadata?.last_name || "",
            phone: session.user.user_metadata?.phone || "",
          });
        }

        setUser(session.user);
        setProfile(prof || {});
        setFormData({
          firstName: prof?.first_name || session.user.user_metadata?.first_name || "",
          lastName: prof?.last_name || session.user.user_metadata?.last_name || "",
          phone: prof?.phone || session.user.user_metadata?.phone || "",
        });

        // Fetch user's orders
        const { data: orderData } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (isMountedRef.current) {
          setOrders(orderData || []);
        }
      } catch (err) {
        console.error("[BookHaven] Account error:", err);
      } finally {
        // Always stop loading — prevents infinite spinner
        if (isMountedRef.current) setLoading(false);
      }
    };

    init();

    // Subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") router.push("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => { if (isMountedRef.current) setToast(null); }, 3000);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Also update auth metadata
      await supabase.auth.updateUser({
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
        }
      });

      setProfile({ ...profile, first_name: formData.firstName, last_name: formData.lastName, phone: formData.phone });
      setEditMode(false);
      showToast("Profile updated successfully");
    } catch (err) {
      showToast("Failed to update profile", "error");
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const getStatusColor = (status) => {
    const colors = {
      Processing: "bg-amber-100 text-amber-800 border-amber-200",
      Shipped: "bg-blue-100 text-blue-800 border-blue-200",
      Delivered: "bg-green-100 text-green-800 border-green-200",
      Cancelled: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[status] || "bg-stone-100 text-stone-600 border-stone-200";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin mx-auto" />
          <p className="text-stone-500 text-sm">Loading your account...</p>
        </div>
      </div>
    );
  }

  const totalSpent = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter(o => o.status === "Delivered").length;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 ${toast.type === "error" ? "bg-red-600" : "bg-[#1C1917]"} text-white`}>
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-bold text-[#1C1917] text-sm sm:text-base">Book Haven</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-stone-500 hover:text-[#991B1B] transition hidden sm:block">Continue Shopping</Link>
            <button onClick={handleLogout} className="text-xs font-semibold text-stone-500 hover:text-red-600 transition">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#1C1917] to-[#3a3530] rounded-2xl p-6 sm:p-8 mb-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">My Account</p>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              Hello, {profile?.first_name || user?.user_metadata?.first_name || "Reader"}!
            </h1>
            <p className="text-stone-400 text-sm">{user?.email}</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
            <p className="text-2xl font-black text-[#1C1917]">{totalOrders}</p>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Orders</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
            <p className="text-2xl font-black text-[#1C1917]">KSh {totalSpent.toLocaleString()}</p>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Total Spent</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
            <p className="text-2xl font-black text-[#1C1917]">{deliveredOrders}</p>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Delivered</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 w-fit">
          {[
            { id: "orders", label: "My Orders", icon: "📦" },
            { id: "profile", label: "Profile", icon: "👤" },
            { id: "settings", label: "Settings", icon: "⚙️" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-[#1C1917] shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <div className="text-5xl mb-4">📭</div>
                <h3 className="font-bold text-[#1C1917] text-lg mb-2">No orders yet</h3>
                <p className="text-stone-500 text-sm mb-4">Start exploring our collection and place your first order.</p>
                <Link href="/" className="inline-block bg-[#1C1917] hover:bg-[#991B1B] text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition">
                  Browse Books
                </Link>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-stone-400 font-mono">{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-stone-400">{new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="px-5 py-4">
                    <div className="space-y-2 mb-4">
                      {(order.items || []).map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-14 bg-stone-100 rounded border border-stone-200 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1C1917] truncate">{item.title}</p>
                            <p className="text-xs text-stone-500">{item.author}</p>
                          </div>
                          <p className="text-sm font-bold text-[#1C1917]">KSh {item.price?.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                      <div>
                        <p className="text-xs text-stone-400">Payment: <span className="text-stone-600 font-medium">{order.payment_method}</span></p>
                        <p className="text-xs text-stone-400">Delivery: <span className="text-stone-600 font-medium">{order.delivery_details?.city}</span></p>
                      </div>
                      <p className="text-lg font-black text-[#1C1917]">KSh {(order.total || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#1C1917]">Personal Information</h2>
              {!editMode && (
                <button onClick={() => setEditMode(true)} className="text-sm text-[#991B1B] font-semibold hover:underline">
                  Edit Profile
                </button>
              )}
            </div>

            {editMode ? (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#991B1B] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#991B1B] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#991B1B] transition"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="bg-[#1C1917] hover:bg-[#991B1B] disabled:bg-stone-200 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setFormData({ firstName: profile?.first_name || "", lastName: profile?.last_name || "", phone: profile?.phone || "" }); }}
                    className="border border-stone-200 text-stone-600 px-6 py-2.5 rounded-xl font-semibold text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="flex items-center gap-4 pb-4 border-b border-stone-100">
                  <div className="w-16 h-16 rounded-full bg-[#991B1B]/10 flex items-center justify-center text-[#991B1B] font-black text-2xl">
                    {(profile?.first_name || user?.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-[#1C1917] text-lg">{profile?.first_name} {profile?.last_name}</p>
                    <p className="text-stone-500 text-sm">{user?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-1">Phone</p>
                    <p className="text-sm text-[#1C1917] font-medium">{profile?.phone || <span className="text-stone-300 italic">Not set</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-1">Member Since</p>
                    <p className="text-sm text-[#1C1917] font-medium">{new Date(user?.created_at).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-[#1C1917] mb-6">Account Settings</h2>
            <div className="space-y-4 max-w-md">
              <div className="flex items-center justify-between py-3 border-b border-stone-100">
                <div>
                  <p className="text-sm font-semibold text-[#1C1917]">Email Notifications</p>
                  <p className="text-xs text-stone-500">Receive order updates and promotions</p>
                </div>
                <div className="w-11 h-6 bg-[#991B1B] rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-stone-100">
                <div>
                  <p className="text-sm font-semibold text-[#1C1917]">SMS Notifications</p>
                  <p className="text-xs text-stone-500">Get delivery alerts via SMS</p>
                </div>
                <div className="w-11 h-6 bg-stone-200 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
              <div className="pt-4">
                <button
                  onClick={handleLogout}
                  className="w-full border border-red-200 text-red-600 hover:bg-red-50 px-4 py-3 rounded-xl font-semibold text-sm transition"
                >
                  Sign Out of All Devices
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}