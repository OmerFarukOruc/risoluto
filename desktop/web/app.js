(function initDesktopShell() {
  const els = {
    statusPill: document.getElementById("serviceStatus"),
    statusLine: document.getElementById("statusLine"),
    errorLine: document.getElementById("errorLine"),
    workflowPath: document.getElementById("workflowPath"),
    servicePort: document.getElementById("servicePort"),
    startButton: document.getElementById("startButton"),
    stopButton: document.getElementById("stopButton"),
    refreshButton: document.getElementById("refreshButton"),
    openBrowserButton: document.getElementById("openBrowserButton"),
    dashboardFrame: document.getElementById("dashboardFrame"),
  };

  function setError(message) {
    if (!message) {
      els.errorLine.textContent = "";
      els.errorLine.classList.add("hidden");
      return;
    }
    els.errorLine.textContent = message;
    els.errorLine.classList.remove("hidden");
  }

  function getInvoke() {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) {
      throw new Error("Tauri invoke bridge is unavailable.");
    }
    return invoke;
  }

  function renderStatus(status) {
    const stateLabel = status.running ? "Running" : "Stopped";
    els.statusPill.textContent = stateLabel;
    els.statusPill.classList.toggle("running", status.running);
    els.statusPill.classList.toggle("stopped", !status.running);
    els.startButton.disabled = status.running;
    els.stopButton.disabled = !status.running;
    els.workflowPath.value = status.workflowPath || "";
    els.servicePort.value = String(status.port || 4000);
    els.statusLine.textContent = status.running
      ? `Symphony service is running (pid ${status.pid || "unknown"}) at ${status.dashboardUrl}`
      : `Symphony service is stopped. Dashboard target: ${status.dashboardUrl}`;
    els.dashboardFrame.src = status.dashboardUrl;
    if (status.lastError) {
      setError(status.lastError);
    }
  }

  async function refreshStatus() {
    const invoke = getInvoke();
    const status = await invoke("desktop_status");
    renderStatus(status);
  }

  function requestedPort() {
    const value = Number(els.servicePort.value);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return Math.trunc(value);
  }

  async function startService() {
    setError("");
    try {
      const invoke = getInvoke();
      const status = await invoke("desktop_start_service", {
        workflowPath: els.workflowPath.value.trim() || null,
        port: requestedPort(),
      });
      renderStatus(status);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  async function stopService() {
    setError("");
    try {
      const invoke = getInvoke();
      const status = await invoke("desktop_stop_service");
      renderStatus(status);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  function openInBrowser() {
    const src = els.dashboardFrame.src;
    if (src) {
      window.open(src, "_blank");
    }
  }

  els.startButton.addEventListener("click", () => void startService());
  els.stopButton.addEventListener("click", () => void stopService());
  els.refreshButton.addEventListener("click", () => void refreshStatus());
  els.openBrowserButton.addEventListener("click", openInBrowser);

  void refreshStatus();
  setInterval(() => {
    void refreshStatus();
  }, 2500);
})();
