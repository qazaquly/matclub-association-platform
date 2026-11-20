export const directoryPageSize = 50;

export function directoryPage(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1;
}

export function directoryUrl(base: string, values: Record<string, string | undefined>, keys: string[], page: number) {
  const params = new URLSearchParams();
  for (const key of keys) if (values[key]) params.set(key, values[key]!);
  if (page > 1) params.set("page", String(page));
  return base + (params.size ? "?" + params.toString() : "");
}
