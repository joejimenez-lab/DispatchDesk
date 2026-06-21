import type { Instrumentation } from "next";
import { logError, logInfo } from "@/lib/logger";

export function register() {
  logInfo("application.started", {
    runtime: process.env.NEXT_RUNTIME ?? "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_RELEASE ?? "local",
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const requestError = error instanceof Error ? error : new Error(String(error));
  const digest = "digest" in requestError && typeof requestError.digest === "string" ? requestError.digest : undefined;
  const details = {
    digest,
    method: request.method,
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
  };
  logError("request.failed", requestError, details);

  const webhook = process.env.ERROR_MONITORING_WEBHOOK_URL;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ERROR_MONITORING_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.ERROR_MONITORING_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        service: "DispatchDesk",
        level: "error",
        message: requestError.message,
        ...details,
      }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (monitoringError) {
    logError("monitoring.delivery_failed", monitoringError, { originalDigest: digest });
  }
};
