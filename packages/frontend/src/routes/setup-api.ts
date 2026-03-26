import { type Static } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { schemas } from "@symphony/shared";

type SetupStatusResponse = Static<typeof schemas.SetupStatusResponseSchema>;
type MasterKeyResponse = Static<typeof schemas.MasterKeyResponseSchema>;
type LinearProjectsResponse = Static<typeof schemas.LinearProjectsResponseSchema>;
type TokenValidationResponse = Static<typeof schemas.TokenValidationResponseSchema>;
type RepoRoutesResponse = Static<typeof schemas.RepoRoutesResponseSchema>;
type RepoRouteCreateResponse = Static<typeof schemas.RepoRouteCreateResponseSchema>;
type RepoRouteDeleteResponse = Static<typeof schemas.RepoRouteDeleteResponseSchema>;
type DetectDefaultBranchResponse = Static<typeof schemas.DetectDefaultBranchResponseSchema>;
type OkResponse = Static<typeof schemas.OkResponseSchema>;
type CreateTestIssueResponse = Static<typeof schemas.CreateTestIssueResponseSchema>;
type CreateLabelResponse = Static<typeof schemas.CreateLabelResponseSchema>;
type CreateProjectResponse = Static<typeof schemas.CreateProjectResponseSchema>;
type PkceStartResponse = Static<typeof schemas.PkceStartResponseSchema>;
type PkceStatusResponse = Static<typeof schemas.PkceStatusResponseSchema>;

const setupStatusValidator = TypeCompiler.Compile(schemas.SetupStatusResponseSchema);
const masterKeyBodyValidator = TypeCompiler.Compile(schemas.MasterKeyBodySchema);
const masterKeyResponseValidator = TypeCompiler.Compile(schemas.MasterKeyResponseSchema);
const apiKeyBodyValidator = TypeCompiler.Compile(schemas.ApiKeyBodySchema);
const linearProjectsResponseValidator = TypeCompiler.Compile(schemas.LinearProjectsResponseSchema);
const linearProjectSelectionValidator = TypeCompiler.Compile(schemas.LinearProjectSelectionBodySchema);
const tokenValidationResponseValidator = TypeCompiler.Compile(schemas.TokenValidationResponseSchema);
const codexAuthBodyValidator = TypeCompiler.Compile(schemas.CodexAuthBodySchema);
const githubTokenBodyValidator = TypeCompiler.Compile(schemas.GitHubTokenBodySchema);
const repoRouteCreateBodyValidator = TypeCompiler.Compile(schemas.RepoRouteCreateBodySchema);
const repoRouteCreateResponseValidator = TypeCompiler.Compile(schemas.RepoRouteCreateResponseSchema);
const repoRoutesResponseValidator = TypeCompiler.Compile(schemas.RepoRoutesResponseSchema);
const repoRouteDeleteBodyValidator = TypeCompiler.Compile(schemas.RepoRouteDeleteBodySchema);
const repoRouteDeleteResponseValidator = TypeCompiler.Compile(schemas.RepoRouteDeleteResponseSchema);
const detectDefaultBranchBodyValidator = TypeCompiler.Compile(schemas.DetectDefaultBranchBodySchema);
const detectDefaultBranchResponseValidator = TypeCompiler.Compile(schemas.DetectDefaultBranchResponseSchema);
const okResponseValidator = TypeCompiler.Compile(schemas.OkResponseSchema);
const createTestIssueResponseValidator = TypeCompiler.Compile(schemas.CreateTestIssueResponseSchema);
const createLabelResponseValidator = TypeCompiler.Compile(schemas.CreateLabelResponseSchema);
const createProjectBodyValidator = TypeCompiler.Compile(schemas.CreateProjectBodySchema);
const createProjectResponseValidator = TypeCompiler.Compile(schemas.CreateProjectResponseSchema);
const pkceStartResponseValidator = TypeCompiler.Compile(schemas.PkceStartResponseSchema);
const pkceStatusResponseValidator = TypeCompiler.Compile(schemas.PkceStatusResponseSchema);

function validateBody<T>(validator: { Check(value: unknown): boolean }, value: T, message: string): T {
  if (!validator.Check(value)) {
    throw new TypeError(message);
  }
  return value;
}

async function readJson<T>(
  response: Response,
  validator: { Check(value: unknown): boolean },
  fallback: string,
): Promise<T> {
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    if (typeof payload === "object" && payload !== null && "error" in payload) {
      const error = (payload as { error?: { message?: string } }).error;
      throw new Error(typeof error?.message === "string" ? error.message : fallback);
    }
    throw new Error(fallback);
  }
  if (!validator.Check(payload)) {
    throw new Error("Response failed client validation.");
  }
  return payload as T;
}

export async function fetchSetupStatusDetail(): Promise<SetupStatusResponse> {
  const response = await fetch("/api/v1/setup/status");
  return readJson<SetupStatusResponse>(
    response,
    setupStatusValidator,
    `Setup status request failed with ${response.status}.`,
  );
}

export async function createMasterKey(): Promise<MasterKeyResponse> {
  const body = validateBody(masterKeyBodyValidator, {}, "Master key request body failed validation.");
  const response = await fetch("/api/v1/setup/master-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<MasterKeyResponse>(
    response,
    masterKeyResponseValidator,
    `Master key request failed with ${response.status}.`,
  );
}

