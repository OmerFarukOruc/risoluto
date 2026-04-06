import type { ConfigOverlayPort } from "../config/overlay.js";
import type { ConfigStore } from "../config/store.js";
import type { TypedEventBus } from "../core/event-bus.js";
import type { RisolutoEventMap } from "../core/risoluto-events.js";
import type { RisolutoLogger } from "../core/types.js";
import type { OrchestratorPort } from "../orchestrator/port.js";
import type { SecretsStore } from "../secrets/store.js";
import type { PromptTemplateStore } from "../prompt/store.js";
import type { AuditLogger } from "../audit/logger.js";
import type { AutomationScheduler } from "../automation/scheduler.js";
import type { TrackerPort } from "../tracker/port.js";
import type { AlertHistoryStorePort } from "../alerts/history-store.js";
import type { AttemptStorePort } from "../core/attempt-store-port.js";
import type { AutomationStorePort } from "../persistence/sqlite/automation-store.js";
import type { NotificationStorePort } from "../persistence/sqlite/notification-store.js";
import type { WebhookHandlerDeps } from "./webhook-handler.js";

export interface HttpRouteDeps {
  orchestrator: OrchestratorPort;
  logger?: RisolutoLogger;
  tracker?: TrackerPort;
  configStore?: ConfigStore;
  configOverlayStore?: ConfigOverlayPort;
  secretsStore?: SecretsStore;
  eventBus?: TypedEventBus<RisolutoEventMap>;
  attemptStore?: Pick<AttemptStorePort, "listCheckpoints" | "getAllPrs">;
  notificationStore?: NotificationStorePort;
  automationStore?: AutomationStorePort;
  automationScheduler?: Pick<AutomationScheduler, "listAutomations" | "runNow">;
  alertHistoryStore?: AlertHistoryStorePort;
  templateStore?: PromptTemplateStore;
  auditLogger?: AuditLogger;
  frontendDir?: string;
  archiveDir?: string;
  webhookHandlerDeps?: WebhookHandlerDeps;
}
