// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LoadFinancialFields } from "./load-financial-fields";

afterEach(cleanup);

describe("LoadFinancialFields", () => {
  it("previews factoring and estimated profit with cent rounding", () => {
    render(
      <LoadFinancialFields
        loadRate={1_250.55}
        driverPay={500}
        dispatcherFee={100}
        fuelCost={50}
        factoringPercent={3}
      />,
    );

    expect(screen.getAllByText("$37.52")).toHaveLength(2);
    expect(screen.getByText("$563.03")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Load Rate (Total)"), { target: { value: "2000" } });

    expect(screen.getAllByText("$60.00")).toHaveLength(2);
    expect(screen.getByText("$1,290.00")).toBeTruthy();
  });

  it("adds, edits, and removes labeled deductions from the preview", () => {
    render(
      <LoadFinancialFields
        loadRate={1_250.55}
        driverPay={500}
        dispatcherFee={100}
        fuelCost={50}
        factoringPercent={3}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Add deduction" }));
    fireEvent.change(screen.getByLabelText("Other deduction description 1"), { target: { value: "Lumper fee" } });
    fireEvent.change(screen.getByLabelText("Other deduction amount 1"), { target: { value: "75" } });

    expect(screen.getByText("$112.52")).toBeTruthy();
    expect(screen.getByText("$488.03")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove deduction 1" }));

    expect(screen.getByText("No other deductions.")).toBeTruthy();
    expect(screen.getByText("$563.03")).toBeTruthy();
  });

  it("keeps saved deduction rows separately identifiable for editing", () => {
    render(<LoadFinancialFields deductions={[{ id: "deduction-1", label: "Scale fee", amount: 24.5 }]} />);

    expect(screen.getByLabelText("Other deduction description 1")).toHaveProperty("value", "Scale fee");
    expect(screen.getByLabelText("Other deduction amount 1")).toHaveProperty("value", "24.5");
  });
});
