import React from "react";

export default function TemplateSelection({
  navigate,
  templates = [],
  gift = null,
}) {
 const activeTemplates = templates.filter(
  (template) =>
    (template.is_active === true ||
      template.active === true) &&
    template.template_version_id
);
  return (
    <main className="template-selection-page">
      <button
        type="button"
        className="back-button"
        onClick={() => navigate("/create")}
      >
        ← Back
      </button>

      <section className="template-header">
        <span>
          {gift?.emoji || "🎁"} {gift?.name || "Surprise"}
        </span>

        <h1>Choose a template</h1>

        <p>
          Pick the experience that matches the person and the moment.
        </p>
      </section>

      {activeTemplates.length === 0 ? (
        <div className="empty-state">
          <p>No templates are available right now.</p>
        </div>
      ) : (
        <section className="template-grid">
          {activeTemplates.map((template) => {
            const price =
              template.final_price ??
              template.base_price ??
              template.price ??
              0;

            const title =
              template.name ||
              template.title ||
              "Untitled Template";

            const description =
              template.description ||
              "A special Surprizyy experience.";

            const slug =
              template.slug ||
              template.id;

            const preview =
              template.preview_url ||
              template.preview_urls?.[0];

            return (
              <article
                key={template.id}
                className="template-card"
              >
                <div className="template-preview">
                  {preview ? (
                    <img
                      src={preview}
                      alt={title}
                    />
                  ) : (
                    <span>✨</span>
                  )}
                </div>

                <div className="template-info">
                  <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>

                  <strong>₹{price}</strong>
                </div>

                <button
                  type="button"
                  className="template-select-button"
                  onClick={() =>
                    navigate(
                      `/create/${
                        gift?.slug ||
                        gift?.id ||
                        "surprise"
                      }/${slug}`
                    )
                  }
                >
                  Choose Template
                </button>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}