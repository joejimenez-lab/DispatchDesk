import { describe, expect, it } from "vitest";
import { closeoutReason, isActiveTransportation, summarizeLifecycle } from "./load-lifecycle";

describe("load lifecycle", () => {
  it("counts only transportation work as active", () => {
    const summary = summarizeLifecycle([
      { status: "Booked", post_delivery_status: null },
      { status: "In Transit", post_delivery_status: null },
      { status: "Delivered", post_delivery_status: "Awaiting Documents" },
      { status: "Delivered", post_delivery_status: "Invoiced" },
      { status: "Delivered", post_delivery_status: "Closed" },
      { status: "Cancelled", post_delivery_status: null },
    ]);

    expect(summary).toEqual({
      activeLoads: 2,
      deliveredLoads: 3,
      postDeliveryLoads: 2,
      closedLoads: 1,
      closeoutCounts: {
        "Awaiting Documents": 1,
        "Documents Complete": 0,
        Invoiced: 1,
        Paid: 0,
        Closed: 1,
      },
    });
  });

  it("never treats Delivered or Cancelled as active transportation", () => {
    expect(isActiveTransportation("Delivered")).toBe(false);
    expect(isActiveTransportation("Cancelled")).toBe(false);
    expect(isActiveTransportation("Dispatched")).toBe(true);
  });

  it("explains every post-delivery stage", () => {
    expect(closeoutReason("Awaiting Documents")).toContain("Documents");
    expect(closeoutReason("Documents Complete")).toContain("invoice");
    expect(closeoutReason("Invoiced")).toContain("payments");
    expect(closeoutReason("Paid")).toContain("ready to close");
    expect(closeoutReason("Closed")).toContain("complete");
  });
});
