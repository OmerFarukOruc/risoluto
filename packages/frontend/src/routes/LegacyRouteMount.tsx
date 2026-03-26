import { useEffect, useMemo, useRef, type ReactElement } from "react";
import { useParams } from "react-router-dom";

import styles from "./LegacyRouteMount.module.css";

export type LegacyRouteRenderer = (params?: Record<string, string>) => HTMLElement;

type LegacyRouteMountProps = Readonly<{
  render: LegacyRouteRenderer;
  testId?: string;
}>;

function normalizeRouteParams(params: Readonly<Record<string, string | undefined>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function LegacyRouteMount({ render, testId }: LegacyRouteMountProps): ReactElement {
  const params = useParams();
  const hostRef = useRef<HTMLDivElement>(null);

  const normalizedParams = useMemo(() => normalizeRouteParams(params), [params]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const element = render(normalizedParams);
    host.replaceChildren(element);

    return () => {
      if (host.contains(element)) {
        host.replaceChildren();
      }
    };
  }, [normalizedParams, render]);

  return <div className={styles.mount} data-testid={testId} ref={hostRef} />;
}
