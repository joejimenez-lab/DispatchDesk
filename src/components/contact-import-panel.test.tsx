// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactImportPanel } from "@/components/contact-import-panel";

describe("ContactImportPanel", () => {
  it("previews validation and duplicate signals without invoking the import action", async () => {
    const action = vi.fn(async () => ({ status: "success" as const, message: "done" }));
    render(
      <ContactImportPanel
        kind="broker"
        existing={[{ id: "a", company_name: "Acme Logistics", contact_name: null, phone: "555-0100", email: null, notes: null }]}
        action={action}
        templateHref="/template.csv"
      />,
    );
    const file = new File(["company_name,phone\nAcme Logistic LLC,(555) 0100\n,555-9999"], "brokers.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => "company_name,phone\nAcme Logistic LLC,555-0100\n,555-9999" });
    fireEvent.change(screen.getByLabelText("CSV file"), { target: { files: [file] } });

    expect(await screen.findByText(/match: Acme Logistics/i)).toBeTruthy();
    expect((screen.getByLabelText("Action for CSV row 2") as HTMLSelectElement).value).toBe("skip");
    expect(screen.getByText("Company name is required")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });
});
