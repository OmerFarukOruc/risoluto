import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { handleTemplateClear, handleTemplateOverride } from "../../src/http/template-override-handler.js";

function makeRequest(body: Record<string, unknown> = {}, params: Record<string, string> = {}): Request {
  return { body, params, get: vi.fn() } as unknown as Request;
}

function makeResponse(): Response & { _status: number; _body: unknown } {
  const res = {
    _status: 200,
    _body: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._body = data;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _body: unknown };
}

function makeOrchestrator(
  overrides: {
    setResult?: unknown;
    clearResult?: unknown;
  } = {},
) {
  return {
    executeCommand: vi.fn().mockImplementation(async (command: { type: string }) => {
      if (command.type === "set_issue_template_override") {
        return overrides.setResult === undefined ? { updated: true, appliesNextAttempt: true } : overrides.setResult;
      }
      if (command.type === "clear_issue_template_override") {
        return overrides.clearResult === undefined ? { cleared: true } : overrides.clearResult;
      }
      return null;
    }),
  };
}

function makeTemplateStore(template: { id: string; name: string } | null = { id: "tmpl-1", name: "Default" }) {
  return {
    get: vi.fn().mockReturnValue(template ? { id: template.id, name: template.name } : null),
  };
}

describe("handleTemplateOverride", () => {
  it("returns 202 with updated shape on success", async () => {
    const res = makeResponse();
    const orch = makeOrchestrator();
    const store = makeTemplateStore();

    await handleTemplateOverride(
      orch as never,
      store as never,
      makeRequest({ template_id: "tmpl-1" }, { issue_identifier: "MT-1" }),
      res,
    );

    expect(res._status).toBe(202);
    const body = res._body as Record<string, unknown>;
    expect(body.updated).toBe(true);
    expect(body.applies_next_attempt).toBe(true);
  });

  it("calls executeCommand with correct args", async () => {
    const res = makeResponse();
    const orch = makeOrchestrator();
    const store = makeTemplateStore();

    await handleTemplateOverride(
      orch as never,
      store as never,
      makeRequest({ template_id: "tmpl-abc" }, { issue_identifier: "MT-2" }),
      res,
    );

    expect(orch.executeCommand).toHaveBeenCalledWith({
      type: "set_issue_template_override",
      identifier: "MT-2",
      templateId: "tmpl-abc",
    });
  });

  it("returns 404 when template_id is not found in store", async () => {
    const res = makeResponse();
    const orch = makeOrchestrator();
    const store = makeTemplateStore(null);

    await handleTemplateOverride(
      orch as never,
      store as never,
      makeRequest({ template_id: "nonexistent" }, { issue_identifier: "MT-1" }),
      res,
    );

    expect(res._status).toBe(404);
    const body = res._body as { error: { code: string } };
    expect(body.error.code).toBe("template_not_found");
    expect(orch.executeCommand).not.toHaveBeenCalled();
  });

  it("returns 404 when orchestrator returns null (unknown issue identifier)", async () => {
    const res = makeResponse();
    const orch = makeOrchestrator({ setResult: null });
    const store = makeTemplateStore();

    await handleTemplateOverride(
      orch as never,
      store as never,
      makeRequest({ template_id: "tmpl-1" }, { issue_identifier: "UNKNOWN-99" }),
      res,
    );

    expect(res._status).toBe(404);
    const body = res._body as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });
});

describe("handleTemplateClear", () => {
  it("returns 200 with cleared shape on success", async () => {
    const res = makeResponse();
    const orch = makeOrchestrator();

    await handleTemplateClear(orch as never, makeRequest({}, { issue_identifier: "MT-1" }), res);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body.cleared).toBe(true);
  });

  it("calls executeCommand with correct identifier", async () => {
    const res = makeResponse();
    const orch = makeOrchestrator();

    await handleTemplateClear(orch as never, makeRequest({}, { issue_identifier: "MT-42" }), res);

    expect(orch.executeCommand).toHaveBeenCalledWith({
      type: "clear_issue_template_override",
      identifier: "MT-42",
    });
  });

  it("returns 404 when orchestrator returns null (unknown issue identifier)", async () => {
    const res = makeResponse();
    const orch = makeOrchestrator({ clearResult: null });

    await handleTemplateClear(orch as never, makeRequest({}, { issue_identifier: "UNKNOWN-99" }), res);

    expect(res._status).toBe(404);
    const body = res._body as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });
});
