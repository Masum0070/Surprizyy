import { useEffect, useState } from "react";

import User from "./user/User";
import CreateSurprise from "./user/CreateSurprise";
import TemplateSelection from "./user/TemplateSelection";
import SurpriseForm from "./user/SurpriseForm";
import SurprisePreview from "./user/SurprisePreview";
import ManageSurprise from "./user/ManageSurprise";
import SurpriseViewer from "./user/SurpriseViewer";
import Admin from "./admin/Admin";
import Checkout from "./user/Checkout";
import Memories from "./user/Memories";
import FinalPreview from "./user/FinalPreview";
import Completion from "./user/Completion";
import MaintenancePage from "./user/MaintenancePage";
import "./styles/user.css";

function App() {
  const [route, setRoute] = useState(window.location.pathname);

  const [templates, setTemplates] = useState([]);
  const [maintenance, setMaintenance] = useState({
    loading: true,
    enabled: false,
    siteName: "Surprizyy",
  });

  useEffect(() => {
    let active = true;

    async function loadPublicSettings() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-settings`
        );
        const result = await response.json();

        if (active && result?.success) {
          setMaintenance({
            loading: false,
            enabled: result.settings?.maintenance_mode === true,
            siteName: result.settings?.site_name || "Surprizyy",
          });
          return;
        }
      } catch (error) {
        console.error("Public settings loading failed:", error);
      }

      if (active) {
        setMaintenance((current) => ({ ...current, loading: false }));
      }
    }

    loadPublicSettings();
    return () => {
      active = false;
    };
  }, []);

useEffect(() => {
  async function loadTemplates() {
    try {
      const response = await fetch(
        "https://emfawpnumnzsgzymjymj.supabase.co/rest/v1/templates?select=*&is_active=eq.true",
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load templates");
      }

      const data = await response.json();

const templatesWithVersions = await Promise.all(
  data.map(async (template) => {
    const versionResponse = await fetch(
      `https://emfawpnumnzsgzymjymj.supabase.co/rest/v1/template_versions?select=id,version,is_active&template_id=eq.${template.id}&is_active=eq.true&order=version.desc&limit=1`,
      {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      }
    );

    const versions = await versionResponse.json();

    return {
      ...template,
      template_version_id: versions?.[0]?.id || null,
      version: versions?.[0]?.version || null,
    };
  })
);

setTemplates(templatesWithVersions);
    } catch (error) {
      console.error("Template loading failed:", error);
    }
  }

  loadTemplates();
}, []);


  useEffect(() => {
    function handleNavigation() {
      setRoute(window.location.pathname);
    }

    window.addEventListener("popstate", handleNavigation);

    return () => {
      window.removeEventListener("popstate", handleNavigation);
    };
  }, []);

  function navigate(path) {
    window.history.pushState({}, "", path);
    setRoute(path);
  }

  // ADMIN
  if (route.startsWith("/admin")) {
    return <Admin />;
  }

  if (maintenance.loading) {
    return null;
  }

  if (maintenance.enabled) {
    return <MaintenancePage siteName={maintenance.siteName} />;
  }

  // FINAL PREVIEW
  if (
    route === "/create/birthday/birthday-cute/final-preview" ||
    route === "/create/birthday/birthday-premium/final-preview"
  ) {
    const parts = route.split("/");
    const template = parts[parts.length - 2];

    return (
      <FinalPreview
        navigate={navigate}
        template={template}
      />
    );
  }

  // MEMORIES
  if (
    route === "/create/birthday/birthday-cute/memories" ||
    route === "/create/birthday/birthday-premium/memories"
  ) {
    const parts = route.split("/");
    const template = parts[parts.length - 2];

    return (
      <Memories
        navigate={navigate}
        template={template}
      />
    );
  }

  // CHECKOUT
  if (
    route === "/create/birthday/birthday-cute/checkout" ||
    route === "/create/birthday/birthday-premium/checkout"
  ) {
    const parts = route.split("/");
    const template = parts[parts.length - 2];

    return (
      <Checkout
        navigate={navigate}
        template={template}
      />
    );
  }

  // PREVIEW
  if (
    route === "/create/birthday/birthday-cute/preview" ||
    route === "/create/birthday/birthday-premium/preview"
  ) {
    const parts = route.split("/");
    const template = parts[parts.length - 2];

    return (
  <SurprisePreview
    navigate={navigate}
    template={template}
  />
      );
  }

  // FORM
  if (
    route === "/create/birthday/birthday-cute" ||
    route === "/create/birthday/birthday-premium"
  ) {
    const parts = route.split("/");
    const template = parts[parts.length - 1];

    const selectedTemplate = templates.find(
  (item) =>
    item.slug === template &&
    item.template_version_id
);

return (
  <SurpriseForm
    navigate={navigate}
    template={template}
    templateVersionId={
      selectedTemplate?.template_version_id || null
    }
  />
);
  }

  // TEMPLATE SELECTION
  if (route === "/create/birthday") {
  return (
    <TemplateSelection
      navigate={navigate}
      templates={templates}
      gift={{
        name: "Birthday",
        slug: "birthday",
        emoji: "🎂",
      }}
    />
  );
}

  // CREATE SURPRISE
  if (route === "/create") {
    return <CreateSurprise navigate={navigate} />;
  }

  // PUBLIC SURPRISE
  if (route.startsWith("/surprise/")) {
    return <SurpriseViewer />;
  }

  // MANAGE
  if (route.startsWith("/manage")) {
    return <ManageSurprise />;
  }

  // COMPLETION
  if (
    route === "/create/birthday/birthday-cute/complete" ||
    route === "/create/birthday/birthday-premium/complete"
  ) {
    const parts = route.split("/");
    const template = parts[parts.length - 2];

    return (
      <Completion
        navigate={navigate}
        template={template}
      />
    );
  }

  // HOME
  return <User navigate={navigate} />;
}

export default App;