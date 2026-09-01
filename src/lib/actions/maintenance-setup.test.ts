import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/state";

const createAuthenticatedClient = vi.fn();
const rpc = vi.fn();
const revalidatePath = vi.fn();
const logInfo = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/authenticated", () => ({ createAuthenticatedClient }));
vi.mock("@/lib/logger", () => ({ logInfo }));
vi.mock("@/lib/actions/bookkeeping-storage", () => ({
  compensateReceiptUpload: vi.fn(),
  prepareBookkeepingReceipt: vi.fn(),
}));

describe("bulk maintenance setup action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthenticatedClient.mockResolvedValue({
      supabase: { rpc },
      user: { id: "10000000-0000-4000-8000-000000000099" },
    });
    rpc.mockResolvedValue({
      data: { units_selected: 2, odometers_updated: 1, schedules_created: 6 },
      error: null,
    });
  });

  it("sends selected units to the atomic setup function and revalidates maintenance views", async () => {
    const { configureMaintenanceUnits } = await import("./maintenance");
    const first = "10000000-0000-4000-8000-000000000001";
    const second = "10000000-0000-4000-8000-000000000002";
    const form = new FormData();
    form.append("unit_id", first);
    form.append("unit_id", second);
    form.set(`odometer_${first}`, "125000");
    form.set(`odometer_${second}`, "");
    form.set("apply_default_templates", "on");

    const result = await configureMaintenanceUnits(initialActionState, form);

    expect(result).toEqual({ status: "success", message: "Updated 1 odometer and created 6 schedules." });
    expect(rpc).toHaveBeenCalledWith("configure_maintenance_units", {
      p_updates: [{ unit_id: first, odometer: 125000 }, { unit_id: second, odometer: null }],
      p_apply_templates: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith(`/fleet/${first}`);
  });

  it("rejects an empty operation before calling the database", async () => {
    const { configureMaintenanceUnits } = await import("./maintenance");
    const unitId = "10000000-0000-4000-8000-000000000001";
    const form = new FormData();
    form.append("unit_id", unitId);
    form.set(`odometer_${unitId}`, "");
    const result = await configureMaintenanceUnits(initialActionState, form);
    expect(result.status).toBe("error");
    expect(result.message).toContain("Enter an odometer or apply");
    expect(rpc).not.toHaveBeenCalled();
  });
});
