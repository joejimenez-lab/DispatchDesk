"use client";

import {
  AlertCircle,
  Bot,
  ExternalLink,
  FileDown,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";

type MessageRole = "user" | "assistant";

type AssistantLink = {
  label: string;
  href: string;
  download?: boolean;
};

type ConversationMessage = {
  role: MessageRole;
  content: string;
  links?: AssistantLink[];
};

type AssistantResponse = {
  message: string;
  links?: AssistantLink[];
};

type AssistantErrorResponse = {
  code: string;
  message: string;
};

const MAX_OUTBOUND_MESSAGES = 20;
const MAX_OUTBOUND_CHARACTERS = 16_000;
const MAX_INPUT_CHARACTERS = 1_000;

const STARTER_QUESTIONS = [
  "How many drivers do we have?",
  "How many loads are unpaid, and what is the outstanding total?",
  "Which loads are delivering this week?",
  "How much driver pay is still pending?",
  "Which trucks have maintenance coming up?",
  "Who was our highest-revenue broker last month?",
  "Show unpaid loads older than 30 days.",
  "Get me a PDF of the latest weekly financial report.",
] as const;

function isSafeHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return false;

  try {
    const base = "https://dispatchdesk.invalid";
    return new URL(href, base).origin === base;
  } catch {
    return false;
  }
}

function parseResponse(value: unknown): AssistantResponse | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.message !== "string" || !candidate.message.trim()) return null;

  const links = Array.isArray(candidate.links)
    ? candidate.links.flatMap((link) => {
        if (!link || typeof link !== "object") return [];
        const item = link as Record<string, unknown>;
        if (
          typeof item.label !== "string" ||
          !item.label.trim() ||
          typeof item.href !== "string" ||
          !isSafeHref(item.href)
        ) {
          return [];
        }

        return [{
          label: item.label,
          href: item.href,
          download: item.download === true,
        }];
      })
    : undefined;

  return { message: candidate.message, links };
}

function parseErrorResponse(value: unknown): AssistantErrorResponse | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return null;

  const candidate = error as Record<string, unknown>;
  if (
    typeof candidate.code !== "string" ||
    !candidate.code.trim() ||
    typeof candidate.message !== "string" ||
    !candidate.message.trim()
  ) {
    return null;
  }

  return { code: candidate.code, message: candidate.message };
}

function buildOutboundHistory(conversation: ConversationMessage[]) {
  const turns: ConversationMessage[][] = [];

  for (const message of conversation) {
    if (message.role === "user") {
      turns.push([message]);
      continue;
    }

    const currentTurn = turns.at(-1);
    if (currentTurn?.length === 1 && currentTurn[0].role === "user") {
      currentTurn.push(message);
    }
  }

  const selected: ConversationMessage[] = [];
  let characters = 0;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const turnCharacters = turn.reduce((total, message) => total + message.content.length, 0);
    if (
      selected.length + turn.length > MAX_OUTBOUND_MESSAGES ||
      characters + turnCharacters > MAX_OUTBOUND_CHARACTERS
    ) {
      break;
    }

    selected.unshift(...turn);
    characters += turnCharacters;
  }

  return selected;
}

function ResponseLinks({ links }: { links: AssistantLink[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => {
        const Icon = link.download ? FileDown : ExternalLink;

        return (
          <a
            key={`${link.href}-${link.label}`}
            href={link.href}
            download={link.download || undefined}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8d4f2] bg-white px-3 py-2 text-sm font-semibold text-[#5143c2] shadow-sm transition hover:border-[#a9a0ee] hover:bg-[#f7f6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6757e8] focus-visible:ring-offset-2"
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{link.label}</span>
          </a>
        );
      })}
    </div>
  );
}

