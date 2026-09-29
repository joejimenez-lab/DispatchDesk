// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadForm } from "@/components/load-form";
import { errorState, type ActionState } from "@/lib/actions/state";
import { loadStopsSchema } from "@/lib/validation/schemas";
import { z } from "zod";

afterEach(cleanup);

function validateStops(formData: FormData): ActionState {
  const stops = formData.getAll("stop_type").map((stop_type, index) => ({
    stop_type,
    location: formData.getAll("stop_location")[index],
    scheduled_start: formData.getAll("stop_scheduled_start")[index],
    scheduled_end: formData.getAll("stop_scheduled_end")[index],
    time_zone: formData.getAll("stop_time_zone")[index],
    appointment_number: "", reference_number: "", instructions: "",
  }));
  const result = z.object({ stops: loadStopsSchema }).safeParse({ stops });
  return result.success ? { status: "success", message: "Saved" } : errorState(result.error);
}

describe("load form validation feedback", () => {
  it("identifies missing locations and times, focuses their fields, and preserves the entered load", async () => {
    const action = vi.fn(async (_state: ActionState, data: FormData) => validateStops(data));
    const { container } = render(<LoadForm action={action} drivers={[]} brokers={[]} equipment={[]} />);
    fireEvent.change(screen.getByLabelText("Load Number"), { target: { value: "CLIENT-42" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Keep these notes" } });
    fireEvent.change(screen.getAllByLabelText("Appointment start")[0], { target: { value: "2026-09-28T09:00" } });
    fireEvent.submit(container.querySelector("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Load wasn't saved.");
    expect(alert.textContent).toContain("Stop 1: location: Stop location is required");
    expect(alert.textContent).toContain("Stop 2: location: Stop location is required");
    expect(alert.textContent).toContain("Stop 1: appointment end: Add an appointment end time, or skip times for now");
    await waitFor(() => expect(document.activeElement).toBe(alert));
    fireEvent.click(within(alert).getByRole("button", { name: /Stop 2: location/ }));
    expect(document.activeElement).toBe(container.querySelectorAll('[name="stop_location"]')[1]);
    expect((screen.getByLabelText("Load Number") as HTMLInputElement).value).toBe("CLIENT-42");
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe("Keep these notes");
    expect((screen.getAllByLabelText("Stop type")[1] as HTMLSelectElement).value).toBe("Delivery");

    fireEvent.change(container.querySelectorAll('[name="stop_location"]')[0], { target: { value: "LA" } });
    fireEvent.change(container.querySelectorAll('[name="stop_location"]')[1], { target: { value: "AZ" } });
    fireEvent.click(screen.getByRole("button", { name: "Skip times for now" }));
    expect(screen.getByRole("status").textContent).toContain("Appointment times skipped");
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    const submitted = action.mock.calls[1][1];
    expect(submitted.getAll("stop_scheduled_start")).toEqual(["", ""]);
    expect(submitted.getAll("stop_scheduled_end")).toEqual(["", ""]);
  });

  it("shows a missing delivery stop even when all locations and appointment fields are valid", async () => {
    const { container } = render(<LoadForm action={async (_state, data) => validateStops(data)} drivers={[]} brokers={[]} equipment={[]} />);
    fireEvent.change(screen.getAllByLabelText("Stop type")[1], { target: { value: "Pickup" } });
    container.querySelectorAll('[name="stop_location"]').forEach((field) => fireEvent.change(field, { target: { value: "LA" } }));
    fireEvent.submit(container.querySelector("form")!);
    expect((await screen.findByRole("alert")).textContent).toContain("Choose Delivery as the stop type for at least one stop");
  });

  it("keeps the save button disabled while saving and explains a database failure", async () => {
    let finish!: (state: ActionState) => void;
    const action = vi.fn(() => new Promise<ActionState>((resolve) => { finish = resolve; }));
    const { container } = render(<LoadForm action={action} drivers={[]} brokers={[]} equipment={[]} />);
    fireEvent.submit(container.querySelector("form")!);
    expect((await screen.findByRole("button", { name: "Saving..." }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ status: "error", message: "Could not connect. Try again." }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not connect. Try again.");
    expect((screen.getByRole("button", { name: "Save load" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
