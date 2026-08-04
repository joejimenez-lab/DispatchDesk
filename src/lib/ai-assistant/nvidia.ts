import "server-only";

import { providerChatResponseSchema, type ProviderChatResponse } from "@/lib/ai-assistant/schemas";

export const DEFAULT_NVIDIA_MODEL = "moonshotai/kimi-k2.6";
const DEFAULT_NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MAX_PROVIDER_RESPONSE_BYTES = 256_000;
const PROVIDER_TIMEOUT_MS = 20_000;

export class NvidiaAssistantError extends Error {
  constructor(
    public readonly code: "not_configured" | "timeout" | "unavailable" | "invalid_response",
  ) {
    super(code);
    this.name = "NvidiaAssistantError";
  }
}

export function configuredNvidiaModel() {
  return process.env.NVIDIA_AI_MODEL?.trim() || DEFAULT_NVIDIA_MODEL;
}

function providerUrl() {
  const configured = process.env.NVIDIA_API_URL?.trim();
  if (!configured) return DEFAULT_NVIDIA_URL;

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:") throw new Error("HTTPS is required");
    return url.toString();
  } catch {
    throw new NvidiaAssistantError("not_configured");
  }
}

function combinedAbortSignal(parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("provider_timeout"), PROVIDER_TIMEOUT_MS);
  const abortFromParent = () => controller.abort(parentSignal?.reason ?? "request_timeout");
  parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

export async function requestNvidiaChat(
  payload: { messages: unknown[]; tools: unknown[] },
  signal?: AbortSignal,
): Promise<{ model: string; response: ProviderChatResponse }> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) throw new NvidiaAssistantError("not_configured");

  const model = configuredNvidiaModel();
  const abort = combinedAbortSignal(signal);

  try {
    const response = await fetch(providerUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: payload.messages,
        tools: payload.tools,
        tool_choice: "auto",
        max_tokens: 1_200,
        temperature: 0.2,
        top_p: 0.9,
        stream: false,
      }),
      cache: "no-store",
      signal: abort.signal,
    });

    if (!response.ok) throw new NvidiaAssistantError("unavailable");

    const body = await response.text();
    if (body.length > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new NvidiaAssistantError("invalid_response");
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new NvidiaAssistantError("invalid_response");
    }

    const parsed = providerChatResponseSchema.safeParse(json);
    if (!parsed.success) throw new NvidiaAssistantError("invalid_response");
    return { model, response: parsed.data };
  } catch (error) {
    if (error instanceof NvidiaAssistantError) throw error;
    if (abort.signal.aborted || signal?.aborted) throw new NvidiaAssistantError("timeout");
    throw new NvidiaAssistantError("unavailable");
  } finally {
    abort.cleanup();
  }
}

