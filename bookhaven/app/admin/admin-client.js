"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase"; // Adjust path if needed

// --- Reusable UI Components ---
const StatCard = ({ title, value, icon }) => (
  <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
    <div className="p-3 bg-stone-100 text-[#991B1B] rounded-lg">{icon}</div>
    <div>
      <p className="text-sm text-stone-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-[#1C1917]">{value}</p>
    </div>
  </div>
);

const Badge = ({ children, color = "gray" }) => {
  const colors = {
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
    gray: "bg-stone-100 text-stone-800"
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[color] || colors.gray}`}>{children}</span>;
};

// --- Main Admin Client ---
export default function AdminClient() {
  const [activeTab, setActiveTab] = useState("overview");
  const [books, setBooks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Helper to get authenticated headers
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token}`
    };
  };

  // Initial Data Fetch
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      
      const [booksRes, ordersRes, usersRes] = await Promise.all([
        fetch("/api/admin/books", { headers }),
        fetch("/api/admin/orders", { headers }),
        fetch("/api/admin/users", { headers })
      ]);

      if (booksRes.ok) setBooks((await booksRes.json()).books || []);
      if (ordersRes.ok) setOrders((await ordersRes.json()).orders || []);
      if (usersRes.ok) setCustomers((await usersRes.json()).users || []);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      showToast("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Tab Components ---

  const OverviewTab = () => {
    const revenue = useMemo(() => orders.filter(o => o.status !== "Cancelled" && o.status !== "Failed").reduce((sum, o) => sum + o.total, 0), [orders]);
    const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#1C1917]">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Revenue" value={`KSh ${revenue.toLocaleString()}`} icon={<span className="text-xl">💰</span>} />
          <StatCard title="Total Orders" value={orders.length} icon={<span className="text-xl">📦</span>} />
          <StatCard title="Total Books" value={books.length} icon={<span className="text-xl">📚</span>} />
        </div>
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <h3 className="text-lg font-bold mb-4">Recent Orders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 font-medium">#{order.id}</td>
                    <td className="px-4 py-3">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">KSh {order.total.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge color={order.status === "Delivered" ? "green" : order.status === "Processing" ? "yellow" : "gray"}>
                        {order.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const OrdersTab = () => {
    const updateOrderStatus = async (id, status) => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/orders/${id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status })
        });
        if (res.ok) {
          setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
          showToast("Order status updated");
        }
      } catch (err) {
        showToast("Error updating order");
      }
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#1C1917]">Order Management</h2>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium">#{order.id}</td>
                  <td className="px-4 py-3">{order.delivery_details?.fullName || "N/A"}</td>
                  <td className="px-4 py-3">KSh {order.total.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge color={order.status === "Delivered" ? "green" : order.status === "Processing" ? "yellow" : "gray"}>{order.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <select 
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="border border-stone-300 rounded px-2 py-1 text-xs"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const BooksTab = () => {
    const [editingBook, setEditingBook] = useState(null);

    const saveBook = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const bookData = Object.fromEntries(formData.entries());
      bookData.price = Number(bookData.price);
      bookData.stock = Number(bookData.stock);

      try {
        const headers = await getAuthHeaders();
        const url = editingBook ? `/api/admin/books/${editingBook.id}` : "/api/admin/books";
        const method = editingBook ? "PATCH" : "POST";

        const res = await fetch(url, { method, headers, body: JSON.stringify(bookData) });
        if (res.ok) {
          showToast(editingBook ? "Book updated" : "Book added");
          setEditingBook(null);
          fetchData(); // Refresh list
        }
      } catch (err) {
        showToast("Error saving book");
      }
    };

    const toggleArchive = async (book) => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/books/${book.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ is_archived: !book.is_archived })
        });
        if (res.ok) {
          setBooks(books.map(b => b.id === book.id ? { ...b, is_archived: !book.is_archived } : b));
          showToast(book.is_archived ? "Book restored" : "Book archived");
        }
      } catch (err) { showToast("Error updating book"); }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[#1C1917]">Books Catalogue</h2>
          <button onClick={() => setEditingBook({})} className="bg-[#1C1917] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#991B1B]">
            + Add New Book
          </button>
        </div>

        {editingBook && (
          <form onSubmit={saveBook} className="bg-stone-50 p-6 rounded-xl border border-stone-200 grid grid-cols-2 gap-4">
            <h3 className="col-span-2 text-lg font-bold">{editingBook.id ? "Edit Book" : "New Book"}</h3>
            <input name="title" defaultValue={editingBook.title} placeholder="Title" required className="p-2 border rounded" />
            <input name="author" defaultValue={editingBook.author} placeholder="Author" required className="p-2 border rounded" />
            <input name="category" defaultValue={editingBook.category} placeholder="Category" required className="p-2 border rounded" />
            <input name="price" type="number" defaultValue={editingBook.price} placeholder="Price (KSh)" required className="p-2 border rounded" />
            <input name="stock" type="number" defaultValue={editingBook.stock || 0} placeholder="Stock Quantity" required className="p-2 border rounded" />
            <input name="cover_url" defaultValue={editingBook.cover_url} placeholder="Cover Image URL" className="p-2 border rounded" />
            <div className="col-span-2 flex gap-3 mt-2">
              <button type="submit" className="bg-[#991B1B] text-white px-6 py-2 rounded-lg text-sm font-semibold">Save</button>
              <button type="button" onClick={() => setEditingBook(null)} className="bg-stone-200 px-6 py-2 rounded-lg text-sm font-semibold">Cancel</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map(book => (
            <div key={book.id} className={`p-4 rounded-xl border flex gap-4 ${book.is_archived ? "bg-stone-100 opacity-60" : "bg-white"}`}>
              <div className="w-16 h-24 bg-stone-200 rounded shrink-0 bg-cover bg-center" style={{ backgroundImage: `url(${book.cover_url})` }} />
              <div className="flex-1">
                <h4 className="font-bold text-sm line-clamp-1">{book.title}</h4>
                <p className="text-xs text-stone-500">{book.author}</p>
                <p className="text-sm font-semibold mt-1">KSh {book.price}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditingBook(book)} className="text-xs bg-stone-200 px-3 py-1 rounded hover:bg-stone-300">Edit</button>
                  <button onClick={() => toggleArchive(book)} className={`text-xs px-3 py-1 rounded text-white ${book.is_archived ? "bg-stone-500" : "bg-red-600"}`}>
                    {book.is_archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const InventoryTab = () => {
    const updateStock = async (id, newStock) => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/books/${id}`, {
          method: "PATCH", headers, body: JSON.stringify({ stock: newStock })
        });
        if (res.ok) {
          setBooks(books.map(b => b.id === id ? { ...b, stock: newStock } : b));
          showToast("Inventory updated");
        }
      } catch (err) { showToast("Error updating inventory"); }
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#1C1917]">Inventory Management</h2>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3">Book Title</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Quick Update</th>
              </tr>
            </thead>
            <tbody>
              {books.filter(b => !b.is_archived).map(book => (
                <tr key={book.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium">{book.title}</td>
                  <td className="px-4 py-3">{book.stock || 0}</td>
                  <td className="px-4 py-3">
                    {book.stock <= 0 ? <Badge color="red">Out of Stock</Badge> : book.stock < 5 ? <Badge color="yellow">Low Stock</Badge> : <Badge color="green">In Stock</Badge>}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <input 
                      type="number" 
                      defaultValue={book.stock} 
                      id={`stock-${book.id}`}
                      className="w-20 border rounded px-2 py-1 text-xs"
                    />
                    <button 
                      onClick={() => updateStock(book.id, Number(document.getElementById(`stock-${book.id}`).value))}
                      className="bg-stone-800 text-white px-3 py-1 rounded text-xs"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const CustomersTab = () => {
    const toggleRole = async (user) => {
      const newRole = user.role === "admin" ? "customer" : "admin";
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
          setCustomers(customers.map(c => c.id === user.id ? { ...c, role: newRole } : c));
          showToast("User role updated");
        }
      } catch (err) { showToast("Error updating role"); }
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#1C1917]">Customer Profiles</h2>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(user => (
                <tr key={user.id} className="border-t border-stone-100">
                  <td className="px-4 py-3">{user.email || "N/A"}</td>
                  <td className="px-4 py-3">{user.first_name} {user.last_name}</td>
                  <td className="px-4 py-3">
                    <Badge color={user.role === "admin" ? "blue" : "gray"}>{user.role || "customer"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleRole(user)} className="text-xs bg-stone-200 px-3 py-1 rounded hover:bg-stone-300">
                      {user.role === "admin" ? "Revoke Admin" : "Make Admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- Layout Render ---
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-stone-50">Loading Admin Dashboard...</div>;

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "orders", label: "Orders", icon: "📦" },
    { id: "books", label: "Books", icon: "📚" },
    { id: "inventory", label: "Inventory", icon: "🔄" },
    { id: "customers", label: "Customers", icon: "👥" }
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-stone-200">
          <h1 className="text-xl font-bold text-[#1C1917]">BookHaven Admin</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-[#991B1B] text-white" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "orders" && <OrdersTab />}
        {activeTab === "books" && <BooksTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "customers" && <CustomersTab />}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-stone-800 text-white px-6 py-3 rounded-lg shadow-xl animate-fade-in z-50">
          {toast}
        </div>
      )}
    </div>
  );
}