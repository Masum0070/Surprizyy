import { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";

import AdminLogin from "./AdminLogin";
import GiftManager from "./GiftManager";
import TemplateManager from "./TemplateManager";
import FormBuilder from "./FormBuilder";
import SettingsPanel from "./SettingsPanel";
import PublishManager from "./PublishManager";
import OrderManager from "./OrderManager";
import AdminUser from "./AdminUser";
import CustomerDetails from "./CustomerDetails";

import {
  getAdminSessionHeaders,
  revokeAdminSession,
  startAdminSessionMonitor,
  stopAdminSessionMonitor,
} from "./AdminSession";

import "../styles/admin.css";

function Admin() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [dashboardLampOn, setDashboardLampOn] = useState(false);
  const [dashboardOrders, setDashboardOrders] = useState([]);
  const [dashboardCustomers, setDashboardCustomers] = useState([]);
  const [dashboardTemplates, setDashboardTemplates] = useState([]);
  const [dashboardOrdersLoading, setDashboardOrdersLoading] = useState(false);
  const normalizedRole = String(profile?.role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const isSuperAdmin =
    normalizedRole === "super_admin" ||
    normalizedRole === "superadmin" ||
    normalizedRole === "admin";

  const canAccess = (permission) =>
    isSuperAdmin || profile?.permissions?.[permission] === true;

  async function loadDashboardData() {
    if (!session) return;

    setDashboardOrdersLoading(true);
    try {
      const headers = await getAdminSessionHeaders();
      const requests = [];
      if (canAccess("manage_orders")) {
        requests.push(
          supabase.functions.invoke("surprise-management", {
            body: { action: "list_orders" },
            headers,
          })
        );
      } else {
        requests.push(Promise.resolve(null));
      }
      if (canAccess("manage_customers")) {
        requests.push(
          supabase.functions.invoke("surprise-management", {
            body: { action: "list_customers" },
            headers,
          })
        );
      } else {
        requests.push(Promise.resolve(null));
      }
      if (canAccess("manage_templates")) {
        requests.push(
          supabase.functions.invoke("template-management", {
            body: { action: "list", page: 1 },
            headers,
          })
        );
      } else {
        requests.push(Promise.resolve(null));
      }

      const [ordersResult, customersResult, templatesResult] =
        await Promise.all(requests);
      setDashboardOrders(ordersResult?.data?.success ? ordersResult.data.orders || [] : []);
      setDashboardCustomers(
        customersResult?.data?.success ? customersResult.data.customers || [] : []
      );
      setDashboardTemplates(
        templatesResult?.data?.success ? templatesResult.data.templates || [] : []
      );
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setDashboardOrders([]);
      setDashboardCustomers([]);
      setDashboardTemplates([]);
    } finally {
      setDashboardOrdersLoading(false);
    }
  }

  async function loadAdminSession(currentSession) {
    if (!currentSession?.user) {
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

   const storedProfile =
  sessionStorage.getItem(
    "surprizyy_admin_profile"
  );

if (!storedProfile) {
  setLoading(false);
  return;
}

let admin;

try {
  admin = JSON.parse(storedProfile);
} catch {
  sessionStorage.removeItem(
    "surprizyy_admin_profile"
  );

  setSession(null);
  setProfile(null);
  setLoading(false);
  return;
}

if (
  !admin?.id ||
  !admin?.user_id ||
  !admin?.role ||
  admin.user_id !== currentSession.user.id ||
  !admin.active
) {
  sessionStorage.removeItem(
    "surprizyy_admin_profile"
  );

  setSession(null);
  setProfile(null);
  setLoading(false);
  return;
}

    const storedAdminSession = sessionStorage.getItem(
      "surprizyy_admin_session"
    );

    /*
     * During the initial Supabase SIGNED_IN event,
     * AdminLogin.jsx has not created the temporary
     * admin session yet. Do NOT sign the user out here.
     */
    if (!storedAdminSession) {
      setLoading(false);
      return;
    }

    let adminSession;

    try {
      adminSession = JSON.parse(storedAdminSession);
    } catch {
      sessionStorage.removeItem("surprizyy_admin_session");

      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    if (
      !adminSession?.temporary_token ||
      !adminSession?.session_code
    ) {
      sessionStorage.removeItem("surprizyy_admin_session");

      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setSession({
      ...currentSession,
      login: null,
      adminSession,
    });

    setProfile(admin);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
  

    async function initialize() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      await loadAdminSession(currentSession);

      if (!currentSession) return;

    const stored = sessionStorage.getItem(
  "surprizyy_admin_session"
);

if (!stored) return;

startAdminSessionMonitor();
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!mounted) return;

        await loadAdminSession(currentSession);
      }
    );

    return () => {
      mounted = false;

      return () => {
  mounted = false;

  stopAdminSessionMonitor();

  subscription.unsubscribe();
};

      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [session, profile]);

  useEffect(() => {
    if (
      activePage !== "dashboard" ||
      !profile ||
      isSuperAdmin ||
      canAccess("manage_dashboard")
    ) {
      return;
    }

    const firstAllowedPage = [
      ["gifts", "manage_gifts"],
      ["templates", "manage_templates"],
      ["forms", "manage_forms"],
      ["surprises", "manage_surprises"],
      ["orders", "manage_orders"],
      ["customers", "manage_customers"],
      ["settings", "manage_settings"],
      ["users", "manage_admins"],
    ].find(([, permission]) => canAccess(permission));

    if (firstAllowedPage) {
      setActivePage(firstAllowedPage[0]);
    }
  }, [profile, activePage, isSuperAdmin]);

  async function handleLogout() {
  try {
    stopAdminSessionMonitor();
      sessionStorage.removeItem(
  "surprizyy_admin_profile"
);
    await revokeAdminSession();
  } catch (error) {
      console.error(
        "Failed to revoke admin session:",
        error
      );
    } finally {
      await supabase.auth.signOut();

      setSession(null);
      setProfile(null);
    }
  }

  function handleLogin(loginData) {
    if (loginData?.adminSession) {
      sessionStorage.setItem(
        "surprizyy_admin_session",
        JSON.stringify(loginData.adminSession)
      );
    }
    startAdminSessionMonitor();
    setSession({
      ...loginData.session,
      login: loginData.login,
      adminSession: loginData.adminSession,
    });

    setProfile(loginData.profile);
    setActivePage("dashboard");
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <p>Checking admin access...</p>
      </div>
    );
  }

  if (!session || !profile) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <main className="admin-dashboard">
      {dashboardLampOn && (
        <div className="admin-dashboard-particles" aria-hidden="true">
          {Array.from({ length: 45 }, (_, index) => (
            <span
              key={index}
              className="admin-dashboard-particle"
              style={{
                "--particle-left": `${(index * 37) % 100}%`,
                "--particle-delay": `${(index % 15) * 0.45}s`,
                "--particle-duration": `${7 + (index % 6)}s`,
                "--particle-size": `${2 + (index % 3)}px`,
                "--particle-drift": `${-45 + ((index * 17) % 90)}px`,
              }}
            />
          ))}
        </div>
      )}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon">✨</span>

          <div>
            <strong>Surprizyy</strong>
            <small>Admin Panel</small>
          </div>
        </div>

        <nav className="admin-nav">
          {canAccess("manage_dashboard") && <button
            type="button"
            className={`admin-nav-item ${activePage === "dashboard" ? "active" : ""
              }`}
            onClick={() => setActivePage("dashboard")}
          >
            <span>▦</span>
            Dashboard
          </button>}

          {canAccess("manage_gifts") && <button
            type="button"
            className={`admin-nav-item ${activePage === "gifts" ? "active" : ""
              }`}
            onClick={() => setActivePage("gifts")}
          >
            <span>🎁</span>
            Gifts
          </button>}

          {canAccess("manage_templates") && <button
            type="button"
            className={`admin-nav-item ${activePage === "templates" ? "active" : ""
              }`}
            onClick={() => setActivePage("templates")}
          >
            <span>🎨</span>
            Templates
          </button>}

          {canAccess("manage_forms") && <button
            type="button"
            className={`admin-nav-item ${activePage === "forms" ? "active" : ""
              }`}
            onClick={() => setActivePage("forms")}
          >
            <span>📝</span>
            Forms
          </button>}

          {canAccess("manage_surprises") && <button
            type="button"
            className={`admin-nav-item ${activePage === "surprises" ? "active" : ""
              }`}
            onClick={() => setActivePage("surprises")}
          >
            <span>📦</span>
            Surprises
          </button>}

          {canAccess("manage_orders") && <button
            type="button"
            className={`admin-nav-item ${activePage === "orders" ? "active" : ""
              }`}
            onClick={() => setActivePage("orders")}
          >
            <span>💳</span>
            Orders
          </button>}

          {canAccess("manage_customers") && <button
            type="button"
            className={`admin-nav-item ${activePage === "customers" ? "active" : ""
              }`}
            onClick={() => setActivePage("customers")}
          >
            <span>👤</span>
            Customer Details
          </button>}

          {canAccess("manage_admins") && <button
            type="button"
            className={`admin-nav-item ${activePage === "users" ? "active" : ""
              }`}
            onClick={() => setActivePage("users")}
          >
            <span>👥</span>
            Administrators
          </button>}

          {canAccess("manage_settings") && <button
            type="button"
            className={`admin-nav-item ${activePage === "settings" ? "active" : ""
              }`}
            onClick={() => setActivePage("settings")}
          >
            <span>⚙️</span>
            Settings
          </button>}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-divider" />

          <div className="admin-sidebar-profile">
            <div className="admin-sidebar-avatar">
              AR
            </div>

            <div className="admin-sidebar-profile-text">
              <strong>Admin</strong>
              <span>{profile.role === "super_admin" || profile.role === "admin" ? "Super admin" : profile.role?.replace(/_/g, " ")}</span>
            </div>
          </div>

          <button
            type="button"
            className="admin-sidebar-logout"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </aside>

      <section className="admin-main">

        <div className="admin-topbar">
          <div className="admin-topbar-search">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l5 5" />
            </svg>

            <input
              type="text"
              placeholder="Search anything..."
              aria-label="Search anything"
            />
          </div>

          <div className="admin-topbar-actions">
            <button
              type="button"
              className="admin-notification-button"
              aria-label="Notifications"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>

              <span className="admin-notification-dot" />
            </button>

            <div className="admin-topbar-profile-wrap">
              <button
                type="button"
                className="admin-topbar-avatar"
                onClick={() =>
                  setProfileMenuOpen((current) => !current)
                }
                aria-label="Admin menu"
              >
                AR
              </button>

              {profileMenuOpen && (
                <div className="admin-profile-dropdown">
                  <button
                    type="button"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

     

        {activePage === "dashboard" && canAccess("manage_dashboard") && (
          <>
            <section className="admin-page-header">
              <div>
                <span className="admin-header-label">
                  DASHBOARD
                </span>

                <h1>Welcome back</h1>

                <p>
                  Manage your Surprizyy store from one place.
                </p>
              </div>
            </section>

            <section className="admin-stats-grid">
              <article className="admin-stat-card">
                <div className="admin-stat-icon purple">
                  ✨
                </div>

                <span>Total Surprises</span>

                <strong>
                  {canAccess("manage_customers")
                    ? dashboardCustomers.length
                    : "—"}
                </strong>

                <small>Open surprise management</small>
              </article>

              <button
                type="button"
                className="admin-stat-card admin-stat-card-button"
                onClick={() => setActivePage("orders")}
              >
                <div className="admin-stat-icon pink">
                  🎁
                </div>

                <span>Active Templates</span>

                <strong>
                  {canAccess("manage_templates")
                    ? dashboardTemplates.length
                    : "—"}
                </strong>

                <small>Ready to publish</small>
              </button>

              <article className="admin-stat-card">
                <div className="admin-stat-icon green">
                  💳
                </div>

                <span>Total Orders</span>

                <strong>
                  {canAccess("manage_orders")
                    ? dashboardOrders.length
                    : "—"}
                </strong>

                <small>Click to open orders</small>
              </article>

              <button
                type="button"
                className="admin-stat-card admin-stat-card-button"
                onClick={() => setActivePage("orders")}
              >
                <div className="admin-stat-icon orange">
                  ₹
                </div>

                <span>Revenue</span>

                <strong>
                  {canAccess("manage_orders")
                    ? `₹${dashboardOrders
                        .filter((order) => order.status === "verified")
                        .reduce(
                          (total, order) => total + Number(order.amount || 0),
                          0
                        )}`
                    : "—"}
                </strong>

                <small>Click to open orders</small>
              </button>
            </section>

            <section className="admin-content-grid">

              {/* ORDERS OVERVIEW */}
              <article className="admin-panel-card admin-orders-overview">

                <div className="admin-panel-heading">
                  <div>
                    <span>ORDERS OVERVIEW</span>
                    <h2>Recent activity</h2>
                  </div>

                  <button
                    type="button"
                    className="admin-period-button"
                  >
                    Last 7 days⌄
                  </button>
                </div>

                <div className="admin-chart">

                  <div className="admin-chart-grid">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <svg
                    className="admin-chart-svg"
                    viewBox="0 0 700 240"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="adminChartGlow"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="rgba(216,169,74,0.18)"
                        />
                        <stop
                          offset="100%"
                          stopColor="rgba(216,169,74,0)"
                        />
                      </linearGradient>
                    </defs>

                    <path
                      d="M0 190
             C70 175, 100 155, 150 162
             S240 130, 290 145
             S370 115, 420 125
             S500 155, 545 130
             S625 100, 700 55
             L700 240
             L0 240 Z"
                      fill="url(#adminChartGlow)"
                    />

                    <path
                      d="M0 190
             C70 175, 100 155, 150 162
             S240 130, 290 145
             S370 115, 420 125
             S500 155, 545 130
             S625 100, 700 55"
                      fill="none"
                      stroke="#D8A94A"
                      strokeWidth="2"
                    />

                    <circle cx="0" cy="190" r="3" fill="#D8A94A" />
                    <circle cx="150" cy="162" r="3" fill="#D8A94A" />
                    <circle cx="290" cy="145" r="3" fill="#D8A94A" />
                    <circle cx="420" cy="125" r="3" fill="#D8A94A" />
                    <circle cx="545" cy="130" r="3" fill="#D8A94A" />
                    <circle cx="700" cy="55" r="3" fill="#D8A94A" />
                  </svg>

                  <div className="admin-chart-labels">
                    <span>16 Sep</span>
                    <span>17 Sep</span>
                    <span>18 Sep</span>
                    <span>19 Sep</span>
                    <span>20 Sep</span>
                    <span>21 Sep</span>
                    <span>22 Sep</span>
                  </div>

                </div>
              </article>


              {/* RECENT ORDERS */}
              <article className="admin-panel-card admin-recent-orders">

                <div className="admin-panel-heading">
                  <div>
                    <span>RECENT ORDERS</span>
                    <h2>Latest orders</h2>
                  </div>

                  <button
                    type="button"
                    className="admin-view-all"
                    onClick={() =>
                      setActivePage("orders")
                    }
                  >
                    View all →
                  </button>
                </div>

                <div className="admin-orders-list">
                  {dashboardOrdersLoading ? (
                    <div className="admin-order-empty">
                      <strong>Loading orders...</strong>
                    </div>
                  ) : dashboardOrders.length === 0 ? (
                    <button
                      type="button"
                      className="admin-order-empty admin-order-empty-button"
                      onClick={() => setActivePage("orders")}
                    >
                      <div className="admin-order-empty-icon">◇</div>
                      <strong>No orders yet</strong>
                      <p>Open Order Management to view and refresh orders.</p>
                    </button>
                  ) : (
                    <div className="admin-dashboard-order-table">
                      {dashboardOrders.slice(0, 5).map((order) => (
                        <button
                          type="button"
                          className="admin-dashboard-order-row"
                          key={order.id}
                          onClick={() => setActivePage("orders")}
                        >
                          <strong>{order.recipient_name || "Unnamed customer"}</strong>
                          <span>{order.customer_email || "No email"}</span>
                          <span>{order.currency} {order.amount}</span>
                          <span>{order.status}</span>
                          <small>{new Date(order.created_at).toLocaleString()}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>


              {/* LAMP */}
              <button
                type="button"
                className={`admin-dashboard-lamp ${dashboardLampOn ? "is-on" : ""
                  }`}
                aria-label={dashboardLampOn ? "Turn lamp off" : "Turn lamp on"}
                onClick={() => {
                  console.log("DASHBOARD LAMP CLICKED");
                  setDashboardLampOn((current) => !current);
                }}
              >
                <div className="admin-lamp-glow" />
                <div className="admin-lamp-shade" />
                <div className="admin-lamp-light" />
                <div className="admin-lamp-stem" />
                <div className="admin-lamp-base" />
              </button>
            </section>

            <section className="admin-system-card">
              <div className="admin-system-icon">
                🛡️
              </div>

              <div>
                <span>SECURITY</span>

                <h2>Admin security is enabled</h2>

                <p>
                  Authentication, session security and
                  admin access protection are enabled.
                </p>
              </div>
            </section>
          </>
        )}

        {activePage === "gifts" && canAccess("manage_gifts") && (
          <GiftManager />
        )}

        {activePage === "templates" && canAccess("manage_templates") && (
          <TemplateManager />
        )}

        {activePage === "forms" && canAccess("manage_forms") && (
          <FormBuilder />
        )}

        {activePage === "surprises" && canAccess("manage_surprises") && (
          <PublishManager />
        )}

        {activePage === "orders" && canAccess("manage_orders") && (
          <OrderManager />
        )}

        {activePage === "customers" && canAccess("manage_customers") && (
          <CustomerDetails />
        )}

        {activePage === "settings" && canAccess("manage_settings") && (
          <SettingsPanel />
        )}

        {activePage === "users" && canAccess("manage_admins") && (
          <AdminUser />
        )}
      </section>
    </main>
  );
}

export default Admin;