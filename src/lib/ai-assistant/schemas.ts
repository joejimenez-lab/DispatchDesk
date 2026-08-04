import { z } from "zod";

export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_CHARACTERS = 4_000;
export const MAX_CONVERSATION_CHARACTERS = 16_000;

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARACTERS),
}).strict();

export const assistantRequestSchema = z.object({
  messages: z.array(assistantMessageSchema).min(1).max(MAX_MESSAGES),
}).strict().superRefine(({ messages }, context) => {
  const characters = messages.reduce((total, message) => total + message.content.length, 0);
  if (characters > MAX_CONVERSATION_CHARACTERS) {
    context.addIssue({
      code: "custom",
      path: ["messages"],
      message: "Conversation is too long.",
    });
  }

  if (messages.at(-1)?.role !== "user") {
    context.addIssue({
      code: "custom",
      path: ["messages"],
      message: "The last message must be from the user.",
    });
  }
});

const providerToolCallSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1).max(100),
    arguments: z.string().max(12_000),
  }),
});

export const providerChatResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      role: z.literal("assistant"),
      content: z.string().nullable().optional(),
      tool_calls: z.array(providerToolCallSchema).max(8).optional(),
    }),
  })).min(1),
});

export const assistantLinkSchema = z.object({
  label: z.string().min(1).max(160),
  href: z.string().startsWith("/"),
  download: z.boolean().optional(),
}).strict();

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantInputMessage = z.infer<typeof assistantMessageSchema>;
export type ProviderChatResponse = z.infer<typeof providerChatResponseSchema>;
export type ProviderToolCall = z.infer<typeof providerToolCallSchema>;
export type AssistantLink = z.infer<typeof assistantLinkSchema>;

export type AssistantSuccessResponse = {
  message: string;
  links?: AssistantLink[];
  meta?: {
    model: string;
    toolCalls: string[];
    generatedAt: string;
  };
};

