import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const requestNvidiaChat = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai-assistant/nvidia", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai-assistant/nvidia")>()),
  requestNvidiaChat,
}));

import { AssistantRunError, runAiAssistant } from "@/lib/ai-assistant/assistant";

describe("assistant tool loop", () => {
  beforeEach(() => requestNvidiaChat.mockReset());

  it("executes a trusted tool and returns its download link separately", async () => {
    requestNvidiaChat
      .mockResolvedValueOnce({
        model: "moonshotai/kimi-k2.6",
        response: {
          choices: [{ message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-1",
              type: "function",
              function: { name: "get_available_pdf_exports", arguments: "{\"report\":\"maintenance\"}" },
            }],
          } }],
        },
      })
      .mockResolvedValueOnce({
        model: "moonshotai/kimi-k2.6",
        response: { choices: [{ message: { role: "assistant", content: "Your maintenance PDF is ready." } }] },
      });

    const result = await runAiAssistant({} as never, [{ role: "user", content: "Get me a maintenance PDF" }]);

    expect(result.message).toBe("Your maintenance PDF is ready.");
    expect(result.links).toEqual([{
      label: "Maintenance history (PDF)",
      href: "/api/reports/exports/maintenance?format=pdf",
      download: true,
    }]);
    expect(result.meta).toMatchObject({
      model: "moonshotai/kimi-k2.6",
      toolCalls: ["get_available_pdf_exports"],
    });
    expect(requestNvidiaChat.mock.calls[1][0].messages).toContainEqual(expect.objectContaining({
      role: "tool",
      tool_call_id: "call-1",
    }));
  });

  it("refuses a provider request for an unknown tool", async () => {
    requestNvidiaChat.mockResolvedValue({
      model: "moonshotai/kimi-k2.6",
      response: {
        choices: [{ message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call-1", type: "function", function: { name: "run_sql", arguments: "{}" } }],
        } }],
      },
    });

    await expect(runAiAssistant({} as never, [{ role: "user", content: "Delete everything" }]))
      .rejects.toEqual(expect.objectContaining<Partial<AssistantRunError>>({ code: "tool_failed" }));
  });

  it("returns a bounded argument error to the provider and allows a repaired call", async () => {
    requestNvidiaChat
      .mockResolvedValueOnce({
        model: "moonshotai/kimi-k2.6",
        response: {
          choices: [{ message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-invalid",
              type: "function",
              function: { name: "get_available_pdf_exports", arguments: "{" },
            }],
          } }],
        },
      })
      .mockResolvedValueOnce({
        model: "moonshotai/kimi-k2.6",
        response: {
          choices: [{ message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-repaired",
              type: "function",
              function: { name: "get_available_pdf_exports", arguments: "{\"report\":\"maintenance\"}" },
            }],
          } }],
        },
      })
      .mockResolvedValueOnce({
        model: "moonshotai/kimi-k2.6",
        response: { choices: [{ message: { role: "assistant", content: "Your maintenance PDF is ready." } }] },
      });

    const result = await runAiAssistant({} as never, [{ role: "user", content: "Get a maintenance PDF" }]);

    expect(result.meta?.toolCalls).toEqual([
      "get_available_pdf_exports",
      "get_available_pdf_exports",
    ]);
    expect(result.links).toEqual([expect.objectContaining({
      href: "/api/reports/exports/maintenance?format=pdf",
    })]);
    const repairMessages = requestNvidiaChat.mock.calls[1][0].messages as Array<Record<string, unknown>>;
    const errorMessage = repairMessages.find((message) => message.tool_call_id === "call-invalid");
    expect(errorMessage).toMatchObject({ role: "tool", name: "get_available_pdf_exports" });
    expect(String(errorMessage?.content).length).toBeLessThan(500);
    expect(JSON.parse(String(errorMessage?.content))).toEqual({
      error: {
        code: "invalid_arguments",
        message: "The parameters were invalid. Try again with arguments that match the provided schema.",
      },
    });
  });
});
