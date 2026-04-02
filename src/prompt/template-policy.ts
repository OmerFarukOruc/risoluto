import { Liquid } from "liquidjs";

const OUTPUT_EXPR_RE = /^(attempt|issue(?:\.[A-Za-z_]\w*)+|workspace(?:\.[A-Za-z_]\w*)+)$/;
const IF_STATEMENT_RE = /^if\s+(attempt|issue(?:\.[A-Za-z_]\w*)+|workspace(?:\.[A-Za-z_]\w*)+)$/;

interface ParsedTemplateToken {
  token: string;
  nextCursor: number;
  output: boolean;
}

export class PromptTemplateValidationError extends TypeError {}

export function createPromptLiquid(): Liquid {
  return new Liquid({ strictVariables: true, strictFilters: true });
}

function nextTagStart(body: string, cursor: number): { start: number; output: boolean } | null {
  const nextOutput = body.indexOf("{{", cursor);
  const nextStatement = body.indexOf("{%", cursor);

  if (nextOutput === -1 && nextStatement === -1) {
    return null;
  }
  if (nextOutput !== -1 && (nextStatement === -1 || nextOutput < nextStatement)) {
    return { start: nextOutput, output: true };
  }
  return { start: nextStatement, output: false };
}

function parseNextToken(body: string, cursor: number): ParsedTemplateToken | null {
  const nextTag = nextTagStart(body, cursor);
  if (nextTag === null) {
    return null;
  }

  const closingDelimiter = nextTag.output ? "}}" : "%}";
  const closeIndex = body.indexOf(closingDelimiter, nextTag.start + 2);
  if (closeIndex === -1) {
    throw new PromptTemplateValidationError("unclosed Liquid tag in prompt template.");
  }

  return {
    token: body.slice(nextTag.start, closeIndex + 2),
    nextCursor: closeIndex + 2,
    output: nextTag.output,
  };
}

function validateOutputToken(token: string): void {
  const expression = token.slice(2, -2).trim();
  if (!OUTPUT_EXPR_RE.test(expression)) {
    throw new PromptTemplateValidationError(
      `unsupported Liquid output expression: ${expression || "(empty)"}. ` +
        "Only direct issue.*, workspace.*, and attempt references are allowed.",
    );
  }
}

function applyStatementToken(token: string, conditionalDepth: number): number {
  const statement = token.slice(2, -2).trim();
  if (statement === "endif") {
    if (conditionalDepth === 0) {
      throw new PromptTemplateValidationError("unexpected {% endif %} without a matching {% if ... %}.");
    }
    return conditionalDepth - 1;
  }

  if (IF_STATEMENT_RE.test(statement)) {
    return conditionalDepth + 1;
  }

  throw new PromptTemplateValidationError(
    `unsupported Liquid statement: ${statement || "(empty)"}. Only {% if <reference> %} and {% endif %} are allowed.`,
  );
}

export function validatePromptTemplate(body: string): void {
  let conditionalDepth = 0;
  let cursor = 0;

  while (cursor < body.length) {
    const parsedToken = parseNextToken(body, cursor);
    if (parsedToken === null) {
      break;
    }

    cursor = parsedToken.nextCursor;
    if (parsedToken.output) {
      validateOutputToken(parsedToken.token);
      continue;
    }
    conditionalDepth = applyStatementToken(parsedToken.token, conditionalDepth);
  }

  if (conditionalDepth !== 0) {
    throw new PromptTemplateValidationError("unclosed {% if ... %} block in prompt template.");
  }
}
