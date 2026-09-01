import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/state";

const rpc = vi.fn();
const createAuthenticatedClient = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/authenticated", () => ({ createAuthenticatedClient }));

describe("collection actions", () => {
  beforeEach(() => {
    rpc.mockReset();
    revalidatePath.mockReset();
    createAuthenticatedClient.mockResolvedValue({ supabase: { rpc } });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("updates invoice terms through the tenant-safe mutation", async () => {
    const { updateInvoiceCollection } = await import("./collections");
    const form = new FormData();
    form.set("invoice_status", "Sent");
    form.set("invoice_number", "INV-100");
    form.set("invoice_date", "2026-08-01");
    form.set("payment_terms_days", "30");
    form.set("due_date", "");
    form.set("collection_owner_id", "");
    form.set("next_follow_up_date", "2026-09-01");
    const result = await updateInvoiceCollection("00000000-0000-4000-8000-000000000001", initialActionState, form);
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("update_invoice_collection", expect.objectContaining({
      p_invoice_status: "Sent", p_invoice_number: "INV-100", p_invoice_date: "2026-08-01", p_payment_terms_days: 30, p_due_date: null,
    }));
  });

  it("records an auditable partial payment", async () => {
    const { addReceivableEntry } = await import("./collections");
    const form = new FormData();
    form.set("entry_type", "Payment");
    form.set("amount", "425.50");
    form.set("entry_date", "2026-08-31");
    form.set("note", "ACH 123");
    const result = await addReceivableEntry("00000000-0000-4000-8000-000000000001", initialActionState, form);
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("record_receivable_entry", expect.objectContaining({ p_entry_type: "Payment", p_amount: 425.5 }));
    expect(revalidatePath).toHaveBeenCalledWith("/collections");
  });

  it("requires a non-zero ledger amount before calling the database", async () => {
    const { addReceivableEntry } = await import("./collections");
    const form = new FormData();
    form.set("entry_type", "Write-off");
    form.set("amount", "0");
    form.set("entry_date", "2026-08-31");
    form.set("note", "Residual");
    const result = await addReceivableEntry("00000000-0000-4000-8000-000000000001", initialActionState, form);
    expect(result.status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
});
