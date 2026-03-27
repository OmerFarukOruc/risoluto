import type { Request, Response } from "express";

import type { OrchestratorPort } from "../orchestrator/port.js";

export function handleAttemptDetail(orchestrator: OrchestratorPort, request: Request, response: Response): void {
  const attempt = orchestrator.getAttemptDetail(String(request.params.attempt_id));
  if (!attempt) {
    response.status(404).json({
      error: {
        code: "not_found",
        message: "Unknown attempt identifier",
      },
    });
    return;
  }
  response.json(attempt);
}
