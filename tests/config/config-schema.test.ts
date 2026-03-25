import { readFile } from "node:fs/promises";
import path from "node:path";

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { deriveServiceConfig } from "../../src/config/builders.js";
import { validateDispatch } from "../../src/config/validators.js";
import type { WorkflowDefinition } from "../../src/core/types.js";

function extractWorkflowConfig(source: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!match) {
    throw new TypeError("workflow front matter is missing");
  }
  const parsed = parse(match[1]);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("workflow front matter must be a YAML map");
  }
  return parsed as Record<string, unknown>;
}

function createWorkflow(config: Record<string, unknown>): WorkflowDefinition {
  return {
    config,
    promptTemplate: "Work on the issue.",
  };
}

async function loadSchemas() {
  return import("../../packages/shared/src/config-schema.ts");
}

function checkSchema(schema: object, value: unknown): boolean {
  return Value.Check(schema as never, value);
}

describe("config schemas", () => {
  it("validates WORKFLOW.example.md front matter with WorkflowSchema", async () => {
    const { WorkflowSchema } = await loadSchemas();
    const workflowPath = path.resolve("WORKFLOW.example.md");
    const source = await readFile(workflowPath, "utf8");
    const config = extractWorkflowConfig(source);

    expect(checkSchema(WorkflowSchema, config)).toBe(true);
  });

  it("validates resolved ServiceConfig from WORKFLOW.example.md", async () => {
    const {
      AgentConfigSchema,
      CodexConfigSchema,
      PollingConfigSchema,
      ServerConfigSchema,
      ServiceConfigSchema,
      TrackerConfigSchema,
      WorkspaceConfigSchema,
    } = await loadSchemas();
    const workflowPath = path.resolve("WORKFLOW.example.md");
    const source = await readFile(workflowPath, "utf8");
    const config = extractWorkflowConfig(source);

    process.env.LINEAR_API_KEY = "lin_test";
    process.env.LINEAR_PROJECT_SLUG = "TEST";

    const serviceConfig = deriveServiceConfig(createWorkflow(config));

    expect(checkSchema(ServiceConfigSchema, serviceConfig)).toBe(true);
    expect(checkSchema(TrackerConfigSchema, serviceConfig.tracker)).toBe(true);
    expect(checkSchema(PollingConfigSchema, serviceConfig.polling)).toBe(true);
    expect(checkSchema(WorkspaceConfigSchema, serviceConfig.workspace)).toBe(true);
    expect(checkSchema(AgentConfigSchema, serviceConfig.agent)).toBe(true);
    expect(checkSchema(CodexConfigSchema, serviceConfig.codex)).toBe(true);
    expect(checkSchema(ServerConfigSchema, serviceConfig.server)).toBe(true);
  });

  it("supplements existing validators without replacing them", async () => {
    const { ServiceConfigSchema } = await loadSchemas();
    delete process.env.LINEAR_API_KEY;
    process.env.LINEAR_PROJECT_SLUG = "TEST";
    const serviceConfig = deriveServiceConfig(
      createWorkflow({
        tracker: {
          kind: "linear",
          api_key: "$LINEAR_API_KEY",
          project_slug: "$LINEAR_PROJECT_SLUG",
        },
        codex: {
          command: "codex app-server",
          auth: {
            mode: "api_key",
            source_home: "~/.codex",
          },
        },
      }),
    );

    expect(checkSchema(ServiceConfigSchema, serviceConfig)).toBe(true);
    expect(validateDispatch(serviceConfig, { existsSync: () => false, env: {} })).toEqual({
      code: "missing_tracker_api_key",
      message: "tracker.api_key is required after env resolution",
    });
  });
});
