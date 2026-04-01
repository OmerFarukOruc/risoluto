import { buildSetupError, buildTitleWithBadge } from "./setup-shared";

const FIELD_IDS = {
  url: "setup-repo-url",
  urlHint: "setup-repo-url-hint",
  urlError: "setup-repo-url-error",
  branch: "setup-repo-branch",
  branchHint: "setup-repo-branch-hint",
  label: "setup-repo-label",
  labelHint: "setup-repo-label-hint",
  advanced: "setup-repo-advanced",
} as const;

const GITHUB_REPO_URL = /^https:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?\/?$/i;

export interface RepoConfigStepState {
  loading: boolean;
  error: string | null;
  teamKey: string | null;
  repoUrlInput: string;
  defaultBranchInput: string;
  labelInput: string;
  showAdvanced: boolean;
  routes: Array<Record<string, unknown>>;
}

export interface RepoConfigStepActions {
  onRepoUrlInput: (value: string) => void;
  onDefaultBranchInput: (value: string) => void;
  onLabelInput: (value: string) => void;
  onToggleAdvanced: () => void;
  onSave: () => void;
  onSkip: () => void;
  onDeleteRoute: (index: number) => void;
  onDetectDefaultBranch: (repoUrl: string) => Promise<string | null>;
}

function getRepoUrlValidationMessage(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return GITHUB_REPO_URL.test(trimmed)
    ? null
    : "Enter a GitHub repository URL, for example https://github.com/org/repo.";
}

function buildExistingRoutes(
  routes: Array<Record<string, unknown>>,
  actions: RepoConfigStepActions,
  loading: boolean,
): HTMLElement | null {
  if (routes.length === 0) {
    return null;
  }

  const wrap = document.createElement("section");
  wrap.className = "setup-repo-routes";

  const label = document.createElement("div");
  label.className = "setup-label";
  label.textContent = "Connected repositories";

  const list = document.createElement("ul");
  list.className = "setup-repo-route-list";

  routes.forEach((route, index) => {
    const repoUrl = String(route.repo_url ?? "");
    const identifierPrefix = String(route.identifier_prefix ?? "");

    const row = document.createElement("li");
    row.className = "setup-repo-route-row";

    const info = document.createElement("div");
    info.className = "setup-repo-route-info";

    const prefix = document.createElement("span");
    prefix.className = "setup-repo-route-prefix";
    prefix.textContent = identifierPrefix;

    const url = document.createElement("span");
    url.className = "setup-repo-route-url";
    url.textContent = repoUrl;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "mc-button is-ghost is-sm setup-repo-remove";
    removeButton.textContent = "Remove";
    removeButton.disabled = loading;
    removeButton.setAttribute("aria-label", `Remove connected repository ${repoUrl || identifierPrefix}`);
    removeButton.addEventListener("click", () => actions.onDeleteRoute(index));

    info.append(prefix, url);
    row.append(info, removeButton);
    list.append(row);
  });

  wrap.append(label, list);
  return wrap;
}

