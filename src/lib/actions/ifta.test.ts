import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/state";

const createAuthenticatedClient = vi.fn();
const revalidatePath = vi.fn();
const logInfo = vi.fn();
const rpc = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/authenticated", () => ({ createAuthenticatedClient }));
vi.mock("@/lib/logger", () => ({ logInfo }));

describe("IFTA draft actions", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedClient.mockReset();
    revalidatePath.mockReset();
    logInfo.mockReset();
    rpc.mockReset();
    createAuthenticatedClient.mockResolvedValue({
      supabase: { rpc },
      user: { id: "user-85" },
    });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("scans only the selected quarter and reports created drafts", async () => {
    rpc.mockResolvedValue({ data: { trip_drafts_created: 2, fuel_drafts_created: 1 }, error: null });
    const { refreshIftaDrafts } = await import("./ifta");
    const result = await refreshIftaDrafts("2026-04-01", "2026-06-30", initialActionState);

    expect(rpc).toHaveBeenCalledWith("refresh_ifta_drafts", { p_start: "2026-04-01", p_end: "2026-06-30" });
    expect(result).toEqual({ status: "success", message: "Created 2 trip drafts and 1 fuel draft." });
    expect(revalidatePath).toHaveBeenCalledWith("/ifta");
  });

  it("sends edited trip mileage through the atomic review function", async () => {
    const { reviewIftaDraft } = await import("./ifta");
    const form = new FormData();
    form.set("review_action", "approve");
    form.set("unit_id", "85000000-0000-4000-8000-000000000010");
    form.set("start_date", "2026-05-01");
    form.set("end_date", "2026-05-02");
    form.set("pickup_city", "Reno, NV");
    form.set("dropoff_city", "Phoenix, AZ");
    form.set("notes", "Reviewed");
    form.append("draft_state_code", "NV");
    form.append("draft_state_miles", "100");
    form.append("draft_state_code", "AZ");
    form.append("draft_state_miles", "200");

    const result = await reviewIftaDraft("draft-85", "trip", initialActionState, form);
    expect(rpc).toHaveBeenCalledWith("review_ifta_draft", expect.objectContaining({
      p_draft_id: "draft-85",
      p_action: "approve",
      p_payload: expect.objectContaining({
        unit_id: "85000000-0000-4000-8000-000000000010",
        state_miles: [{ state: "NV", miles: 100 }, { state: "AZ", miles: 200 }],
      }),
    }));
    expect(result.status).toBe("success");
  });

  it("rejects a draft without requiring missing payload fields", async () => {
    const { reviewIftaDraft } = await import("./ifta");
    const form = new FormData();
    form.set("review_action", "reject");
    form.set("review_note", "No reliable route mileage");

    const result = await reviewIftaDraft("draft-85", "trip", initialActionState, form);
    expect(rpc).toHaveBeenCalledWith("review_ifta_draft", {
      p_draft_id: "draft-85",
      p_action: "reject",
      p_payload: null,
      p_note: "No reliable route mileage",
    });
    expect(result).toEqual({ status: "success", message: "Draft rejected." });
  });
});
