import React from "react";

export default function CreateSurprise({ navigate }) {
  const categories = [
    {
      id: "birthday",
      icon: "🎂",
      title: "Birthday",
      description: "Create a beautiful birthday surprise",
    },
    {
      id: "best-friend",
      icon: "💝",
      title: "Best Friend",
      description: "A special surprise for your bestie",
    },
    {
      id: "rakhi",
      icon: "🌸",
      title: "Rakhi",
      description: "Create a heartfelt Rakhi surprise",
    },
  ];

  return (
    <main className="create-surprise-page">
      <button
        type="button"
        className="back-button"
        onClick={() => navigate("/")}
      >
        ← Back
      </button>

      <section className="create-header">
        <span>✨ Surprizyy</span>

        <h1>What are you creating?</h1>

        <p>
          Choose a surprise type and we'll help you create something
          memorable.
        </p>
      </section>

      <section className="create-category-grid">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="create-category-card"
            onClick={() => {
  if (category.id === "birthday") {
    navigate("/create/birthday");
  }
}}
          >
            <span className="create-category-icon">
              {category.icon}
            </span>

            <strong>{category.title}</strong>

            <small>{category.description}</small>

            <span className="category-arrow">→</span>
          </button>
        ))}
      </section>
    </main>
  );
}