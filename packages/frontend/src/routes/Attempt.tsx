import type { ReactElement } from "react";

import { render as renderAttempt } from "../../../../frontend/src/pages/attempt.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function AttemptRoute(): ReactElement {
  return <LegacyRouteMount render={renderAttempt} testId="attempt-route" />;
}
