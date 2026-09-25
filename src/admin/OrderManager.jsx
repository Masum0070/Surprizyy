import React from "react";
import { supabase } from "../core/supabase/client";
import { getAdminSessionHeaders } from "./AdminSession";
import "./../styles/order-manager.css";

export default function OrderManager() {

    const [search, setSearch] = React.useState("");
const [statusFilter, setStatusFilter] = React.useState("all");
const [orders, setOrders] = React.useState([]);
const [loading, setLoading] = React.useState(true);
const [error, setError] = React.useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const headers = await getAdminSessionHeaders();
      const { data, error: functionError } =
        await supabase.functions.invoke("surprise-management", {
          body: { action: "list_orders" },
          headers,
        });
      if (functionError || !data?.success) {
        throw new Error(
          data?.error ||
            functionError?.message ||
            "Failed to load orders."
        );
      }
      setOrders(data.orders || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load orders."
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadOrders();
  }, []);

  const visibleOrders = orders.filter((order) => {
    const matchesSearch =
      !search ||
      order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      order.provider_order_id?.toLowerCase().includes(search.toLowerCase()) ||
      order.provider_payment_id?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="admin-order-manager">
      <div className="admin-section-header">
        <div>
          <span className="admin-header-label">ORDERS</span>
          <h2>Order Management</h2>
          <p>View and manage customer surprise orders.</p>
        </div>
      </div>

      <div className="admin-order-stats">
        <div className="admin-order-stat">
          <span>Total Orders</span>
          <strong>{orders.length}</strong>
        </div>

        <div className="admin-order-stat">
          <span>Pending</span>
          <strong>
            {orders.filter((order) => order.status === "created").length}
          </strong>
        </div>

        <div className="admin-order-stat">
          <span>Completed</span>
          <strong>
            {orders.filter((order) => order.status === "verified").length}
          </strong>
        </div>

        <div className="admin-order-stat">
          <span>Revenue</span>
          <strong>
            ₹
            {orders
              .filter((order) => order.status === "verified")
              .reduce((total, order) => total + Number(order.amount || 0), 0)}
          </strong>
        </div>
      </div>

      <div className="admin-order-panel">
        <div className="admin-order-toolbar">
  <input
    type="search"
    value={search}
    onChange={(event) => setSearch(event.target.value)}
    placeholder="Search orders..."
    aria-label="Search orders"
  />

  <select
    value={statusFilter}
    onChange={(event) =>
      setStatusFilter(event.target.value)
    }
    aria-label="Filter orders by status"
  >
    <option value="all">All Status</option>
    <option value="created">Pending</option>
    <option value="verified">Paid</option>
    <option value="failed">Failed</option>
    <option value="refunded">Refunded</option>
  </select>
</div>
        <div className="admin-list-header">
          <div>
            <h3>Recent Orders</h3>
            <p>Customer orders will appear here.</p>
          </div>

          <button type="button" onClick={loadOrders}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && <p role="alert">{error}</p>}
        {visibleOrders.length === 0 && !loading ? (
          <div className="admin-order-empty">
            <div>📦</div>
            <strong>No orders found</strong>
            <p>Verified payment orders will appear here.</p>
          </div>
        ) : (
          <div className="admin-order-list">
            {visibleOrders.map((order) => (
              <div className="admin-order-row" key={order.id}>
                <div className="admin-order-customer">
                  <strong>{order.customer_name || order.recipient_name || "Unnamed customer"}</strong>
                  <span>{order.customer_email || "No email"}{order.customer_phone ? ` · ${order.customer_phone}` : ""}</span>
                </div>
                <div className="admin-order-payment-id">
                  <span>Order ID</span>
                  <code>{order.provider_order_id || "—"}</code>
                  <span>Transaction ID</span>
                  <code>{order.provider_payment_id || "Pending"}</code>
                </div>
                <div className="admin-order-amount">
                  <strong>{order.currency} {order.amount}</strong>
                  <span className={`admin-order-status admin-order-status-${order.status}`}>{order.status}</span>
                  <span className={`admin-order-refund-proof ${order.non_refundable_accepted ? "is-accepted" : ""}`}>
                    {order.non_refundable_accepted ? "Non-refundable accepted" : "Not accepted"}
                  </span>
                </div>
                <time dateTime={order.verified_at || order.created_at}>
                  {new Date(order.verified_at || order.created_at).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}