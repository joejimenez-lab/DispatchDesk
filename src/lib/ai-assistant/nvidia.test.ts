import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { NvidiaAssistantError, requestNvidiaChat } from "@/lib/ai-assistant/nvidia";

describe("NVIDIA assistant provider", () => {
  beforeEach(() => {
    vi.stubEnv("NVIDIA_API_KEY", "test-api-key");
    vi.stubEnv("NVIDIA_AI_MODEL", "moonshotai/kimi-k2.6");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the server credential without putting it in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      choices: [{ message: { role: "assistant", content: "Hello" } }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestNvidiaChat({
      messages: [{ role: "user", content: "Hello" }],
      tools: [],
    });

    expect(result.model).toBe("moonshotai/kimi-k2.6");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-api-key");
    expect(init.body).not.toContain("test-api-key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "moonshotai/kimi-k2.6",
      stream: false,
      tool_choice: "auto",
    });
  });

  it("fails closed when the credential is missing or the provider response is invalid", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    await expect(requestNvidiaChat({ messages: [], tools: [] }))
      .rejects.toEqual(expect.objectContaining<Partial<NvidiaAssistantError>>({ code: "not_configured" }));

    vi.stubEnv("NVIDIA_API_KEY", "test-api-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ unexpected: true })));
    await expect(requestNvidiaChat({ messages: [], tools: [] }))
      .rejects.toEqual(expect.objectContaining<Partial<NvidiaAssistantError>>({ code: "invalid_response" }));
  });
});

