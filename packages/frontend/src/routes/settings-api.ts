import { TypeCompiler } from "@sinclair/typebox/compiler";
import { schemas } from "@symphony/shared";

type SettingsQueryData = Readonly<{
  effective: Record<string, unknown>;
  overlay: Record<string, unknown>;
}>;

type SaveOverlayResult = Readonly<{
  skipped: boolean;
}>;

const overlayResponseValidator = TypeCompiler.Compile(schemas.ConfigOverlayResponseSchema);
const overlayUpdateValidator = TypeCompiler.Compile(schemas.ConfigOverlayUpdateResponseSchema);

export async function fetchSettingsData(): Promise<SettingsQueryData> {
  const [configResponse, overlayResponse] = await Promise.all([
    fetch("/api/v1/config"),
    fetch("/api/v1/config/overlay"),
  ]);
  if (!configResponse.ok) {
    throw new Error(`Settings request failed with ${configResponse.status}.`);
  }
  if (!overlayResponse.ok) {
    throw new Error(`Overlay request failed with ${overlayResponse.status}.`);
  }

  const effective = (await configResponse.json()) as Record<string, unknown>;
  const overlayPayload = (await overlayResponse.json()) as unknown;
  if (!overlayResponseValidator.Check(overlayPayload)) {
    throw new Error("Overlay response failed client validation.");
  }

  return { effective, overlay: overlayPayload.overlay };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Settings request failed.";
}

export async function saveSettingsOverlay(patch: Record<string, unknown>): Promise<SaveOverlayResult> {
  if (Object.keys(patch).length === 0) {
    return { skipped: true };
  }

  const response = await fetch("/api/v1/config/overlay", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch }),
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error?: { message?: string } }).error?.message ?? "Save failed.")
        : `Save failed with ${response.status}.`;
    throw new Error(message);
  }
  if (!overlayUpdateValidator.Check(payload)) {
    throw new Error("Save response failed client validation.");
  }

  return { skipped: false };
}
