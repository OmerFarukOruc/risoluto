import type { ReactElement } from "react";

import { render as renderGit } from "../../../../frontend/src/pages/git.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function GitRoute(): ReactElement {
  return <LegacyRouteMount render={renderGit} testId="git-route" />;
}
