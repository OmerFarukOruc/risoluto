export function createWelcomePage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page fade-in";
  page.style.maxWidth = "640px";
  page.style.margin = "0 auto";
  page.style.paddingTop = "var(--space-10)";

  const hero = document.createElement("section");
  hero.style.textAlign = "left";
  hero.innerHTML = `
    <h1 style="font-family: var(--font-heading); font-size: 42px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">Symphony</h1>
    <p style="font-family: var(--font-body); font-size: 16px; color: var(--text-secondary); margin-top: var(--space-2);">Autonomous issue orchestration.</p>
    <p style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); margin-top: var(--space-2);">v0.2.0</p>
  `;

  const checklist = document.createElement("section");
  checklist.style.marginTop = "var(--space-10)";

  const checklistTitle = document.createElement("h2");
  checklistTitle.className = "section-title";
  checklistTitle.textContent = "Get started";
  checklist.append(checklistTitle);

  const steps = [
    {
      n: "1",
      title: "Create a workflow file",
      desc: "Define your issue sources, agent config, and orchestration rules in a YAML file.",
      link: "View example",
    },
    {
      n: "2",
      title: "Set up credentials",
      desc: "Add your Linear API key and AI provider keys.",
      link: "Open Secrets",
    },
    {
      n: "3",
      title: "Configure your environment",
      desc: "Set sandbox mode, polling interval, and agent limits.",
      link: "Open Settings",
    },
    {
      n: "4",
      title: "Start orchestrating",
      desc: "Run Symphony with your workflow file and watch it process issues.",
      link: null,
    },
  ];

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "var(--space-4)";
  list.style.marginTop = "var(--space-4)";

  for (const step of steps) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "var(--space-4)";
    row.style.alignItems = "flex-start";

    const num = document.createElement("div");
    num.style.width = "28px";
    num.style.height = "28px";
    num.style.display = "grid";
    num.style.placeItems = "center";
    num.style.border = "1px solid var(--border-stitch)";
    num.style.fontFamily = "var(--font-mono)";
    num.style.fontSize = "13px";
    num.style.fontWeight = "600";
    num.style.color = "var(--text-accent)";
    num.style.flexShrink = "0";
    num.textContent = step.n;

    const content = document.createElement("div");
    content.style.flex = "1";
    const titleEl = document.createElement("div");
    titleEl.style.fontFamily = "var(--font-heading)";
    titleEl.style.fontWeight = "600";
    titleEl.style.fontSize = "14px";
    titleEl.style.color = "var(--text-primary)";
    titleEl.textContent = step.title;

    const descEl = document.createElement("div");
    descEl.style.fontFamily = "var(--font-body)";
    descEl.style.fontSize = "13px";
    descEl.style.color = "var(--text-secondary)";
    descEl.style.marginTop = "2px";
    descEl.textContent = step.desc;

    content.append(titleEl, descEl);

    if (step.link) {
      const linkEl = document.createElement("a");
      linkEl.href = "#";
      linkEl.style.fontFamily = "var(--font-body)";
      linkEl.style.fontSize = "13px";
      linkEl.style.color = "var(--text-accent)";
      linkEl.style.marginTop = "4px";
      linkEl.style.display = "inline-block";
      linkEl.textContent = `${step.link} \u2192`;
      linkEl.addEventListener("click", (e) => {
        e.preventDefault();
        const paths: Record<string, string> = {
          "View example": "/planner",
          "Open Secrets": "/secrets",
          "Open Settings": "/settings",
        };
        if (paths[step.link!]) {
          window.history.pushState({}, "", paths[step.link!]);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      });
      content.append(linkEl);
    }

    row.append(num, content);
    list.append(row);
  }
  checklist.append(list);

  const codeBlock = document.createElement("pre");
  codeBlock.style.marginTop = "var(--space-5)";
  codeBlock.style.padding = "var(--space-4)";
  codeBlock.style.background = "var(--bg-surface)";
  codeBlock.style.border = "1px solid var(--border-stitch)";
  codeBlock.style.fontFamily = "var(--font-mono)";
  codeBlock.style.fontSize = "13px";
  codeBlock.style.color = "var(--text-primary)";
  codeBlock.style.overflow = "auto";
  codeBlock.textContent = "node dist/cli.js ./WORKFLOW.example.md --port 4000";
  checklist.append(codeBlock);

  const footer = document.createElement("p");
  footer.style.marginTop = "var(--space-8)";
  footer.style.textAlign = "center";
  footer.style.fontFamily = "var(--font-body)";
  footer.style.fontSize = "12px";
  footer.style.color = "var(--text-muted)";
  footer.textContent =
    "This page appears when no active workflow is detected. Start a workflow to see Mission Control.";

  page.append(hero, checklist, footer);
  return page;
}
