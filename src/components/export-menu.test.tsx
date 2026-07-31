// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExportMenu } from "./export-menu";

afterEach(cleanup);

describe("ExportMenu", () => {
  it("lets the user choose a report and a specific export variant before downloading", () => {
    render(
      <ExportMenu
        heading="Bookkeeping export"
        description="Every export uses the filters on this page."
        filters={[
          {
            key: "category",
            label: "Expense category",
            allLabel: "All expense categories",
            defaultValue: "Fuel",
            options: [
              { label: "Fuel", value: "Fuel" },
              { label: "Maintenance", value: "Maintenance" },
            ],
          },
          {
            key: "fleet",
            label: "Fleet",
            allLabel: "All fleets",
            options: [{ label: "West Fleet", value: "West Fleet" }],
          },
        ]}
        items={[{
          title: "Expenses",
          description: "Choose category totals for review or line-level records for accounting and receipt matching.",
          formats: [
            { label: "Summary CSV", href: "/summary.csv", type: "csv" },
            { label: "Detailed CSV", href: "/detailed.csv", type: "csv" },
            { label: "Summary PDF", href: "/summary.pdf", type: "pdf" },
            { label: "Detailed PDF", description: "Every expense and receipt reference.", href: "/detailed.pdf", type: "pdf" },
          ],
        }, {
          title: "Receipt register",
          description: "Receipt filenames and transaction links.",
          formats: [{ label: "CSV", href: "/receipts.csv", type: "csv" }],
        }]}
      />,
    );

    expect(screen.getByRole("combobox", { name: "1. Choose report" })).toHaveProperty("value", "0");
    expect(screen.getByRole("radio", { name: /Summary CSV/ })).toHaveProperty("checked", true);
    expect(screen.getByRole("link", { name: "Download Summary CSV" }).getAttribute("href")).toBe("/summary.csv?category=Fuel");

    fireEvent.click(screen.getByRole("radio", { name: /Detailed PDF/ }));
    expect(screen.getByText("Every expense and receipt reference.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download Detailed PDF" }).getAttribute("href")).toBe("/detailed.pdf?category=Fuel");

    fireEvent.change(screen.getByRole("combobox", { name: "Expense category" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Fleet" }), { target: { value: "West Fleet" } });
    expect(screen.getByRole("link", { name: "Download Detailed PDF" }).getAttribute("href")).toBe("/detailed.pdf?fleet=West+Fleet");

    fireEvent.change(screen.getByRole("combobox", { name: "1. Choose report" }), { target: { value: "1" } });
    expect(screen.getByText("Receipt filenames and transaction links.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download CSV" }).getAttribute("href")).toBe("/receipts.csv?fleet=West+Fleet");
  });
});
