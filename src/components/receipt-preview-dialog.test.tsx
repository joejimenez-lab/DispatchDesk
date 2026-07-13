// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ReceiptPreviewDialog } from "./receipt-preview-dialog";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

afterEach(cleanup);

describe("ReceiptPreviewDialog", () => {
  it("opens an image in place and restores focus after X or Escape closes it", () => {
    render(
      <ReceiptPreviewDialog fileName="receipt.heic" viewHref="/api/bookkeeping/receipts/receipt-id/view" />,
    );

    const trigger = screen.getByRole("button", { name: "View" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "receipt.heic" });
    expect(dialog).toHaveProperty("open", true);
    expect(screen.getByRole("img", { name: "Receipt preview for receipt.heic" }).getAttribute("src")).toBe(
      "/api/bookkeeping/receipts/receipt-id/view",
    );
    expect(screen.getByRole("link", { name: "Open receipt in new tab" }).getAttribute("target")).toBe("_blank");
    const closeButton = screen.getByRole("button", { name: "Close receipt preview" });
    expect(closeButton).toBe(document.activeElement);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toBe(document.activeElement);

    fireEvent.click(trigger);
    const reopenedDialog = screen.getByRole("dialog", { name: "receipt.heic" });
    fireEvent(reopenedDialog, new Event("cancel", { bubbles: false, cancelable: true }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });

  it("renders PDF receipts in the modal", () => {
    render(<ReceiptPreviewDialog fileName="receipt.pdf" viewHref="/receipt.pdf" />);

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(screen.getByTitle("Receipt preview for receipt.pdf").getAttribute("src")).toBe("/receipt.pdf");
  });
});
