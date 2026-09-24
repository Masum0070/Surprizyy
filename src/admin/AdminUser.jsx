import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../core/supabase/client";
import { getAdminSessionHeaders } from "./AdminSession";
import "../styles/admin-user.css";

const roles = ["manager", "support_admin", "content_admin", "custom"];
const permissionOptions = [
  ["manage_dashboard", "Dashboard"],
  ["manage_gifts", "Gifts"],
  ["manage_templates", "Templates"],
  ["manage_forms", "Forms"],
  ["manage_surprises", "Surprises"],
  ["manage_orders", "Orders"],
  ["manage_customers", "Customer Details"],
  ["manage_settings", "Settings"],
  ["manage_admins", "Administrators"],
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default function AdminUser() {
  const [admins, setAdmins] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState("administrators");
  const [selected, setSelected] = useState(null);
  const [approvalTarget, setApprovalTarget] = useState(null);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [openActionsId, setOpenActionsId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [filters, setFilters] = useState({ search: "", action: "", result: "" });
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", role: "manager", permissions: {} });
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const call = useCallback(async (action, payload = {}) => {
    const headers = await getAdminSessionHeaders();
    const { data, error: invokeError } = await supabase.functions.invoke("admin-management", {
      body: { action, ...payload }, headers,
    });
    if (invokeError || !data?.success) {
      let responseError = "";
      if (invokeError?.context instanceof Response) {
        try {
          const responseBody = await invokeError.context.clone().json();
          responseError = responseBody?.error || "";
        } catch {
          responseError = "";
        }
      }
      throw new Error(
        data?.error ||
        responseError ||
        invokeError?.context?.error_description ||
        invokeError?.message ||
        "Admin request failed. Please refresh your admin session and try again."
      );
    }
    return data;
  }, []);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await call("list");
      setAdmins(data.admins || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load administrators.");
    } finally {
      setLoading(false);
    }
  }, [call]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await call("list_audit_logs", { limit: 200 });
      setLogs(data.audit_logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs.");
    } finally {
      setLogsLoading(false);
    }
  }, [call]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);
  useEffect(() => { if (tab === "audit") loadLogs(); }, [tab, loadLogs]);

  async function approveAdmin(admin) {
    setSaving(true);
    setError("");
    try {
      const data = await call("approve", { user_id: admin.user_id });
      setAdmins((current) =>
        current.map((item) => item.id === admin.id ? data.admin : item)
      );
      if (selected?.id === admin.id) setSelected(data.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve administrator.");
    } finally {
      setSaving(false);
      setApprovalTarget(null);
      setApprovalConfirmed(false);
    }
  }

  function openApprovalWarning(admin) {
    setApprovalTarget(admin);
    setApprovalConfirmed(false);
  }

  async function deleteAdmin(admin) {
    if (!window.confirm(`Delete ${admin.name || admin.email}? This permanently removes the Auth account and administrator data.`)) return;
    setSaving(true);
    setError("");
    try {
      await call("delete", { user_id: admin.user_id });
      setAdmins((current) => current.filter((item) => item.id !== admin.id));
      if (selected?.id === admin.id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete administrator.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAdmin(admin) {
    if (admin.role === "super_admin") {
      setError("The protected Super Admin account cannot be disabled from this panel.");
      return;
    }

    const next = !admin.active;
    if (!window.confirm(`${next ? "Enable" : "Disable"} ${admin.name}?`)) return;
    setSaving(true);
    try {
      const data = await call("update", { user_id: admin.user_id, active: next });
      setAdmins((current) => current.map((item) => item.id === admin.id ? data.admin : item));
      if (selected?.id === admin.id) setSelected(data.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update administrator.");
    } finally {
      setSaving(false);
    }
  }

  async function createAdmin(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await call("create", {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
        role: form.role,
        permissions: form.permissions,
      });
      setAdmins((current) => [data.admin, ...current]);
      setShowAdd(false);
      if (data.warning) {
        setError(data.warning);
      }
      setForm({ name: "", email: "", mobile: "", password: "", role: "manager", permissions: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create administrator.");
    } finally {
      setSaving(false);
    }
  }

  const visibleLogs = useMemo(() => logs.filter((log) => {
    const text = `${log.action || ""} ${log.actor_role || ""} ${log.actor_user_id || ""}`.toLowerCase();
    return (!filters.search || text.includes(filters.search.toLowerCase())) &&
      (!filters.action || log.action === filters.action) &&
      (!filters.result || (log.metadata?.result || "success") === filters.result);
  }), [logs, filters]);

  return (
    <section className="admin-panel-card admin-users-panel">
      <div className="admin-panel-heading admin-management-heading">
        <div>
          <span>SECURITY &amp; ACCESS</span>
          <h2>Admin Management</h2>
          <p>Manage administrators, permissions, and immutable security history.</p>
        </div>
        <div className="admin-management-actions">
          <button type="button" onClick={() => setShowAdd((value) => !value)}>{showAdd ? "Close" : "Add Admin"}</button>
          <button type="button" onClick={tab === "audit" ? loadLogs : loadAdmins} disabled={loading || logsLoading}>Refresh</button>
        </div>
      </div>

      <div className="admin-management-tabs">
        <button className={tab === "administrators" ? "is-active" : ""} onClick={() => setTab("administrators")}>Administrators</button>
        <button className={tab === "audit" ? "is-active" : ""} onClick={() => setTab("audit")}>Audit Logs</button>
      </div>

      {error && <p className="admin-management-error" role="alert">{error}</p>}

      {showAdd && (
        <form className="admin-add-form" onSubmit={createAdmin}>
          <div className="admin-form-title"><span>NEW ADMINISTRATOR</span><strong>Create secure profile</strong></div>
          <p className="admin-form-note">This creates the Auth account and administrator profile together. The password is sent only to Supabase Auth and is never stored in the profile.</p>
          <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input placeholder="Phone number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <div className="admin-password-field">
            <input type={showAdminPassword ? "text" : "password"} minLength="8" placeholder="Temporary password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <button
              type="button"
              className="admin-password-toggle"
              onClick={() => setShowAdminPassword((current) => !current)}
              aria-label={showAdminPassword ? "Hide administrator password" : "Show administrator password"}
              aria-pressed={showAdminPassword}
            >
              <span className="admin-eye-icon" aria-hidden="true" />
            </button>
          </div>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((role) => <option key={role} value={role}>{role.replace("_", " ")}</option>)}</select>
          <div className="admin-permission-grid">{permissionOptions.map(([permission, label]) => <label key={permission}><input type="checkbox" checked={form.permissions[permission] === true} onChange={(e) => setForm({ ...form, permissions: { ...form.permissions, [permission]: e.target.checked } })} /> {label}</label>)}</div>
          <button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Administrator"}</button>
        </form>
      )}

      {tab === "administrators" ? (
        <>
          {loading ? <p>Loading administrators...</p> : (
            <div className="admin-users-table">
              <div className="admin-users-table-row admin-users-table-head"><span>Administrator</span><span>Role</span><span>Status</span><span>Approval</span><span>Last login</span><span>Last activity</span><span>Actions</span></div>
              {admins.map((admin) => (
                <div className="admin-users-table-row" key={admin.id}>
                  <div className="admin-user-main"><strong>{admin.name || "Unnamed administrator"}</strong><span>{admin.email}</span><small>{admin.mobile || "No phone"} · Created {formatDate(admin.created_at)}</small></div>
                  <span className="admin-user-role">{admin.role?.replace("_", " ")}</span>
                  <span className={`admin-user-status ${admin.active ? "is-active" : "is-inactive"}`}>{admin.active ? "Active" : "Disabled"}</span>
                  <span className={`admin-user-approval ${admin.approval_status === "approved" ? "is-approved" : "is-pending"}`}>
                    {admin.approval_status === "approved" ? "Approved" : "Pending approval"}
                  </span>
                  <span>{formatDate(admin.last_login_at)}</span>
                  <span>{formatDate(admin.updated_at)}</span>
                  {admin.role === "super_admin" ? (
                    <span className="admin-user-protected">Protected</span>
                  ) : (
                    <div className="admin-row-actions">
                    <div className="admin-action-menu">
                      <button
                        type="button"
                        className="admin-user-actions"
                        aria-expanded={openActionsId === admin.id}
                        onClick={() => setOpenActionsId((current) => current === admin.id ? null : admin.id)}
                      >
                        Actions <span className="admin-action-chevron" aria-hidden="true" />
                      </button>
                      {openActionsId === admin.id && (
                        <div className="admin-action-menu-list" role="menu">
                          <button type="button" onClick={() => { setSelected(admin); setOpenActionsId(null); }}>View Details</button>
                          {admin.approval_status !== "approved" ? (
                            <button type="button" onClick={() => { openApprovalWarning(admin); setOpenActionsId(null); }}>Approve access</button>
                          ) : (
                            <button type="button" onClick={() => { toggleAdmin(admin); setOpenActionsId(null); }}>{admin.active ? "Disable" : "Enable"}</button>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="admin-user-delete"
                      onClick={() => deleteAdmin(admin)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                    </div>
                  )}
                </div>
              ))}
              {!admins.length && <p>No administrators found.</p>}
            </div>
          )}
        </>
      ) : (
        <div className="admin-audit-section">
          <div className="admin-audit-filters"><input placeholder="Search audit logs..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /><select value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })}><option value="">All results</option><option value="success">Success</option><option value="failed">Failed</option></select></div>
          {logsLoading ? <p>Loading audit logs...</p> : <div className="admin-audit-table"><div className="admin-audit-row admin-users-table-head"><span>Time</span><span>Admin</span><span>Action</span><span>Module</span><span>Target</span><span>Result</span></div>{visibleLogs.map((log) => { const result = log.metadata?.result || "success"; return <button className="admin-audit-row" key={log.id} type="button" onClick={() => setSelected(log)}><span>{formatDate(log.created_at)}</span><span>{log.actor_user_id || "System"}</span><span>{log.action}</span><span>{log.metadata?.module || "—"}</span><span>{log.target_user_id || "—"}</span><span className={result === "failed" ? "audit-failed" : "audit-success"}>{result}</span></button>; })}{!visibleLogs.length && <p>No audit entries found.</p>}</div>}
        </div>
      )}

      {selected && <div className="admin-details-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}><aside className="admin-details-drawer"><button className="admin-details-close" onClick={() => setSelected(null)}>×</button><span>ADMIN DETAILS</span><h3>{selected.name || selected.action}</h3><div className="admin-detail-tabs"><b>Overview</b><b>Permissions</b><b>Activity</b><b>Audit History</b></div><dl><dt>Email / Admin ID</dt><dd>{selected.email || selected.actor_user_id || selected.user_id || "—"}</dd><dt>Role / Action</dt><dd>{selected.role || selected.action || "—"}</dd><dt>Status / Result</dt><dd>{selected.active ? "Active" : selected.metadata?.result || "Disabled"}</dd><dt>Created / Timestamp</dt><dd>{formatDate(selected.created_at)}</dd><dt>Related record</dt><dd>{selected.target_user_id || "—"}</dd><dt>Metadata</dt><dd>{selected.metadata ? JSON.stringify(selected.metadata) : "No additional metadata"}</dd></dl></aside></div>}
      {approvalTarget && (
        <div
          className="admin-approval-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setApprovalTarget(null);
              setApprovalConfirmed(false);
            }
          }}
        >
          <section
            className="admin-approval-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-approval-title"
          >
            <div className="admin-approval-icon" aria-hidden="true">!</div>
            <span className="admin-approval-label">SUPER ADMIN APPROVAL</span>
            <h3 id="admin-approval-title">Approve administrator access?</h3>
            <p>
              You are approving <strong>{approvalTarget.name || approvalTarget.email}</strong>.
              This will activate the account, confirm its login email, and allow access to the
              assigned admin sections.
            </p>
            <label className="admin-approval-check">
              <input
                type="checkbox"
                checked={approvalConfirmed}
                onChange={(event) => setApprovalConfirmed(event.target.checked)}
                disabled={saving}
              />
              <span>I understand and approve this administrator access.</span>
            </label>
            <div className="admin-approval-actions">
              <button
                type="button"
                className="admin-approval-cancel"
                onClick={() => {
                  setApprovalTarget(null);
                  setApprovalConfirmed(false);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-approval-confirm"
                onClick={() => approveAdmin(approvalTarget)}
                disabled={!approvalConfirmed || saving}
              >
                {saving ? "Approving..." : "Approve & activate"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
