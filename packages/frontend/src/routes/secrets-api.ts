import { type Static } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { schemas } from "@symphony/shared";

type SecretListResponse = Static<typeof schemas.SecretListResponseSchema>;
type SecretValueBody = Static<typeof schemas.SecretValueBodySchema>;

const secretListValidator = TypeCompiler.Compile(schemas.SecretListResponseSchema);
const secretKeyValidator = TypeCompiler.Compile(schemas.SecretKeyParamsSchema);
const secretValueValidator = TypeCompiler.Compile(schemas.SecretValueBodySchema);

async function getResponseError(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) || fallback;
  }

  const payload = (await response.json()) as unknown;
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    if (typeof error?.message === "string") {
      return error.message;
    }
  }

  return fallback;
}

function assertSecretKey(key: string): void {
  if (!secretKeyValidator.Check({ key })) {
    throw new TypeError("Secret key must match /^[\\w.:=-]+$/.");
  }
}

function assertSecretValue(body: SecretValueBody): void {
  if (!secretValueValidator.Check(body)) {
    throw new TypeError("Secret value must be a non-empty string.");
  }
}

export async function fetchSecrets(): Promise<SecretListResponse> {
  const response = await fetch("/api/v1/secrets");
  if (!response.ok) {
    throw new Error(await getResponseError(response, `Secrets request failed with ${response.status}.`));
  }

  const payload = (await response.json()) as unknown;
  if (!secretListValidator.Check(payload)) {
    throw new Error("Secrets response failed client validation.");
  }

  return payload;
}

export async function saveSecret(key: string, value: string): Promise<void> {
  assertSecretKey(key);
  assertSecretValue({ value });

  const response = await fetch(`/api/v1/secrets/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    throw new Error(await getResponseError(response, `Saving secret failed with ${response.status}.`));
  }
}

export async function removeSecret(key: string): Promise<void> {
  assertSecretKey(key);

  const response = await fetch(`/api/v1/secrets/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await getResponseError(response, `Deleting secret failed with ${response.status}.`));
  }
}
