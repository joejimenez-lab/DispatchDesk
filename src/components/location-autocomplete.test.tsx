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
  it("does not search for a prefilled location until the user edits it", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      locations: [{
        id: "R:287487",
        label: "West Valley City, Utah",
        fullLabel: "West Valley City, Utah, United States",
        type: "city",
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <LocationAutocomplete
        name="pickup_location"
        defaultValue="West Valley City, Utah"
      />,
    );

    const input = screen.getByPlaceholderText("Start typing a city or address");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(input).toHaveProperty("value", "West Valley City, Utah");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /West Valley City, Utah/ })).toBeNull();

    fireEvent.change(input, { target: { value: "West Valley City, Uta" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /West Valley City, Utah/ })).toBeTruthy();
  });

  it("keeps suggestions closed after a location is selected", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() => Response.json({
      locations: [{
        id: "R:207359",
        label: "Los Angeles, California",
        fullLabel: "Los Angeles, California, United States",
        type: "city",
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LocationAutocomplete name="pickup_location" />);

    const input = screen.getByPlaceholderText("Start typing a city or address");
    fireEvent.change(input, { target: { value: "Los Ange" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    fireEvent.click(screen.getByRole("button", { name: /Los Angeles, California/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(input).toHaveProperty("value", "Los Angeles, California");
    expect(screen.queryByRole("button", { name: /Los Angeles, California/ })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "Los Angeles C" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: /Los Angeles, California/ })).toBeTruthy();
  });

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
