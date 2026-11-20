const destinations = [
  "/dashboard/applications", "/dashboard/members", "/dashboard/reports", "/dashboard/documents",
];

export function listOrigin(input: unknown) {
  if (typeof input !== "string" || input.length > 2500) return undefined;
  const [path] = input.split("?");
  if (!destinations.includes(path) || /[#\\\r\n]/.test(input)) return undefined;
  return input;
}

export function withListOrigin(href: string, origin?: string | null) {
  const list = listOrigin(origin);
  if (!list) return href;
  return href + (href.includes("?") ? "&" : "?") + "fromList=" + encodeURIComponent(list);
}

export function listBackLabel(list: string) {
  if (list.startsWith("/dashboard/reports")) return "Есепке оралу";
  if (list.startsWith("/dashboard/members")) return "Мүшелерге оралу";
  if (list.startsWith("/dashboard/documents")) return "Құжаттарға оралу";
  return "Өтініштерге оралу";
}
