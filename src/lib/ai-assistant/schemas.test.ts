import { describe, expect, it } from "vitest";
import { assistantRequestSchema } from "@/lib/ai-assistant/schemas";

describe("assistant request schema", () => {
  it("accepts a bounded conversation ending in a user message", () => {
    expect(assistantRequestSchema.safeParse({
      messages: [
        { role: "user", content: "How many drivers do we have?" },
        { role: "assistant", content: "Let me check." },
        { role: "user", content: "And how many loads are unpaid?" },
      ],
    }).success).toBe(true);
  });

  it("rejects unknown fields and conversations that do not end with the user", () => {
    expect(assistantRequestSchema.safeParse({
      messages: [{ role: "assistant", content: "Hello" }],
      model: "untrusted-model",
    }).success).toBe(false);
  });

  it("rejects oversized message content", () => {
    expect(assistantRequestSchema.safeParse({
      messages: [{ role: "user", content: "x".repeat(4_001) }],
    }).success).toBe(false);
  });
});

