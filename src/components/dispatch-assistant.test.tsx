// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DispatchAssistant } from "./dispatch-assistant";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DispatchAssistant", () => {
  it("sends a starter question and renders returned report links", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      message: "Your latest weekly financial report is ready.",
      links: [
        {
          label: "Download weekly report PDF",
          href: "/api/reports/weekly/pdf?period=this",
          download: true,
        },
        { label: "Unsafe backslash link", href: "/\\evil.example/report.pdf" },
        { label: "External link", href: "https://example.com/report.pdf" },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DispatchAssistant />);

    fireEvent.click(screen.getByRole("button", {
      name: "Get me a PDF of the latest weekly financial report.",
    }));

    expect(await screen.findByText("Your latest weekly financial report is ready.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/ai-assistant", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: "Get me a PDF of the latest weekly financial report.",
        }],
      }),
    }));

    const reportLink = screen.getByRole("link", { name: "Download weekly report PDF" });
    expect(reportLink.getAttribute("href")).toBe("/api/reports/weekly/pdf?period=this");
    expect(reportLink.hasAttribute("download")).toBe(true);
    expect(screen.queryByRole("link", { name: "Unsafe backslash link" })).toBeNull();
    expect(screen.queryByRole("link", { name: "External link" })).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Ask Dispatch Assistant"));
    });
  });

  it("shows a recoverable error and retries the same conversation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ message: "Temporarily unavailable" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ message: "There are 12 drivers." }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DispatchAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "How many drivers do we have?" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "I couldn’t complete that request. Please try again.Try again",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("There are 12 drivers.")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(
      JSON.parse(fetchMock.mock.calls[1][1].body as string),
    );
  });

  it.each([
    [400, "invalid_request", "Check the conversation and try again."],
    [401, "unauthorized", "Please sign in to use Dispatch Assistant."],
    [403, "forbidden", "You do not have access to this request."],
    [415, "unsupported_media_type", "Send the request as JSON."],
    [429, "rate_limited", "Please wait before trying another question."],
    [503, "assistant_not_configured", "Dispatch Assistant is not configured yet."],
  ])("does not offer an immediate retry for a %i %s response", async (status, code, message) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      error: { code, message },
    }, { status }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DispatchAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "How many drivers do we have?" }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("offers a new conversation instead of retrying an oversized request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      error: {
        code: "request_too_large",
        message: "That conversation is too large. Start a new chat and try again.",
      },
    }, { status: 413 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DispatchAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "How many drivers do we have?" }));

    expect(await screen.findByText("That conversation is too large. Start a new chat and try again.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Start new conversation" }).length).toBeGreaterThan(0);
  });

  it("caps outbound history without splitting prior turns", async () => {
    const firstAnswer = `First answer ${"A".repeat(10_000)}`;
    const secondAnswer = `Second answer ${"B".repeat(6_000)}`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ message: firstAnswer }))
      .mockResolvedValueOnce(Response.json({ message: secondAnswer }))
      .mockResolvedValueOnce(Response.json({ message: "Third answer" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DispatchAssistant />);

    const ask = async (question: string, answer: string) => {
      fireEvent.change(screen.getByLabelText("Ask Dispatch Assistant"), {
        target: { value: question },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send question" }));
      expect(await screen.findByText(answer)).toBeTruthy();
    };

    await ask("First question", firstAnswer);
    await ask("Second question", secondAnswer);
    await ask("Third question", "Third answer");

    const thirdRequest = JSON.parse(fetchMock.mock.calls[2][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(thirdRequest.messages).toEqual([
      { role: "user", content: "Second question" },
      { role: "assistant", content: secondAnswer },
      { role: "user", content: "Third question" },
    ]);
  });

  it("prompts for a new conversation when the message limit is reached", async () => {
    let responseNumber = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      responseNumber += 1;
      return Promise.resolve(Response.json({ message: `Answer ${responseNumber}` }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DispatchAssistant />);

    for (let index = 1; index <= 10; index += 1) {
      fireEvent.change(screen.getByLabelText("Ask Dispatch Assistant"), {
        target: { value: `Question ${index}` },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send question" }));
      expect(await screen.findByText(`Answer ${index}`)).toBeTruthy();
    }

    expect(screen.getByText(
      "This conversation has reached the beta limit. Start a new conversation to keep asking questions.",
    )).toBeTruthy();
    expect(screen.queryByLabelText("Ask Dispatch Assistant")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Start new conversation" }));
    expect(await screen.findByText("What can I help you find?")).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Ask Dispatch Assistant"));
    });
  });
});
