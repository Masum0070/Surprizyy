import { useEffect, useMemo, useState } from "react";
import { supabase } from "../core/supabase/client";
import { getAdminSessionHeaders } from "./AdminSession";
import "../styles/customer-details.css";

function valueText(value) {
  if (value.value_text != null) return value.value_text;
  if (value.value_number != null) return value.value_number;
  if (value.value_boolean != null) return value.value_boolean ? "Yes" : "No";
  if (value.value_date != null) return value.value_date;
  if (value.value_json != null) return JSON.stringify(value.value_json);
  return "";
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CustomerDetails() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [filter, setFilter] = useState("all");

  async function loadCustomers() {
    setLoading(true);
    setError("");
    try {
      const headers = await getAdminSessionHeaders();
      const { data, error: functionError } =
        await supabase.functions.invoke("surprise-management", {
          body: { action: "list_customers" },
          headers,
        });

      if (functionError || !data?.success) {
        throw new Error(
          data?.error ||
            functionError?.message ||
            "Failed to load customer details."
        );
      }
      setCustomers(data.customers || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load customer details."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function deleteCustomer(customer) {
    const confirmed = window.confirm(
      `Delete the surprise for ${customer.recipient_name || "this customer"}? This also permanently deletes its uploaded media.`
    );
    if (!confirmed) return;

    setDeletingId(customer.id);
    setError("");
    try {
      const headers = await getAdminSessionHeaders();
      const { data, error: functionError } =
        await supabase.functions.invoke("surprise-management", {
          body: {
            action: "delete_surprise",
            surprise_id: customer.id,
          },
          headers,
        });

      if (functionError || !data?.success) {
        throw new Error(
          data?.error ||
            functionError?.message ||
            "Failed to delete customer details."
        );
      }

      setCustomers((current) =>
        current.filter((item) => item.id !== customer.id)
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete customer details."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = customers.filter((customer) => {
      if (filter === "missing-email" && customer.customer_email) return false;
      if (filter === "missing-phone" && customer.customer_phone) return false;
      if (filter === "paid" && customer.payment?.status !== "verified") return false;
      return true;
    });
    if (!query) return filtered;
    return filtered.filter((customer) =>
      [
        customer.recipient_name,
        customer.customer_email,
        customer.customer_phone,
        customer.public_id,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query))
    );
  }, [customers, search, filter]);

  return (
    <section className="admin-panel-card customer-details-panel">
      <div className="admin-panel-heading">
        <div>
          <span>CUSTOMER DATA</span>
          <h2>Customer Details</h2>
          <p>View contact, order, payment, surprise, and form details.</p>
        </div>
        <button type="button" onClick={loadCustomers} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="customer-details-toolbar">
        <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name, email, phone, or order ID..."
        aria-label="Search customer details"
        />
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All customers</option>
          <option value="missing-email">Missing email</option>
          <option value="missing-phone">Missing phone</option>
          <option value="paid">Verified payment</option>
        </select>
      </div>

      {error && <p role="alert">{error}</p>}
      {!loading && !error && visibleCustomers.length === 0 && (
        <p>No customer records found.</p>
      )}

      <div className="customer-details-summary">
        <span>{visibleCustomers.length} customer{visibleCustomers.length === 1 ? "" : "s"}</span>
        <span>{customers.filter((item) => !item.customer_email).length} missing email</span>
        <span>{customers.filter((item) => !item.customer_phone).length} missing phone</span>
      </div>
      <div className="admin-customer-list">
        <div className="admin-customer-row admin-customer-row-header">
          <span>Customer</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Amount</span>
          <span>Method</span>
          <span>Verification</span>
          <span>Date &amp; time</span>
          <span>Action</span>
        </div>
        {visibleCustomers.map((customer) => (
          <article className="admin-customer-card" key={customer.id}>
            <div className="admin-customer-row">
              <div className="customer-identity">
                <strong>{customer.recipient_name || "Unnamed recipient"}</strong>
                <small>{customer.public_id}</small>
              </div>
              <span>{customer.customer_email || "No email"}</span>
              <span>{customer.customer_phone || "No phone"}</span>
              <span className="customer-amount">
                {customer.payment ? `${customer.payment.currency} ${customer.payment.amount}` : "—"}
              </span>
              <span className="customer-method">{customer.payment?.provider || "—"}</span>
              <span className="customer-verification">{customer.payment?.status || "Not linked"}</span>
              <span>{formatDateTime(customer.payment?.verified_at || customer.created_at)}</span>
              <button
                type="button"
                className="admin-delete-button"
                onClick={() => deleteCustomer(customer)}
                disabled={deletingId === customer.id}
              >
                {deletingId === customer.id ? "Deleting..." : "Delete"}
              </button>
            </div>

            <div className="customer-secondary-meta">
              <span>Status: {customer.status}</span>
              <span>Template: {customer.template_version?.version || "Unknown"}</span>
              <span>Media: {customer.media_count} file(s)</span>
            </div>

            {customer.values.length > 0 && (
              <div className="customer-form-data">
                <strong>Submitted form data</strong>
                <ul>
                  {customer.values.map((value) => (
                    <li key={`${customer.id}-${value.field_key}`}>
                      {value.field_key}: {valueText(value)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
