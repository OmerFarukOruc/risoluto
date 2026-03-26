export function buildRouteRenderKey(
  pathname: string,
  hash: string,
  params: Readonly<Record<string, string | undefined>>,
): string {
  const serializedParams = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("&");

  return `${pathname}${hash}?${serializedParams}`;
}
