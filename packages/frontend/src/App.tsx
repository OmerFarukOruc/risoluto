import { useEffect, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { matchPath, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { router as legacyRouter } from "../../../frontend/src/router.js";
import { startPolling, stopPolling } from "../../../frontend/src/state/polling.js";

import { AppLayout } from "./app-shell/AppLayout.js";
import { shellRoutes, type ShellRoute } from "./app-shell/routes.js";
import { resolveSetupRoutingState, setupStatusQueryOptions } from "./hooks/query-client.js";
import { AttemptRoute } from "./routes/Attempt.js";
import { ContainersRoute } from "./routes/Containers.js";
import { GitRoute } from "./routes/Git.js";
import { IssueDetailRoute } from "./routes/IssueDetail.js";
import { IssueRunsRoute } from "./routes/IssueRuns.js";
import { LogsRoute } from "./routes/Logs.js";
import { NotificationsRoute } from "./routes/Notifications.js";
import { ObservabilityRoute } from "./routes/Observability.js";
import { Overview } from "./routes/Overview.js";
import { QueueRoute } from "./routes/Queue.js";
import { SecretsRoute } from "./routes/Secrets.js";
import { Settings } from "./routes/Settings.js";
import { SetupRoute } from "./routes/Setup.js";
import { WelcomeRoute } from "./routes/Welcome.js";
import { WorkspacesRoute } from "./routes/Workspaces.js";

const routeElements: Readonly<Record<string, ReactElement>> = {
  overview: <Overview />,
  queue: <QueueRoute />,
  "queue-detail": <QueueRoute />,
  "issue-detail": <IssueDetailRoute />,
  "issue-runs": <IssueRunsRoute />,
  "issue-logs": <LogsRoute />,
  logs: <LogsRoute />,
  attempts: <AttemptRoute />,
  observability: <ObservabilityRoute />,
  git: <GitRoute />,
  workspaces: <WorkspacesRoute />,
  containers: <ContainersRoute />,
  notifications: <NotificationsRoute />,
  welcome: <WelcomeRoute />,
  secrets: <SecretsRoute />,
  settings: <Settings />,
  setup: <SetupRoute />,
};

function matchRoute(pathname: string): ShellRoute | null {
  for (const route of shellRoutes) {
    if (route.routePath === undefined) {
      if (pathname === route.href) {
        return route;
      }
      continue;
    }

    const matched = matchPath({ path: `/${route.routePath}`, end: true }, pathname);
    if (matched) {
      return route;
    }
  }

  return null;
}

function routeParamsFor(pathname: string): Record<string, string> {
  for (const route of shellRoutes) {
    if (route.routePath === undefined) {
      continue;
    }

    const matched = matchPath({ path: `/${route.routePath}`, end: true }, pathname);
    if (matched) {
      return matched.params as Record<string, string>;
    }
  }

  return {};
}

function routeNeedsLegacyPolling(pathname: string): boolean {
  const route = matchRoute(pathname);
  return route?.key === "queue" || route?.key === "queue-detail" || route?.key === "observability";
}

function buildRouteElement(route: ShellRoute): ReactElement {
  const element = route.aliasTo ? <Navigate replace to={route.aliasTo} /> : (routeElements[route.key] ?? <Overview />);

  if (route.routePath === undefined) {
    return <Route key={route.key} index element={element} />;
  }

  return <Route key={route.key} path={route.routePath} element={element} />;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function App(): ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, isError } = useQuery(setupStatusQueryOptions);

  const setupState = resolveSetupRoutingState(data, isError);

  useEffect(() => {
    legacyRouter.setExternalNavigator((target) => {
      navigate(target);
    });

    return () => {
      legacyRouter.setExternalNavigator(null);
    };
  }, [navigate]);

  useEffect(() => {
    if (setupState === "checking" || !routeNeedsLegacyPolling(location.pathname)) {
      return;
    }

    startPolling();
    return () => {
      stopPolling();
    };
  }, [location.pathname, setupState]);

  useEffect(() => {
    const activeRoute = matchRoute(location.pathname);
    const title = (activeRoute?.title ?? document.title) || "Symphony";
    document.title = title === "Overview" ? "Symphony" : `${title} · Symphony`;
    legacyRouter.dispatchNavigation(location.pathname, routeParamsFor(location.pathname), title);
  }, [location.pathname]);

  if (setupState === "setup-required" && location.pathname !== "/setup") {
    return <Navigate replace to="/setup" />;
  }

  return (
    <Routes>
      <Route element={<AppLayout setupState={setupState} />}>
        {shellRoutes.map((route) => buildRouteElement(route))}
        <Route path="*" element={<Navigate replace to={setupState === "setup-required" ? "/setup" : "/"} />} />
      </Route>
    </Routes>
  );
}
