import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/state";

const createAuthenticatedClient = vi.fn();
const revalidatePath = vi.fn();
const rpc = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
const cleanupInsert = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/authenticated", () => ({ createAuthenticatedClient }));
vi.mock("@/lib/logger", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

const reminderId = "47000000-0000-4000-8000-000000000010";
const unitId = "47000000-0000-4000-8000-000000000001";

function supabaseClient() {
  const reminderQuery = {
    select: vi.fn(() => reminderQuery),
    eq: vi.fn(() => reminderQuery),
    is: vi.fn(() => reminderQuery),
    single: vi.fn(async () => ({
      data: { interval_days: null, interval_miles: null, fleet_units: { odometer: 101000 } },
      error: null,
    })),
  };
  return {
    rpc,
    storage: {
      from: vi.fn(() => ({ upload, remove })),
    },
    from: vi.fn((table: string) => {
      if (table === "maintenance_reminders") return reminderQuery;
      if (table === "storage_cleanup_jobs") return { insert: cleanupInsert };
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function maintenanceForm(mode: "total" | "breakdown", receipt = false) {
  const formData = new FormData();
  formData.set("completed_date", "2026-07-13");
  formData.set("odometer", "101000");
  formData.set("cost_mode", mode);
  formData.set("total_cost", mode === "total" ? "250" : "0");
  formData.set("labor_cost", mode === "breakdown" ? "180" : "0");
  formData.set("parts_cost", mode === "breakdown" ? "70" : "0");
  formData.set("vendor", "Quality Shop");
  formData.set("notes", "Completed safely");
  if (receipt) {
    formData.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "receipt.pdf", {
      type: "application/pdf",
    }));
  }
  return formData;
}

describe("unified expense actions", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedClient.mockReset();
    revalidatePath.mockReset();
    rpc.mockReset();
    upload.mockReset();
    remove.mockReset();
    cleanupInsert.mockReset();
    upload.mockResolvedValue({ data: {}, error: null });
    remove.mockResolvedValue({ data: [], error: null });
    rpc.mockResolvedValue({ data: { next_reminder_id: null }, error: null });
    createAuthenticatedClient.mockResolvedValue({
      supabase: supabaseClient(),
      user: { id: "user-1", email: "owner@example.com" },
    });
  });

  it("submits total-cost maintenance through one atomic RPC", async () => {
    const { completeMaintenanceReminder } = await import("./maintenance");

    const result = await completeMaintenanceReminder(reminderId, unitId, initialActionState, maintenanceForm("total"));

    expect(result).toEqual({ status: "success", message: "Maintenance completed and spending recorded in Bookkeeping." });
    expect(rpc).toHaveBeenCalledWith("complete_maintenance_with_expense", expect.objectContaining({
      p_reminder_id: reminderId,
      p_group_id: reminderId,
      p_cost_mode: "total",
      p_total_cost: 250,
      p_labor_cost: 0,
      p_parts_cost: 0,
    }));
  });

  it("submits labor, parts, vendor, and one receipt for the whole transaction", async () => {
    const { completeMaintenanceReminder } = await import("./maintenance");

    await completeMaintenanceReminder(reminderId, unitId, initialActionState, maintenanceForm("breakdown", true));

    expect(upload).toHaveBeenCalledWith(
      `${reminderId}/completion-receipt.pdf`,
      expect.any(File),
      { contentType: "application/pdf", upsert: true },
    );
    expect(rpc).toHaveBeenCalledWith("complete_maintenance_with_expense", expect.objectContaining({
      p_cost_mode: "breakdown",
      p_labor_cost: 180,
      p_parts_cost: 70,
      p_vendor: "Quality Shop",
      p_receipt: expect.objectContaining({ storage_path: `${reminderId}/completion-receipt.pdf` }),
    }));
  });

  it("completes zero-cost maintenance without uploading or inventing an expense", async () => {
    const { completeMaintenanceReminder } = await import("./maintenance");
    const formData = maintenanceForm("total");
    formData.set("total_cost", "0");

    const result = await completeMaintenanceReminder(reminderId, unitId, initialActionState, formData);

    expect(result).toEqual({ status: "success", message: "Maintenance completed with no expense." });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("complete_maintenance_with_expense", expect.objectContaining({ p_total_cost: 0, p_receipt: null }));
  });

  it("removes an uploaded receipt when the atomic database write fails", async () => {
    const error = new Error("database unavailable");
    rpc.mockResolvedValue({ data: null, error });
    const { completeMaintenanceReminder } = await import("./maintenance");

    const result = await completeMaintenanceReminder(reminderId, unitId, initialActionState, maintenanceForm("total", true));

    expect(result).toEqual({ status: "error", message: "database unavailable" });
    expect(remove).toHaveBeenCalledWith([`${reminderId}/completion-receipt.pdf`]);
  });

  it("does not touch the database when receipt upload fails", async () => {
    upload.mockResolvedValue({ data: null, error: new Error("storage unavailable") });
    const { completeMaintenanceReminder } = await import("./maintenance");

    const result = await completeMaintenanceReminder(reminderId, unitId, initialActionState, maintenanceForm("total", true));

    expect(result).toEqual({ status: "error", message: "storage unavailable" });
    expect(rpc).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("uses one stable id for an IFTA purchase and its Bookkeeping transaction", async () => {
    const operationId = "47000000-0000-4000-8000-000000000030";
    const formData = new FormData();
    formData.set("operation_id", operationId);
    formData.set("unit_id", unitId);
    formData.set("purchase_date", "2026-07-13");
    formData.set("city", "Reno");
    formData.set("state", "NV");
    formData.set("gallons", "100");
    formData.set("amount_paid", "425");
    formData.set("vendor", "Fuel Stop");
    formData.set("notes", "Card purchase");
    const { addIftaFuelPurchase } = await import("./ifta");

    await addIftaFuelPurchase(initialActionState, formData);

    expect(rpc).toHaveBeenCalledWith("save_ifta_fuel_purchase_with_expense", expect.objectContaining({
      p_purchase_id: operationId,
      p_group_id: operationId,
      p_purchase: expect.objectContaining({ amount_paid: 425, unit_id: unitId }),
    }));
  });
});
