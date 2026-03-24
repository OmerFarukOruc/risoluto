export function registerPageCleanup(root: HTMLElement, cleanup: () => void): void {
  let disposed = false;
  let observer: MutationObserver | null = null;

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    window.removeEventListener("router:navigate", onNavigate);
    observer?.disconnect();
    observer = null;
    cleanup();
  };

  const checkConnection = (): void => {
    if (!root.isConnected) {
      dispose();
    }
  };

  const onNavigate = (): void => {
    checkConnection();
  };

  window.addEventListener("router:navigate", onNavigate);
  if (document.body) {
    observer = new MutationObserver(() => {
      checkConnection();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  window.setTimeout(() => {
    checkConnection();
  }, 0);
}
