#!/bin/bash
# compact-recovery.sh — Re-inject critical context after context compaction.
# Runs as SessionStart hook with "compact" matcher.

cat <<'CONTEXT'
## Risoluto Architecture Recovery

### Module Entrypoints
- cli/index.ts → startup, config init
- cli/services.ts → DI wiring
- orchestrator/orchestrator.ts → polling loop, dispatch
- agent-runner/index.ts → Codex worker execution
- http/server.ts + http/routes/ → HTTP server and dashboard
- persistence/sqlite/ → archived run persistence
- workspace/manager.ts → workspace lifecycle

### Port Pattern
Consumers depend on port interfaces, never concrete implementations.
OrchestratorPort, TrackerPort, AttemptStorePort, ConfigOverlayPort,
GitIntegrationPort, SecretsPort, TemplateStorePort, AuditLoggerPort.

### Coding Conventions
- ESM TypeScript, moduleResolution: "NodeNext"
- Local imports use .js extensions: import { Foo } from "./foo.js"
- 2-space indent, double quotes, semicolons, const by default
- PascalCase classes, camelCase functions/variables
- Never vi.doMock Node builtins in ESM tests
- mc-* prefix for all frontend component classes
CONTEXT

echo ""
echo "### Current State"
echo "Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
echo "Recent commits:"
git log --oneline -5 2>/dev/null || echo "(git not available)"
