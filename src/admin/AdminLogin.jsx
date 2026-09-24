import { useState } from "react";
import { supabase } from "../core/supabase/client";
import "../styles/admin-login.css";

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showAccessWarning, setShowAccessWarning] = useState(true);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw new Error(loginError.message);
      }

      if (!data?.session || !data?.user) {
        throw new Error(
          "Login session was not created."
        );
      }

      const { data: authData, error: authError } =
        await supabase.functions.invoke(
          "admin-auth",
          {
            body: {
              action: "login",
            },
            headers: {
              Authorization:
                `Bearer ${data.session.access_token}`,
            },
          }
        );

      if (authError) {
        await supabase.auth.signOut();

        throw new Error(
          authError.message ||
            "Unable to verify admin account."
        );
      }

      if (
        !authData?.success ||
        !authData?.admin ||
        !authData?.admin_session
      ) {
        await supabase.auth.signOut();

        throw new Error(
          authData?.error ||
            "This account is not an admin."
        );
      }

      const profile = authData.admin;
        sessionStorage.setItem(
  "surprizyy_admin_profile",
  JSON.stringify({
    id: profile.id,
    user_id: profile.user_id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    active: profile.active,
    permissions: profile.permissions,
  })
);
      if (!profile.active) {
        await supabase.auth.signOut();

        throw new Error(
          "This admin account is inactive."
        );
      }

      sessionStorage.setItem(
        "surprizyy_admin_session",
        JSON.stringify(
          authData.admin_session
        )
      );

      if (onLogin) {
        onLogin({
          user: data.user,
          session: data.session,
          profile,
          login: authData.login,
          adminSession:
            authData.admin_session,
        });
      }
    } catch (err) {
      setError(
        err?.message ||
          "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLampClick() {
  setUnlocked((current) => !current);
}

  return (
    <div className="admin-login">

      <div className="admin-login-ambient" />

      <div
        className={`admin-login-stage ${
          unlocked
            ? "is-unlocked"
            : ""
        }`}
      >

        {/* Fireflies */}

        <div
          className="admin-fireflies"
          aria-hidden="true"
        >
          {Array.from(
            { length: 18 },
            (_, index) => (
              <span
                key={index}
                className="admin-firefly"
                style={{
                  "--admin-firefly-delay":
                    `${(index % 6) * 0.45}s`,
                  "--admin-firefly-duration":
                    `${3.5 + (index % 4) * 0.6}s`,
                  left:
                    `${8 + ((index * 13) % 84)}%`,
                  top:
                    `${15 + ((index * 17) % 70)}%`,
                }}
              />
            )
          )}
        </div>

        {/* Lamp */}

        <button
          type="button"
          className="admin-lamp"
          onClick={handleLampClick}
          aria-label={
            unlocked
              ? "Admin login unlocked"
              : "Turn on the admin lamp"
          }
        >
          <span className="admin-lamp-pole" />

          <span className="admin-lamp-shade" />

          <span className="admin-lamp-bulb" />

          <span className="admin-lamp-beam" />

          <span className="admin-lamp-base" />
        </button>

        {/* Tap instruction */}

        {!unlocked && (
          <p className="admin-tap-hint">
            Tap the light
          </p>
        )}

        {/* Login */}

        {showAccessWarning ? (
          <section className="admin-warning-card" aria-labelledby="admin-warning-title">
            <div className="admin-warning-icon" aria-hidden="true">!</div>
            <span className="admin-warning-label">SECURITY NOTICE</span>
            <h1 id="admin-warning-title">Authorized access only</h1>
            <p>
              This secure area is for approved Surprizyy administrators only.
              Every role, including Super Admin, is monitored and protected.
            </p>
            <ul>
              <li>Never share your admin password or session.</li>
              <li>Only use this panel on a trusted device.</li>
              <li>All sensitive actions are recorded in the audit log.</li>
            </ul>
            <button
              type="button"
              className="admin-warning-confirm"
              onClick={() => setShowAccessWarning(false)}
            >
              Confirm &amp; Continue
            </button>
          </section>
        ) : (
        <div className="admin-login-card">

          <h1>
            SURPRIZYY
          </h1>

          <p>
            Welcome back, Admin.
          </p>

          <form
            onSubmit={handleSubmit}
          >
<div className="admin-access-footer">
  <div className="admin-access-line" />

  <div className="admin-access-label">
    ADMINISTRATIVE ACCESS
  </div>
  <div className="admin-access-status">
    <span className="admin-access-dot" />
    <span>AUTHORIZED PERSONNEL ONLY</span>
  </div>

  <div className="admin-access-secure">
    SECURE SESSION • SURPRIZYY CONTROL
  </div>
</div>
            <div className="admin-login-field">
              <label htmlFor="admin-email">
                Admin ID
              </label>

              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="Admin email"
                autoComplete="email"
                required
              />
            </div>

            <div className="admin-login-field">
              <label htmlFor="admin-password">
                Password
              </label>

              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Admin password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="admin-login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "LOGIN"}
            </button>

          </form>
        </div>
        )}

      </div>
    </div>
  );
}

export default AdminLogin;