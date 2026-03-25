import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { SecretBackend } from "@symphony/shared";
import { isRecord } from "../utils/type-guards.js";

function isValidSecretKey(value: string): boolean {
  return /^[\w.:=-]+$/.test(value);
}

function validateSecretKeyOrReject(key: string | undefined, reply: FastifyReply): key is string {
  if (!key || !isValidSecretKey(key)) {
    reply.status(400).send({
      error: {
        code: "invalid_secret_key",
        message: "secret key must match /^[A-Za-z0-9._:-]+$/",
      },
    });
    return false;
  }
  return true;
}

interface SecretsApiDeps {
  secretsStore: SecretBackend;
}

export function registerSecretsApi(app: FastifyInstance, deps: SecretsApiDeps): void {
  app.get("/api/v1/secrets", (_request, reply) => {
    reply.send({ keys: deps.secretsStore.list() });
  });

  app.post(
    "/api/v1/secrets/:key",
    async (request: FastifyRequest<{ Params: { key: string }; Body: Record<string, unknown> }>, reply) => {
      if (!validateSecretKeyOrReject(request.params.key, reply)) return;

      const body = request.body;
      const rawValue = isRecord(body) ? body.value : null;
      if (typeof rawValue !== "string" || rawValue.length === 0) {
        reply.status(400).send({
          error: {
            code: "invalid_secret_value",
            message: "secret value must be a non-empty string",
          },
        });
        return;
      }

      await deps.secretsStore.store(request.params.key, rawValue);
      reply.status(204).send();
    },
  );

  app.delete(
    "/api/v1/secrets/:key",
    async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
      if (!validateSecretKeyOrReject(request.params.key, reply)) return;

      const deleted = await deps.secretsStore.delete(request.params.key);
      if (!deleted) {
        reply.status(404).send({
          error: {
            code: "secret_not_found",
            message: "secret key not found",
          },
        });
        return;
      }

      reply.status(204).send();
    },
  );
}
