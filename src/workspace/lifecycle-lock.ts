const workspaceLocks = new Map<string, Promise<void>>();

export async function withWorkspaceLifecycleLock<T>(workspaceKey: string, task: () => Promise<T>): Promise<T> {
  while (workspaceLocks.has(workspaceKey)) {
    await workspaceLocks.get(workspaceKey);
  }

  let releaseLock!: () => void;
  const lock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  workspaceLocks.set(workspaceKey, lock);

  try {
    return await task();
  } finally {
    workspaceLocks.delete(workspaceKey);
    releaseLock();
  }
}