export function buildRepoConfigStep(state: RepoConfigStepState, actions: RepoConfigStepActions): HTMLElement {
  const el = document.createElement("div");
  const titleRow = buildTitleWithBadge("Link a repository", "is-optional", "Optional");
  const sub = document.createElement("div");
  sub.className = "setup-subtitle";
  sub.textContent = "Tell Risoluto which GitHub repo to use for this Linear project.";

  const callout = document.createElement("div");
  callout.className = "setup-callout";
  callout.textContent =
    "Linking a repo is optional. Without one, Risoluto can still work on the local checkout. With one, it can push branches and open pull requests.";
  el.append(titleRow, sub, callout);

  const existingRoutes = buildExistingRoutes(state.routes, actions, state.loading);
  if (existingRoutes) {
    el.append(existingRoutes);
  }

  const prefixField = document.createElement("div");
  prefixField.className = "setup-field";
  const prefixLabel = document.createElement("div");
  prefixLabel.className = "setup-label";
  prefixLabel.textContent = "Routing prefix";
  const prefixChip = document.createElement("div");
  prefixChip.className = "setup-repo-prefix-chip";
  prefixChip.textContent = state.teamKey ?? "N/A";
  const prefixHint = document.createElement("div");
  prefixHint.className = "setup-hint";
  prefixHint.textContent = "Derived from your Linear team key. Issues with this prefix route to the repo below.";
  prefixField.append(prefixLabel, prefixChip, prefixHint);

  const urlField = document.createElement("div");
  urlField.className = "setup-field";
  const urlLabel = document.createElement("label");
  urlLabel.className = "setup-label";
  urlLabel.htmlFor = FIELD_IDS.url;
  urlLabel.textContent = "GitHub repository URL";
  const urlInput = document.createElement("input");
  urlInput.id = FIELD_IDS.url;
  urlInput.className = "setup-input";
  urlInput.type = "url";
  urlInput.required = true;
  urlInput.setAttribute("autocomplete", "url");
  urlInput.placeholder = "https://github.com/org/repo";
  urlInput.value = state.repoUrlInput;
  urlInput.setAttribute("aria-describedby", `${FIELD_IDS.urlHint} ${FIELD_IDS.urlError}`);
  const urlHint = document.createElement("div");
  urlHint.id = FIELD_IDS.urlHint;
  urlHint.className = "setup-hint";
  urlHint.textContent = "Paste the full GitHub repository URL.";
  const urlError = document.createElement("div");
  urlError.id = FIELD_IDS.urlError;
  urlError.className = "setup-error";
  urlError.hidden = true;
  urlError.setAttribute("role", "alert");
  urlField.append(urlLabel, urlInput, urlHint, urlError);

  const branchField = document.createElement("div");
  branchField.className = "setup-field";
  const branchLabel = document.createElement("label");
  branchLabel.className = "setup-label";
  branchLabel.htmlFor = FIELD_IDS.branch;
  branchLabel.textContent = "Default branch";
  const branchInput = document.createElement("input");
  branchInput.id = FIELD_IDS.branch;
  branchInput.className = "setup-input";
  branchInput.autocomplete = "off";
  branchInput.placeholder = "main";
  branchInput.value = state.defaultBranchInput;
  branchInput.setAttribute("aria-describedby", FIELD_IDS.branchHint);
  const branchHint = document.createElement("div");
  branchHint.id = FIELD_IDS.branchHint;
  branchHint.className = "setup-hint";
  branchHint.textContent = "We'll try to detect it from GitHub. You can change it.";
  branchField.append(branchLabel, branchInput, branchHint);
  el.append(prefixField, urlField, branchField);

  const advancedToggle = document.createElement("button");
  advancedToggle.type = "button";
  advancedToggle.className = "mc-button is-ghost is-sm setup-repo-advanced-toggle";
  advancedToggle.textContent = state.showAdvanced ? "Hide label routing" : "Show label routing";
  advancedToggle.setAttribute("aria-controls", FIELD_IDS.advanced);
  advancedToggle.setAttribute("aria-expanded", String(state.showAdvanced));
  advancedToggle.addEventListener("click", actions.onToggleAdvanced);
  el.append(advancedToggle);

  const advancedPanel = document.createElement("section");
  advancedPanel.id = FIELD_IDS.advanced;
  advancedPanel.className = "setup-repo-advanced";
  advancedPanel.hidden = !state.showAdvanced;
  const labelField = document.createElement("div");
  labelField.className = "setup-field";
  const labelLabel = document.createElement("label");
  labelLabel.className = "setup-label";
  labelLabel.htmlFor = FIELD_IDS.label;
  labelLabel.textContent = "Route by label (optional)";
  const labelInput = document.createElement("input");
  labelInput.id = FIELD_IDS.label;
  labelInput.className = "setup-input";
  labelInput.autocomplete = "off";
  labelInput.placeholder = "e.g. backend";
  labelInput.value = state.labelInput;
  labelInput.setAttribute("aria-describedby", FIELD_IDS.labelHint);
  const labelHint = document.createElement("div");
  labelHint.id = FIELD_IDS.labelHint;
  labelHint.className = "setup-hint";
  labelHint.textContent = "If set, issues with this label will also route to this repo.";
  labelField.append(labelLabel, labelInput, labelHint);
  advancedPanel.append(labelField);
  el.append(advancedPanel);

  if (state.error) {
    el.append(buildSetupError(state.error));
  }

  const actionsRow = document.createElement("div");
  actionsRow.className = "setup-actions";
  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.className = "mc-button is-ghost is-sm";
  skipBtn.textContent = "Skip this step";
  skipBtn.addEventListener("click", actions.onSkip);
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "mc-button is-primary";
  saveBtn.textContent = state.loading ? "Saving…" : "Save and continue";

  const updateSaveButton = (): void => {
    saveBtn.disabled = state.loading || !urlInput.value.trim();
  };

  const syncRepoUrlState = (focusInvalidInput = false): boolean => {
    const message = getRepoUrlValidationMessage(urlInput.value);
    urlError.hidden = !message;
    urlError.textContent = message ?? "";
    urlInput.classList.toggle("is-invalid", !!message);
    if (message) {
      urlInput.setAttribute("aria-invalid", "true");
      if (focusInvalidInput) {
        urlInput.focus();
      }
    } else {
      urlInput.removeAttribute("aria-invalid");
    }
    updateSaveButton();
    return !message;
  };

  urlInput.addEventListener("input", () => {
    actions.onRepoUrlInput(urlInput.value);
    syncRepoUrlState();
  });
  urlInput.addEventListener("blur", () => {
    const isValid = syncRepoUrlState();
    if (isValid && urlInput.value.trim()) {
      branchHint.textContent = "Detecting default branch…";
      actions
        .onDetectDefaultBranch(urlInput.value.trim())
        .then((detected) => {
          if (detected) {
            branchInput.value = detected;
            actions.onDefaultBranchInput(detected);
            branchHint.textContent = `Detected: ${detected}`;
          } else {
            branchHint.textContent = "Auto-detected from GitHub. You can override it manually.";
          }
        })
        .catch(() => {
          branchHint.textContent = "Could not detect — defaults to main. You can override it manually.";
        });
    }
  });
  branchInput.addEventListener("input", () => {
    actions.onDefaultBranchInput(branchInput.value);
  });
  labelInput.addEventListener("input", () => {
    actions.onLabelInput(labelInput.value);
  });
  saveBtn.addEventListener("click", () => {
    if (syncRepoUrlState(true)) {
      actions.onSave();
    }
  });

  updateSaveButton();
  syncRepoUrlState();
  actionsRow.append(skipBtn, saveBtn);
  el.append(actionsRow);
  return el;
}
