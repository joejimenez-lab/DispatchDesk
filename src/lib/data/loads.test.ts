import { describe, expect, it } from "vitest";
import { normalizeLoadView } from "./loads";
import { loadSearchExpression } from "@/lib/load-search";

describe("load list filters", () => {
  it("defaults to operational work while accepting explicit views and statuses", () => {
    expect(normalizeLoadView(undefined)).toBe("active");
    expect(normalizeLoadView("all")).toBe("all");
    expect(normalizeLoadView("Delivered")).toBe("Delivered");
    expect(normalizeLoadView("not-a-status")).toBe("active");
  });

  it("searches load, equipment, shipment, stop, broker, and driver matches together", () => {
    const expression = loadSearchExpression("Dallas", {
      stopLoadIds: ["load-stop"],
      brokerIds: ["broker-match"],
      driverIds: ["driver-match"],
    });

    expect(expression).toContain("load_number.ilike.%Dallas%");
    expect(expression).toContain("truck_number.ilike.%Dallas%");
    expect(expression).toContain("trailer_number.ilike.%Dallas%");
    expect(expression).toContain("id.in.(load-stop)");
    expect(expression).toContain("broker_id.in.(broker-match)");
    expect(expression).toContain("driver_id.in.(driver-match)");
  });
});
