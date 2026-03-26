import type { ReactElement } from "react";

import { render as renderContainers } from "../../../../frontend/src/pages/containers.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ContainersRoute(): ReactElement {
  return <LegacyRouteMount render={renderContainers} testId="containers-route" />;
}
