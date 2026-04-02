/**
 * Global setup/teardown for the fullstack Playwright project.
 *
 * Builds the project (backend + frontend), then starts a real HttpServer
 * backed by a temp directory. The built frontend is served from
 * `dist/frontend` via Express static middleware.
 *
 * Stores `FULLSTACK_BASE_URL` and `FULLSTACK_WEBHOOK_SECRET` in
 * `process.env` so the fullstack fixture can read them.
 *
 * Returns a teardown function (Playwright 1.34+ pattern) that stops
 * the server, destroys the event bus, and cleans up the temp dir.
 */

import { execSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { FullConfig } from "@playwright/test";

import { TypedEventBus } from "../../../src/core/event-bus.js";
import type { RisolutoEventMap } from "../../../src/core/risoluto-events.js";
import type { RisolutoLogger } from "../../../src/core/types.js";
import { HttpServer } from "../../../src/http/server.js";

const WEBHOOK_SECRET = "fullstack-test-webhook-secret";

function buildSilentLogger(): RisolutoLogger {
  const noop = () => {};
  const logger: RisolutoLogger = {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    child: () => logger,
  };
  return logger;
}

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  /* ---- build backend + frontend ---- */
  execSync("pnpm run build", {
    cwd: process.cwd(),
    stdio: "pipe",
    timeout: 120_000,
  });

  /* ---- temp directory for archives ---- */
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "risoluto-fullstack-e2e-"));

  /* ---- event bus ---- */
  const eventBus = new TypedEventBus<RisolutoEventMap>();

  /* ---- stub orchestrator (minimal for serving routes) ---- */
  const orchestrator = {
    start: async () => {},
    stop: async () => {},
    requestRefresh: () => ({
      queued: false,
      coalesced: false,
      requestedAt: new Date().toISOString(),
    }),
    requestTargetedRefresh: () => {},
    stopWorkerForIssue: () => {},
    getSnapshot: () => ({
      generatedAt: new Date().toISOString(),
      counts: { running: 0, retrying: 0 },
      running: [],
      retrying: [],
      queued: [],
      completed: [],
      workflowColumns: [],
      codexTotals: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        secondsRunning: 0,
        costUsd: 0,
      },
      rateLimits: null,
      recentEvents: [],
    }),
    getSerializedState: () => ({
      generated_at: new Date().toISOString(),
      counts: { running: 0, retrying: 0 },
      running: [],
      retrying: [],
      queued: [],
      completed: [],
      workflow_columns: [],
      codex_totals: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        seconds_running: 0,
        cost_usd: 0,
      },
      rate_limits: null,
      recent_events: [],
    }),
    getIssueDetail: () => null,
    getAttemptDetail: () => null,
    abortIssue: () => ({ ok: false as const, code: "not_found" as const, message: "stub" }),
    updateIssueModelSelection: async () => null,
    steerIssue: async () => null,
    getTemplateOverride: () => null,
    updateIssueTemplateOverride: () => false,
    clearIssueTemplateOverride: () => false,
  };

  /* ---- webhook handler deps ---- */
  const logger = buildSilentLogger();
  const webhookHandlerDeps = {
    getWebhookSecret: () => WEBHOOK_SECRET,
    getPreviousWebhookSecret: () => null,
    requestRefresh: () => {},
    requestTargetedRefresh: () => {},
    stopWorkerForIssue: () => {},
    recordVerifiedDelivery: () => {},
    logger,
  };

  /* ---- start server ---- */
  const frontendDir = path.join(process.cwd(), "dist/frontend");
  const server = new HttpServer({
    orchestrator,
    logger,
    eventBus,
    webhookHandlerDeps,
    frontendDir,
    archiveDir: dataDir,
  });

  const { port } = await server.start(0);
  const baseUrl = `http://127.0.0.1:${port}`;

  /* ---- expose to fixtures via environment ---- */
  process.env.FULLSTACK_BASE_URL = baseUrl;
  process.env.FULLSTACK_WEBHOOK_SECRET = WEBHOOK_SECRET;

  /* ---- return teardown function ---- */
  return async () => {
    await server.stop();
    eventBus.destroy();
    await rm(dataDir, { recursive: true, force: true }).catch(() => {});
    delete process.env.FULLSTACK_BASE_URL;
    delete process.env.FULLSTACK_WEBHOOK_SECRET;
  };
}