export function DispatchAssistant() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryMessages, setRetryMessages] = useState<ConversationMessage[] | null>(null);
  const [requiresNewConversation, setRequiresNewConversation] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusAfterResetRef = useRef(false);
  const conversationExhausted = messages.length >= MAX_OUTBOUND_MESSAGES;

  useEffect(() => {
    if (messages.length === 0 && !isLoading && !error) return;

    const container = conversationRef.current;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    container?.scrollTo?.({
      top: container.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages, isLoading, error]);

  useEffect(() => {
    if (
      focusAfterResetRef.current &&
      messages.length === 0 &&
      !isLoading &&
      !requiresNewConversation
    ) {
      focusAfterResetRef.current = false;
      inputRef.current?.focus();
    }
  }, [isLoading, messages.length, requiresNewConversation]);

  useEffect(() => {
    if (!isLoading && messages.length > 0 && !conversationExhausted && !requiresNewConversation) {
      inputRef.current?.focus();
    }
  }, [conversationExhausted, isLoading, messages.length, requiresNewConversation]);

  async function requestAnswer(conversation: ConversationMessage[]) {
    setIsLoading(true);
    setError(null);
    setRetryMessages(null);
    setRequiresNewConversation(false);

    try {
      const outboundHistory = buildOutboundHistory(conversation);
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: outboundHistory.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const apiError = parseErrorResponse(data);
        const deterministicStatus = [400, 401, 403, 413, 415, 429].includes(response.status);
        const configurationError = apiError?.code === "assistant_not_configured";
        const mustRestart = response.status === 413 || apiError?.code === "request_too_large";

        setError(apiError?.message ?? "I couldn’t complete that request. Please try again.");
        setRetryMessages(deterministicStatus || configurationError ? null : conversation);
        setRequiresNewConversation(mustRestart);
        return;
      }

      const result = parseResponse(data);
      if (!result) throw new Error("Invalid response");

      setMessages([
        ...conversation,
        { role: "assistant", content: result.message, links: result.links },
      ]);
    } catch {
      setError("I couldn’t complete that request. Check your connection and try again.");
      setRetryMessages(conversation);
    } finally {
      setIsLoading(false);
    }
  }

  function sendMessage(content: string) {
    const question = content.trim();
    if (!question || isLoading || conversationExhausted || requiresNewConversation) return;

    const conversation = [...messages, { role: "user" as const, content: question }];
    setMessages(conversation);
    setInput("");
    void requestAnswer(conversation);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  function clearConversation() {
    setMessages([]);
    setInput("");
    setError(null);
    setRetryMessages(null);
    setRequiresNewConversation(false);
    focusAfterResetRef.current = true;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eeecff] text-[#6757e8] shadow-sm" aria-hidden="true">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#d8d4f2] bg-[#f4f2ff] px-2.5 py-0.5 text-xs font-bold tracking-[0.08em] text-[#5143c2]">
                BETA
              </span>
              <span className="text-xs font-semibold text-zinc-500">Read-only</span>
            </div>
            <h1>Dispatch Assistant</h1>
            <p>Ask operational questions, find records, and request available reports in plain language.</p>
          </div>
        </div>
        {messages.length > 0 ? (
          <Button type="button" variant="secondary" onClick={clearConversation} disabled={isLoading}>
            <RotateCcw className="size-4" aria-hidden="true" />
            New conversation
          </Button>
        ) : null}
      </header>

      <section className="flex min-h-[640px] flex-col overflow-hidden rounded-[22px] border border-[#dfe1ed] bg-white shadow-[0_18px_50px_rgba(64,57,119,0.08)]" aria-label="Dispatch Assistant chat">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#e8e7ef] bg-[#fbfaff] px-5 py-3">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[#45475d]">
            <span className="relative flex size-2.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            Ready for read-only questions
          </div>
          <span className="hidden text-xs text-zinc-500 sm:inline">Answers use your organization’s current data</span>
        </div>

        <div
          ref={conversationRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#fbfaff_100%)] px-4 py-5 sm:px-6"
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.length === 0 ? (
            <div className="m-auto w-full max-w-3xl py-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[#e3e0f5] bg-white text-[#6757e8] shadow-sm">
                <Bot className="size-7" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-zinc-950">What can I help you find?</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600">
                Choose a starting question or type your own. The assistant can inspect records but cannot change them.
              </p>
              <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                {STARTER_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-[#e1dfeb] bg-white px-4 py-3 text-left text-sm font-medium text-[#45475d] shadow-[0_3px_12px_rgba(64,57,119,0.04)] transition hover:-translate-y-0.5 hover:border-[#bcb5ef] hover:bg-[#faf9ff] hover:text-[#3f36a7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6757e8] focus-visible:ring-offset-2"
                  >
                    <span>{question}</span>
                    <Sparkles className="size-4 shrink-0 text-[#aaa5bd] transition group-hover:text-[#6757e8]" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-5">
              {messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={message.role === "user" ? "flex justify-end" : "flex items-start gap-3"}
                  aria-label={message.role === "user" ? "You" : "Dispatch Assistant"}
                >
                  {message.role === "assistant" ? (
                    <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#eeecff] text-[#6757e8]" aria-hidden="true">
                      <Bot className="size-4" />
                    </span>
                  ) : null}
                  <div
                    className={message.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#45405f] px-4 py-3 text-sm leading-6 text-white shadow-sm"
                      : "max-w-[calc(100%-44px)] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-[#e3e1ea] bg-white px-4 py-3 text-sm leading-6 text-zinc-800 shadow-sm"}
                  >
                    {message.content}
                    {message.links?.length ? <ResponseLinks links={message.links} /> : null}
                  </div>
                </article>
              ))}

              {isLoading ? (
                <div className="flex items-start gap-3" role="status">
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#eeecff] text-[#6757e8]" aria-hidden="true">
                    <Bot className="size-4" />
                  </span>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-[#e3e1ea] bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">
                    <span className="size-1.5 animate-bounce rounded-full bg-[#6757e8] [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[#6757e8] [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[#6757e8]" />
                    <span className="ml-1">Checking your data…</span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                  {requiresNewConversation ? (
                    <button
                      type="button"
                      onClick={clearConversation}
                      className="rounded-lg px-2 py-1 font-semibold text-red-800 underline decoration-red-300 underline-offset-4 hover:text-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      Start new conversation
                    </button>
                  ) : retryMessages ? (
                    <button
                      type="button"
                      onClick={() => void requestAnswer(retryMessages)}
                      className="rounded-lg px-2 py-1 font-semibold text-red-800 underline decoration-red-300 underline-offset-4 hover:text-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-[#e8e7ef] bg-white p-4 sm:p-5">
          <div className="mx-auto max-w-3xl">
            {conversationExhausted || requiresNewConversation ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8d4f2] bg-[#f7f6ff] px-4 py-3">
                <p className="text-sm font-medium text-[#45405f]">
                  This conversation has reached the beta limit. Start a new conversation to keep asking questions.
                </p>
                <Button type="button" variant="secondary" onClick={clearConversation}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Start new conversation
                </Button>
              </div>
            ) : (
              <>
                <label htmlFor="dispatch-assistant-question" className="sr-only">Ask Dispatch Assistant</label>
                <div className="flex items-end gap-2 rounded-2xl border border-[#d8d6e2] bg-white p-2 shadow-[0_6px_20px_rgba(64,57,119,0.07)] transition focus-within:border-[#8e82eb] focus-within:ring-2 focus-within:ring-[#dcd7ff]/70">
                  <textarea
                    ref={inputRef}
                    id="dispatch-assistant-question"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Ask about drivers, loads, payments, maintenance, or reports…"
                    rows={2}
                    maxLength={MAX_INPUT_CHARACTERS}
                    disabled={isLoading}
                    className="min-h-12 max-h-36 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-6 text-[#24263a] outline-none placeholder:text-[#8c8d9d] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6757e8] text-white shadow-[0_8px_18px_rgba(103,87,232,0.22)] transition hover:bg-[#5143c2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6757e8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#c6c2dc] disabled:shadow-none"
                    aria-label="Send question"
                  >
                    <Send className="size-[18px]" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 px-1 text-xs text-zinc-500">
                  <span>Enter to send · Shift + Enter for a new line</span>
                  <span>{input.length}/{MAX_INPUT_CHARACTERS.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </form>
      </section>

      <p className="text-center text-xs text-zinc-500">
        Beta answers may be incomplete. Verify important financial and operational details in the linked records.
      </p>
    </div>
  );
}
