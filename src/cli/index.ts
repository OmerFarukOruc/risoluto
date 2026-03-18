import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { AgentRunner } from "../agent-runner/index.js";
import { AttemptStore } from "../core/attempt-store.js";
import { createGitHubToolProvider, createRepoRouterProvider } from "./runtime-providers.js";
import { ConfigOverlayStore } from "../config/overlay.js";
import { ConfigStore } from "../config/store.js";
import { HttpServer } from "../http/server.js";
import { LinearClient } from "../linear/client.js";
import { createLogger } from "../core/logger.js";
import { getErrorTracker, initErrorTracking } from "../core/error-tracking.js";
import { loadFlags } from "../core/feature-flags.js";
import { NotificationManager } from "../notification/manager.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { PathRegistry } from "../workspace/path-registry.js";
import { createLinearPlanningExecutor } from "../planning/executor.js";
import { SecretsStore } from "../secrets/store.js";
import { SlackWebhookChannel } from "../notification/slack-webhook.js";
import type { ValidationError } from "../core/types.js";
import { WorkspaceManager } from "../workspace/manager.js";

function printValidationError(error: ValidationError): void {
  console.error(`error code=${error.code} msg=${JSON.stringify(error.message)}`);
}

async function cleanupTransientWorkspaceDirs(workspaceRoot: string): Promise<void> {
  await mkdir(workspaceRoot, { recursive: true });
  const entries = await readdir(workspaceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    for (const transientName of ["tmp", ".elixir_ls"]) {
      await rm(path.join(workspaceRoot, entry.name, transientName), {
        recursive: true,
        force: true,
      });
    }
  }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { workflowPath, archiveDir, selectedPort, logger } = parseCliArgs(argv);

  const overlayStore = new ConfigOverlayStore(
    path.join(archiveDir, "config", "overlay.yaml"),
    logger.child({ component: "config-overlay" }),
  );
  const secretsStore = new SecretsStore(archiveDir, logger.child({ component: "secrets" }));
  await overlayStore.start();
  await secretsStore.start();
  const configStore = new ConfigStore(workflowPath, logger.child({ component: "config" }), {
    overlayStore,
    secretsStore,
  });

  const startError = await safeStartConfigStore(configStore);
  if (startError !== null) return startError;

  const validationError = configStore.validateDispatch();
  if (validationError) {
    printValidationError(validationError);
    await configStore.stop();
    return 1;
  }

  const config = configStore.getConfig();
  const port = selectedPort ?? config.server.port;
  const services = await createServices(config, configStore, overlayStore, secretsStore, archiveDir, logger);
  wireNotifications(services.notificationManager, configStore, logger);

  const { orchestrator, httpServer } = services;
  await cleanupTransientWorkspaceDirs(config.workspace.root);
  await orchestrator.start();
  await httpServer.start(port);

  const shutdown = buildShutdown(httpServer, orchestrator, configStore, overlayStore);
  logger.info({ workflowPath, port, logDir: archiveDir }, "service started");
  watchConfigChanges(configStore, services.notificationManager, config.server.port, logger);

  await awaitShutdown(logger, shutdown);
  return 0;
}

function parseCliArgs(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: "string" },
      "log-dir": { type: "string" },
    },
  });

  const workflowPath = parsed.positionals[0] ?? "./WORKFLOW.md";
  const resolvedWorkflowPath = path.resolve(workflowPath);
  const logger = createLogger();
  loadFlags(path.dirname(resolvedWorkflowPath));
  initErrorTracking(logger.child({ component: "error-tracking" }));
  const archiveDir = path.resolve(
    parsed.values["log-dir"] ??
      (process.env.DATA_DIR
        ? path.join(process.env.DATA_DIR, "archives")
        : path.join(path.dirname(resolvedWorkflowPath), ".symphony")),
  );
  const selectedPort = parsed.values.port ? Number(parsed.values.port) : undefined;
  return { workflowPath, resolvedWorkflowPath, archiveDir, selectedPort, logger };
}

