import React, { useState } from "react";
import "../styles/user.css";

export default function User({ navigate }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="surprizyy-home">
      <header className="home-navigation">
        <div className="home-logo-placeholder" aria-label="Logo placeholder">
          LOGO
        </div>

        <button
          type="button"
          className={`home-menu-toggle${menuOpen ? " is-open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        {menuOpen && (
          <nav className="home-menu" aria-label="Main menu">
            <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
            <a href="#support" onClick={() => setMenuOpen(false)}>Support</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <a href="#privacy" onClick={() => setMenuOpen(false)}>Privacy</a>
          </nav>
        )}
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <span className="hero-badge">✨ Make moments unforgettable</span>

          <h1>
            Create a surprise
            <br />
            they'll never forget.
          </h1>

          <p>
            Beautiful digital surprises made with love — birthdays,
            friendships, celebrations and special moments.
          </p>

          <button
  type="button"
  className="hero-button"
  onClick={() => navigate("/create")}
>
  Create a Surprise
</button>
        </div>
      </section>

    </main>
  );
}