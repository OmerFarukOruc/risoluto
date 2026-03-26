import type { ReactElement } from "react";

import { render as renderQueue } from "../../../../frontend/src/pages/queue.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function QueueRoute(): ReactElement {
  return <LegacyRouteMount render={renderQueue} testId="queue-route" />;
}
