import type { SecretBackend } from "@symphony/shared";

import type { ConfigOverlayStore } from "../config/overlay.js";
import type { ConfigStore } from "../config/store.js";
import type { SymphonyLogger } from "../core/types.js";
import type { LinearClient } from "../linear/client.js";
import type { Orchestrator } from "../orchestrator/orchestrator.js";

export interface HttpServerDeps {
  orchestrator: Orchestrator;
  logger: SymphonyLogger;
  linearClient?: LinearClient;
  configStore?: ConfigStore;
  configOverlayStore?: ConfigOverlayStore;
  secretsStore?: SecretBackend;
  frontendDir?: string;
  archiveDir?: string;
}