async function safeStartConfigStore(configStore: ConfigStore): Promise<number | null> {
  try {
    await configStore.start();
    return null;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "validationError" in error &&
      typeof (error as { validationError?: unknown }).validationError === "object"
    ) {
      printValidationError((error as { validationError: ValidationError }).validationError);
      return 1;
    }
    throw error;
  }
}

async function createServices(
  config: ReturnType<ConfigStore["getConfig"]>,
  configStore: ConfigStore,
  overlayStore: ConfigOverlayStore,
  secretsStore: SecretsStore,
  archiveDir: string,
  logger: ReturnType<typeof createLogger>,
) {
  const attemptStore = new AttemptStore(archiveDir, logger.child({ component: "attempt-store" }));
  await attemptStore.start();
  const linearClient = new LinearClient(() => configStore.getConfig(), logger.child({ component: "linear" }));
  const workspaceManager = new WorkspaceManager(
    () => configStore.getConfig(),
    logger.child({ component: "workspace" }),
  );
  const notificationManager = new NotificationManager({ logger: logger.child({ component: "notifications" }) });
  const pathRegistry = PathRegistry.fromEnv();
  const repoRouter = createRepoRouterProvider(() => configStore.getConfig());
  const gitManager = createGitHubToolProvider(() => configStore.getConfig(), { env: process.env });
  const agentRunner = new AgentRunner({
    getConfig: () => configStore.getConfig(),
    linearClient,
    workspaceManager,
    archiveDir,
    pathRegistry,
    githubToolClient: gitManager,
    logger: logger.child({ component: "agent-runner" }),
  });
  const orchestrator = new Orchestrator({
    attemptStore,
    configStore,
    linearClient,
    workspaceManager,
    agentRunner,
    notificationManager,
    repoRouter,
    gitManager,
    logger: logger.child({ component: "orchestrator" }),
  });
  const httpServer = new HttpServer({
    orchestrator,
    logger: logger.child({ component: "http" }),
    configStore,
    configOverlayStore: overlayStore,
    secretsStore,
    executePlan: createLinearPlanningExecutor({ linearClient }),
  });
  return { orchestrator, httpServer, notificationManager, linearClient };
}

function wireNotifications(
  notificationManager: NotificationManager,
  configStore: ConfigStore,
  logger: ReturnType<typeof createLogger>,
): void {
  const configureNotifications = () => {
    for (const channelName of notificationManager.listChannels()) {
      notificationManager.removeChannel(channelName);
    }
    const slack = configStore.getConfig().notifications?.slack;
    if (slack?.webhookUrl) {
      notificationManager.registerChannel(
        new SlackWebhookChannel({
          webhookUrl: slack.webhookUrl,
          verbosity: slack.verbosity,
          logger: logger.child({ component: "slack-webhook" }),
        }),
      );
    }
  };
  configureNotifications();
}

function buildShutdown(
  httpServer: HttpServer,
  orchestrator: Orchestrator,
  configStore: ConfigStore,
  overlayStore: ConfigOverlayStore,
): () => Promise<void> {
  let shuttingDown = false;
  return async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await httpServer.stop().catch(() => undefined);
    await orchestrator.stop().catch(() => undefined);
    await configStore.stop().catch(() => undefined);
    await overlayStore.stop().catch(() => undefined);
    await getErrorTracker()
      .flush()
      .catch(() => undefined);
  };
}

function watchConfigChanges(
  configStore: ConfigStore,
  notificationManager: NotificationManager,
  initialPort: number,
  logger: ReturnType<typeof createLogger>,
): void {
  configStore.subscribe(() => {
    wireNotifications(notificationManager, configStore, logger);
    const latestConfig = configStore.getConfig();
    if (latestConfig.server.port !== initialPort) {
      logger.warn(
        { previousPort: initialPort, nextPort: latestConfig.server.port },
        "server.port changed in workflow; restart required to apply",
      );
    }
  });
}

async function awaitShutdown(logger: ReturnType<typeof createLogger>, shutdown: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve) => {
    const handleSignal = (signal: NodeJS.Signals) => {
      logger.info({ signal }, "shutdown signal received");
      void shutdown().finally(resolve);
    };
    process.once("SIGINT", handleSignal);
    process.once("SIGTERM", handleSignal);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
