// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationAutocomplete } from "./location-autocomplete";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LocationAutocomplete", () => {
  it("keeps manual entry available when autocomplete is not configured", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json(
        { locations: [], message: "Location lookup is not configured." },
        { status: 503 },
      ),
    ));
    render(<LocationAutocomplete name="pickup_location" />);

    const input = screen.getByPlaceholderText("Start typing a city or address");
    fireEvent.change(input, { target: { value: "Los Angeles" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(input).toHaveProperty("value", "Los Angeles");
    expect(screen.getByRole("status").textContent).toBe(
      "Autocomplete is unavailable. Enter the location manually.",
    );
    expect(screen.queryByText("Location lookup is not configured.")).toBeNull();
  });
});
