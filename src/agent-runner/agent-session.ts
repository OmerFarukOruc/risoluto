/**
 * AgentSession — the lifecycle contract for a single Codex agent session.
 *
 * This type consolidates Docker session + connection + turn state into a
 * single surface. `DockerSession` is the concrete implementation; this
 * type alias is the stable interface for consumers.
 */

export type { DockerSession as AgentSession } from "./docker-session.js";
