import { describe, expect, it } from "vitest";
import { isLoadClientPaymentPaid, normalizeLoadView } from "./loads";

describe("load list filters", () => {
  it("defaults to operational work while accepting explicit views and statuses", () => {
    expect(normalizeLoadView(undefined)).toBe("active");
    expect(normalizeLoadView("all")).toBe("all");
    expect(normalizeLoadView("Delivered")).toBe("Delivered");
    expect(normalizeLoadView("not-a-status")).toBe("active");
  });

  it("does not classify a void invoice as paid", () => {
    expect(isLoadClientPaymentPaid({
      load_rate: 1_000,
      payments: {
        invoice_status: "Void",
        client_paid: true,
        client_amount_received: 0,
        driver_paid: false,
        dispatcher_paid: false,
      },
    })).toBe(false);
  });
});
