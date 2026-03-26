import type { ReactElement } from "react";

import { render as renderObservability } from "../../../../frontend/src/pages/observability.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ObservabilityRoute(): ReactElement {
  return <LegacyRouteMount render={renderObservability} testId="observability-route" />;
}
