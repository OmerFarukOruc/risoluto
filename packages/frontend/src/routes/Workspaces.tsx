import type { ReactElement } from "react";

import { render as renderWorkspaces } from "../../../../frontend/src/pages/workspaces.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function WorkspacesRoute(): ReactElement {
  return <LegacyRouteMount render={renderWorkspaces} testId="workspaces-route" />;
}
