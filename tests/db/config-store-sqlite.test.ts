import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLogger } from "../../src/core/logger.js";
import { ConfigStoreSqlite } from "../../src/db/config-store-sqlite.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "symphony-config-store-sqlite-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("ConfigStoreSqlite", () => {
  it("persists config overlay entries across restarts", async () => {
    const baseDir = await createTempDir();
    const store = new ConfigStoreSqlite(baseDir, createLogger());

    await store.save("codex.model", "gpt-5.4");
    await store.save("server.port", 4010);
    store.close();

    const restartedStore = new ConfigStoreSqlite(baseDir, createLogger());
    expect(await restartedStore.load()).toEqual({
      codex: { model: "gpt-5.4" },
      server: { port: 4010 },
    });
    expect(await restartedStore.list()).toEqual([
      { path: "codex.model", value: "gpt-5.4" },
      { path: "server.port", value: 4010 },
    ]);
    restartedStore.close();
  });

  it("deletes individual config overlay entries", async () => {
    const baseDir = await createTempDir();
    const store = new ConfigStoreSqlite(baseDir, createLogger());

    await store.save("agent.max_turns", 10);
    await store.save("server.port", 4000);

    await expect(store.delete("agent.max_turns")).resolves.toBe(true);
    await expect(store.delete("agent.max_turns")).resolves.toBe(false);
    await expect(store.load()).resolves.toEqual({
      server: { port: 4000 },
    });
    store.close();
  });
});
