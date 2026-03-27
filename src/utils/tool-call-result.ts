/** Shared result wrapper for MCP-style tool-call handlers. */
import { toErrorString } from "./type-guards.js";

interface ToolCallContentItem {
  type: "inputText";
  text: string;
}

export interface ToolCallResult {
  success: boolean;
  contentItems: ToolCallContentItem[];
}

function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

export function toolCallSuccess(value: unknown): ToolCallResult {
  return {
    success: true,
    contentItems: [{ type: "inputText", text: jsonText(value) }],
  };
}

export function toolCallFailure(error: unknown): ToolCallResult {
  const message = toErrorString(error);
  return {
    success: false,
    contentItems: [{ type: "inputText", text: jsonText({ error: message }) }],
  };
}

export function toolCallErrorPayload(payload: unknown): ToolCallResult {
  return {
    success: false,
    contentItems: [{ type: "inputText", text: jsonText(payload) }],
  };
}
