import type { ReactElement } from "react";

import { render as renderIssueRuns } from "../../../../frontend/src/pages/runs.js";
import { LegacyRouteMount } from "./LegacyRouteMount.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function IssueRunsRoute(): ReactElement {
  return <LegacyRouteMount render={renderIssueRuns} testId="issue-runs-route" />;
}
