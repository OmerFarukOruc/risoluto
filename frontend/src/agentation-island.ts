// Dev-only annotation island — mounts the Agentation React component
// into a dedicated root so it doesn't interfere with the vanilla app.
import type { AgentationProps } from "agentation";

function shouldMountAgentation(): boolean {
  return document.body.dataset.agentation === "enabled";
}

async function mountAgentation(): Promise<void> {
  const [{ createElement }, { createRoot }, { Agentation }] = await Promise.all([
    import("react"),
    import("react-dom/client"),
    import("agentation"),
  ]);

  const root = document.createElement("div");
  root.id = "agentation-root";
  document.body.appendChild(root);

  createRoot(root).render(createElement<AgentationProps>(Agentation, { endpoint: "http://localhost:4747" }));
}

if (shouldMountAgentation()) {
  try {
    await mountAgentation();
  } catch (error) {
    console.error("Failed to mount Agentation", error);
  }
}