export async function fetchLinearProjects(): Promise<LinearProjectsResponse> {
  const response = await fetch("/api/v1/setup/linear-projects");
  return readJson<LinearProjectsResponse>(
    response,
    linearProjectsResponseValidator,
    `Linear projects request failed with ${response.status}.`,
  );
}

export async function saveLinearProject(slugId: string): Promise<OkResponse> {
  const body = validateBody(linearProjectSelectionValidator, { slugId }, "Linear project selection failed validation.");
  const response = await fetch("/api/v1/setup/linear-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<OkResponse>(response, okResponseValidator, `Linear project save failed with ${response.status}.`);
}

export async function saveOpenaiKey(key: string): Promise<TokenValidationResponse> {
  const body = validateBody(apiKeyBodyValidator, { key }, "OpenAI key failed validation.");
  const response = await fetch("/api/v1/setup/openai-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<TokenValidationResponse>(
    response,
    tokenValidationResponseValidator,
    `OpenAI key validation failed with ${response.status}.`,
  );
}

export async function saveCodexAuth(authJson: string): Promise<OkResponse> {
  const body = validateBody(codexAuthBodyValidator, { authJson }, "Codex auth payload failed validation.");
  const response = await fetch("/api/v1/setup/codex-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<OkResponse>(response, okResponseValidator, `Codex auth save failed with ${response.status}.`);
}

export async function saveGithubToken(token: string): Promise<TokenValidationResponse> {
  const body = validateBody(githubTokenBodyValidator, { token }, "GitHub token failed validation.");
  const response = await fetch("/api/v1/setup/github-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<TokenValidationResponse>(
    response,
    tokenValidationResponseValidator,
    `GitHub token validation failed with ${response.status}.`,
  );
}

export async function saveRepoRoute(
  route: Static<typeof schemas.RepoRouteCreateBodySchema>,
): Promise<RepoRouteCreateResponse> {
  const body = validateBody(repoRouteCreateBodyValidator, route, "Repo route failed validation.");
  const response = await fetch("/api/v1/setup/repo-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<RepoRouteCreateResponse>(
    response,
    repoRouteCreateResponseValidator,
    `Repo route save failed with ${response.status}.`,
  );
}

export async function fetchRepoRoutes(): Promise<RepoRoutesResponse> {
  const response = await fetch("/api/v1/setup/repo-routes");
  return readJson<RepoRoutesResponse>(
    response,
    repoRoutesResponseValidator,
    `Repo routes request failed with ${response.status}.`,
  );
}

export async function deleteRepoRoute(index: number): Promise<RepoRouteDeleteResponse> {
  const body = validateBody(repoRouteDeleteBodyValidator, { index }, "Repo route delete failed validation.");
  const response = await fetch("/api/v1/setup/repo-route", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<RepoRouteDeleteResponse>(
    response,
    repoRouteDeleteResponseValidator,
    `Repo route delete failed with ${response.status}.`,
  );
}

export async function detectDefaultBranch(repoUrl: string): Promise<DetectDefaultBranchResponse> {
  const body = validateBody(
    detectDefaultBranchBodyValidator,
    { repoUrl },
    "Default branch detection request failed validation.",
  );
  const response = await fetch("/api/v1/setup/detect-default-branch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<DetectDefaultBranchResponse>(
    response,
    detectDefaultBranchResponseValidator,
    `Default branch detection failed with ${response.status}.`,
  );
}

export async function resetSetup(): Promise<OkResponse> {
  const response = await fetch("/api/v1/setup/reset", { method: "POST" });
  return readJson<OkResponse>(response, okResponseValidator, `Setup reset failed with ${response.status}.`);
}

export async function createTestIssue(): Promise<CreateTestIssueResponse> {
  const response = await fetch("/api/v1/setup/create-test-issue", { method: "POST" });
  return readJson<CreateTestIssueResponse>(
    response,
    createTestIssueResponseValidator,
    `Create test issue failed with ${response.status}.`,
  );
}

export async function createLabel(): Promise<CreateLabelResponse> {
  const response = await fetch("/api/v1/setup/create-label", { method: "POST" });
  return readJson<CreateLabelResponse>(
    response,
    createLabelResponseValidator,
    `Create label failed with ${response.status}.`,
  );
}

export async function createProject(name: string): Promise<CreateProjectResponse> {
  const body = validateBody(createProjectBodyValidator, { name }, "Project creation failed validation.");
  const response = await fetch("/api/v1/setup/create-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<CreateProjectResponse>(
    response,
    createProjectResponseValidator,
    `Project creation failed with ${response.status}.`,
  );
}

export async function startPkceAuth(): Promise<PkceStartResponse> {
  const response = await fetch("/api/v1/setup/pkce-auth/start", { method: "POST" });
  return readJson<PkceStartResponse>(
    response,
    pkceStartResponseValidator,
    `Browser sign-in failed with ${response.status}.`,
  );
}

export async function fetchPkceStatus(): Promise<PkceStatusResponse> {
  const response = await fetch("/api/v1/setup/pkce-auth/status");
  return readJson<PkceStatusResponse>(
    response,
    pkceStatusResponseValidator,
    `Auth status failed with ${response.status}.`,
  );
}

export async function cancelPkceAuth(): Promise<OkResponse> {
  const response = await fetch("/api/v1/setup/pkce-auth/cancel", { method: "POST" });
  return readJson<OkResponse>(response, okResponseValidator, `Auth cancel failed with ${response.status}.`);
}
