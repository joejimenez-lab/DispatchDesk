import { NextResponse } from "next/server";
import { isAiAssistantUserAllowed } from "@/lib/ai-assistant/access";
import { runAiAssistant, AssistantRunError } from "@/lib/ai-assistant/assistant";
import { NvidiaAssistantError } from "@/lib/ai-assistant/nvidia";
import { checkAssistantRateLimit } from "@/lib/ai-assistant/rate-limit";
import { assistantRequestSchema } from "@/lib/ai-assistant/schemas";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_REQUEST_BYTES = 32_000;

function errorResponse(code: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "private, no-store", ...headers },
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const auth = await createAuthenticatedRouteClient({
    method: request.method,
    path: url.pathname,
    route: "/api/ai-assistant",
    kind: "api",
  });
  if (auth.response) {
    const status = auth.response.status;
    return errorResponse(
      status === 401 ? "unauthorized" : "authentication_unavailable",
      status === 401 ? "Please sign in to use Dispatch Assistant." : "Authentication is temporarily unavailable.",
      status,
    );
  }

  if (!auth.supabase) {
    return errorResponse("authentication_unavailable", "Authentication is temporarily unavailable.", 503);
  }

  if (!await isAiAssistantUserAllowed(auth.supabase, auth.user)) {
    return errorResponse("not_found", "Not found.", 404);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return errorResponse("forbidden_origin", "This request is not allowed.", 403);
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return errorResponse("unsupported_media_type", "Send the request as JSON.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return errorResponse("request_too_large", "That conversation is too large. Start a new chat and try again.", 413);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      return errorResponse("request_too_large", "That conversation is too large. Start a new chat and try again.", 413);
    }
    body = JSON.parse(text);
  } catch {
    return errorResponse("invalid_json", "The request could not be read. Please try again.", 400);
  }

  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("invalid_request", "Check the conversation and try again.", 400);
  }

  let rateLimit: Awaited<ReturnType<typeof checkAssistantRateLimit>>;
  try {
    rateLimit = await checkAssistantRateLimit(auth.supabase, auth.user);
  } catch {
    return errorResponse(
      "usage_limits_unavailable",
      "Dispatch Assistant is temporarily unavailable. Please try again later.",
      503,
    );
  }
  if (!rateLimit.allowed) {
    return errorResponse(
      "rate_limited",
      "Too many assistant requests. Please wait a moment and try again.",
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  try {
    const result = await runAiAssistant(auth.supabase, parsed.data.messages);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof NvidiaAssistantError) {
      if (error.code === "not_configured") {
        return errorResponse("assistant_not_configured", "Dispatch Assistant is not configured yet.", 503);
      }
      if (error.code === "timeout") {
        return errorResponse("assistant_timeout", "Dispatch Assistant took too long to respond. Please try again.", 504);
      }
      return errorResponse("assistant_unavailable", "Dispatch Assistant is temporarily unavailable. Please try again.", 502);
    }
    if (error instanceof AssistantRunError && error.code === "timeout") {
      return errorResponse("assistant_timeout", "Dispatch Assistant took too long to respond. Please try again.", 504);
    }
    return errorResponse("assistant_error", "Dispatch Assistant could not answer that request. Please try again.", 500);
  }
}
