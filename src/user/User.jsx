import React from "react";
import "../styles/user.css";

export default function User({ navigate }) {
  return (
    <main className="surprizyy-home">
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

      <section className="categories-section">
        <div className="section-heading">
          <span>Explore</span>
          <h2>Choose your surprise</h2>
          <p>Pick a moment and let's make it special.</p>
        </div>

        <div className="category-grid">
          <button type="button" className="category-card">
            <span className="category-icon">🎂</span>
            <strong>Birthday</strong>
            <small>Make their birthday unforgettable</small>
          </button>

          <button type="button" className="category-card">
            <span className="category-icon">💝</span>
            <strong>Best Friend</strong>
            <small>A special surprise for your bestie</small>
          </button>

          <button type="button" className="category-card">
            <span className="category-icon">🌸</span>
            <strong>Rakhi</strong>
            <small>A heartfelt Rakhi memory</small>
          </button>

          <button type="button" className="category-card">
            <span className="category-icon">✨</span>
            <strong>More Surprises</strong>
            <small>More special moments coming soon</small>
          </button>
        </div>
      </section>
    </main>
  );
}