export function logRuntimeError(event: string, stage: string, error: unknown) {
  console.error(JSON.stringify({
    event,
    stage,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: typeof error === "object" && error && "code" in error ? String(error.code) : null,
  }));
}
