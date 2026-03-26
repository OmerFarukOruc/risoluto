import type { ReactElement } from "react";

import { render as renderLogs } from "../../../../frontend/src/pages/logs.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function LogsRoute(): ReactElement {
  return <LegacyRouteMount render={renderLogs} testId="logs-route" />;
}
