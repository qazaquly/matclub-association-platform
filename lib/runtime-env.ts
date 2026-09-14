const runtimeValues: Record<string, string | undefined> = {};

export function configureRuntimeEnv(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") runtimeValues[key] = value;
  }
}

export function runtimeEnv(name: string) {
  return runtimeValues[name] ?? process.env[name];
}
