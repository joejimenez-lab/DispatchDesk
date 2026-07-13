// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MaintenanceCostFields } from "./maintenance-cost-fields";

afterEach(cleanup);

describe("MaintenanceCostFields", () => {
  it("switches cleanly between one total and labor plus parts", () => {
    const { container } = render(<MaintenanceCostFields total={250} />);

    expect(screen.getByLabelText("Total cost")).toHaveProperty("value", "250");
    expect(screen.queryByLabelText("Labor")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Labor + parts" }));

    expect(screen.getByLabelText("Labor")).toBeTruthy();
    expect(screen.getByLabelText("Parts")).toBeTruthy();
    expect(container.querySelector('input[name="total_cost"]')).toHaveProperty("value", "0");
  });

  it("keeps vendor and the supported receipt formats available", () => {
    render(<MaintenanceCostFields vendor="Quality Shop" />);

    expect(screen.getByLabelText("Vendor")).toHaveProperty("value", "Quality Shop");
    expect(screen.getByLabelText(/Receipt/).getAttribute("accept")).toContain("application/pdf");
  });
});
