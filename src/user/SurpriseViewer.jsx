import { useEffect, useRef, useState } from "react";
import { supabase } from "../core/supabase/client";

function normalizeTemplateSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getTemplateUrl(slug) {
  const wantedSlug = normalizeTemplateSlug(slug);

  if (
    wantedSlug === "birthday-cute" ||
    wantedSlug === "birthday-premium" ||
    wantedSlug === "birthday"
  ) {
    return "/surprises/birthday/birthday-cute/index.html";
  }

  return null;
}

function SurpriseViewer() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);
  const [activeMemory, setActiveMemory] = useState(null);
  const templateFrameRef = useRef(null);

  useEffect(() => {
    async function loadSurprise() {
      const pathParts = window.location.pathname
        .split("/")
        .filter(Boolean);

      const publicId = pathParts[1];

      if (!publicId) {
        setError("Surprise ID is missing.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: functionError } =
          await supabase.functions.invoke("public-surprise", {
            body: {
              publicId,
            },
          });

        if (functionError) {
          console.error("Public Surprise Function Error:", functionError);
          throw new Error("This surprise is not available yet.");
        }

        if (!data?.success) {
          throw new Error(
            data?.error || "Unable to load surprise."
          );
        }

        setResult(data);
      } catch (err) {
        console.error("Surprise Viewer Error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSurprise();
  }, []);

  function getValue(fieldKey) {
    const item = result?.values?.find(
      (value) => value.field_key === fieldKey
    );

    if (!item) return "";

    if (item.value_text != null) {
      return item.value_text;
    }

    if (item.value_number != null) {
      return item.value_number;
    }

    if (item.value_boolean != null) {
      return item.value_boolean ? "Yes" : "No";
    }

    if (item.value_date != null) {
      return item.value_date;
    }

    if (item.value_json != null) {
      return item.value_json;
    }

    return "";
  }

  if (loading) {
    return (
      <main className="cute-viewer-loading">
        <div className="cute-loader">
          <div className="cute-loader-heart">♥</div>
          <p>Preparing something special...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="cute-viewer-error">
        <div className="cute-error-card">
          <div className="cute-error-icon">♡</div>

          <span className="cute-small-label">
            SURPRIZYY
          </span>

          <h1>Surprise unavailable</h1>

          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!result?.surprise) {
    return (
      <main className="cute-viewer-error">
        <div className="cute-error-card">
          <div className="cute-error-icon">♡</div>

          <span className="cute-small-label">
            SURPRIZYY
          </span>

          <h1>Surprise unavailable</h1>

          <p>We couldn't find this surprise.</p>
        </div>
      </main>
    );
  }

  const surprise = result.surprise;
  const template = result.template;
  const publicId =
    window.location.pathname.split("/").filter(Boolean)[1] || "";
  const templateSlug = template?.slug || "birthday-cute";
  const isBirthdayCute =
    templateSlug === "birthday-cute" ||
    templateSlug === "birthday-premium" ||
    templateSlug === "birthday";

  const mainPhoto =
    result.media?.find(
      (item) => item.field_key === "main_photo"
    )?.signed_url;

  const templateFileUrl = getTemplateUrl(templateSlug);

  if (templateFileUrl) {
    const templateUrl = new URL(templateFileUrl, window.location.href);
    templateUrl.searchParams.set("id", publicId);
    templateUrl.searchParams.set("hosted", "1");

    const templateData = {
      recipientName: surprise.recipient_name || "",
      message: getValue("special_message"),
      values: result.values || [],
      media: result.media || [],
    music: result.music || null,
    template,
    };

    return (
      <main className="custom-surprise-viewer">
        <iframe
          ref={templateFrameRef}
          title="Birthday surprise"
          src={templateUrl.href}
          className="surprise-template-frame"
          loading="eager"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={() => {
            templateFrameRef.current?.contentWindow?.postMessage(
              {
                type: "surprizyy-template-data",
                payload: templateData,
              },
              window.location.origin
            );
          }}
        />
      </main>
    );
  }

  const memoryPhotos =
    result.media?.filter(
      (item) => item.field_key === "memory_photos"
    ) || [];

  const specialMessage = getValue("special_message");

  if (!isBirthdayCute) {
    return (
      <main className="cute-viewer-error">
        <div className="cute-error-card">
          <div className="cute-error-icon">♡</div>
          <span className="cute-small-label">SURPRIZYY</span>
          <h1>Template unavailable</h1>
          <p>
            This surprise uses a template that is not available in the
            current viewer.
          </p>
        </div>
      </main>
    );
  }

  if (!opened) {
    return (
      <main className="cute-opening-page">
        <div className="cute-floating cute-floating-one">♡</div>
        <div className="cute-floating cute-floating-two">✦</div>
        <div className="cute-floating cute-floating-three">♡</div>

        <section className="cute-opening-card">
          <div className="cute-opening-top">
            <span>✨</span>
            <span>💗</span>
            <span>✨</span>
          </div>

          <span className="cute-opening-label">
            A LITTLE SOMETHING FOR YOU
          </span>

          <h1>
            Hey{" "}
            <strong>
              {surprise.recipient_name || "You"}
            </strong>
            ...
          </h1>

          <p>
            Someone made a little corner of the internet
            just for you.
          </p>

          <div className="cute-envelope">
            <div className="cute-envelope-heart">♥</div>
          </div>

          <button
            type="button"
            className="cute-open-button"
            onClick={() => setOpened(true)}
          >
            Open Your Surprise
            <span>→</span>
          </button>

          <div className="cute-opening-footer">
            made with love on Surprizyy
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="cute-surprise-page">
      <div className="cute-page-glow cute-page-glow-one" />
      <div className="cute-page-glow cute-page-glow-two" />

      <section className="cute-surprise-container">

        <header className="cute-hero">
          <span className="cute-eyebrow">
            ✦ A SURPRISE FOR YOU ✦
          </span>

          <h1>
            {surprise.recipient_name ||
              "Someone Special"}
          </h1>

          {template?.name && (
            <p className="cute-template-name">
              {template.name}
            </p>
          )}

          <div className="cute-divider">
            <span>♡</span>
            <i />
            <span>♡</span>
          </div>
        </header>

        {mainPhoto && (
          <section className="cute-main-photo-section">
            <div className="cute-photo-frame">
              <div className="cute-photo-tape" />

              <img
                src={mainPhoto}
                alt="A special memory"
              />

              <div className="cute-photo-caption">
                a little moment worth remembering ♡
              </div>
            </div>
          </section>
        )}

        {specialMessage && (
          <section className="cute-message-section">
            <div className="cute-section-label">
              <span>💌</span>
              A MESSAGE FOR YOU
            </div>

            <div className="cute-message-card">
              <div className="cute-message-mark">“</div>

              <p>{specialMessage}</p>

              <div className="cute-message-heart">
                ♥
              </div>
            </div>
          </section>
        )}

        {memoryPhotos.length > 0 && (
          <section className="cute-memories-section">
            <div className="cute-section-heading">
              <div>
                <span className="cute-section-label">
                  <span>📸</span>
                  LITTLE MEMORIES
                </span>

                <h2>
                  Moments we don't want to forget
                </h2>
              </div>

              <span className="cute-memory-count">
                {memoryPhotos.length} memories
              </span>
            </div>

            <div className="cute-memory-grid">
              {memoryPhotos.map((item, index) => (
                <button
                  type="button"
                  className={`cute-memory-item cute-memory-${index % 4}`}
                  key={item.id}
                  onClick={() => setActiveMemory(item)}
                >
                  <img
                    src={item.signed_url}
                    alt={
                      item.original_filename ||
                      `Memory ${index + 1}`
                    }
                  />

                  <span className="cute-memory-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="cute-viewer-footer">
          <div className="cute-footer-heart">♥</div>

          <p>
            Some moments deserve their own little place.
          </p>

          <span>
            Made with love on Surprizyy
          </span>
        </footer>
      </section>

      {activeMemory && (
        <div
          className="cute-lightbox"
          onClick={() => setActiveMemory(null)}
        >
          <button
            type="button"
            className="cute-lightbox-close"
            onClick={() => setActiveMemory(null)}
            aria-label="Close photo"
          >
            ×
          </button>

          <img
            src={activeMemory.signed_url}
            alt={
              activeMemory.original_filename ||
              "Memory"
            }
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}

export default SurpriseViewer;