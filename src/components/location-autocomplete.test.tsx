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
  it.each([
    ["pickup_location", "West Valley City, Utah", "West Valley City, Uta"],
    ["delivery_location", "Fontana, California", "Fontana, Californi"],
    ["return_location", "Los Angeles, California", "Los Angeles, Californi"],
  ])("does not search for a prefilled %s until the user edits it", async (
    name,
    defaultValue,
    editedValue,
  ) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      locations: [{
        id: "R:287487",
        label: defaultValue,
        fullLabel: `${defaultValue}, United States`,
        type: "city",
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <LocationAutocomplete
        name={name}
        defaultValue={defaultValue}
      />,
    );

    const input = screen.getByPlaceholderText("Start typing a city or address");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(input).toHaveProperty("value", defaultValue);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();

    fireEvent.change(input, { target: { value: editedValue } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: new RegExp(defaultValue) })).toBeTruthy();
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
