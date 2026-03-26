import type { ReactElement } from "react";

import { render as renderWelcome } from "../../../../frontend/src/pages/welcome.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function WelcomeRoute(): ReactElement {
  return <LegacyRouteMount render={renderWelcome} testId="welcome-route" />;
}
