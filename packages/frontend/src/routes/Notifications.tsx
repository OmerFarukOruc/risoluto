import type { ReactElement } from "react";

import { render as renderNotifications } from "../../../../frontend/src/pages/notifications.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function NotificationsRoute(): ReactElement {
  return <LegacyRouteMount render={renderNotifications} testId="notifications-route" />;
}
