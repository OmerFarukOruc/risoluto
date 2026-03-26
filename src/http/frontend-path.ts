import { existsSync } from "node:fs";
import { join } from "node:path";

import { FEATURE_FLAG_REACT_FRONTEND, isEnabled } from "../core/feature-flags.js";

export interface FrontendDistPaths {
  react: string;
  vanilla: string;
}

export interface FrontendPathOptions {
  frontendDir?: string;
  cwd?: string;
  reactFrontendEnabled?: boolean;
  vanillaFrontendExists?: boolean;
}

export function getFrontendDistPaths(cwd = process.cwd()): FrontendDistPaths {
  return {
    react: join(cwd, "dist/frontend"),
    vanilla: join(cwd, "dist/frontend-vanilla"),
  };
}

export function resolveFrontendPath(options?: FrontendPathOptions): string {
  if (options?.frontendDir) {
    return options.frontendDir;
  }

  const paths = getFrontendDistPaths(options?.cwd);
  const reactFrontendEnabled = options?.reactFrontendEnabled ?? isEnabled(FEATURE_FLAG_REACT_FRONTEND);
  if (reactFrontendEnabled) {
    return paths.react;
  }

  const vanillaFrontendExists = options?.vanillaFrontendExists ?? existsSync(paths.vanilla);
  return vanillaFrontendExists ? paths.vanilla : paths.react;
}

export function resolveFrontendDir(options?: FrontendPathOptions): string {
  return resolveFrontendPath(options);
}
