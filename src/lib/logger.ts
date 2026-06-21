type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: string, details: Record<string, unknown> = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function logInfo(event: string, details?: Record<string, unknown>) {
  write("info", event, details);
}

export function logWarning(event: string, details?: Record<string, unknown>) {
  write("warn", event, details);
}

export function logError(event: string, error: unknown, details: Record<string, unknown> = {}) {
  write("error", event, {
    ...details,
    error: error instanceof Error ? error.message : String(error),
  });
}
