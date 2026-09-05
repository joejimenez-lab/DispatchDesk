import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/state";

const createAuthenticatedClient = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn();
const logError = vi.fn();
const rpc = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/authenticated", () => ({ createAuthenticatedClient }));
vi.mock("@/lib/logger", () => ({ logError }));

function formData(status = "Sent") {
  const data = new FormData();
  data.set("load_id", "00000000-0000-4000-8000-000000000102");
  data.set("invoice_status", status);
  data.set("invoice_number", status === "Sent" ? "INV-102" : "");
  data.set("invoice_date", status === "Sent" ? "2026-09-04" : "");
  data.set("payment_terms_days", "30");
  data.set("due_date", "");
  return data;
}

describe("invoice actions", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedClient.mockReset();
    revalidatePath.mockReset();
    redirect.mockReset();
    logError.mockReset();
    rpc.mockReset();
    createAuthenticatedClient.mockResolvedValue({ supabase: { rpc } });
  });

  it("creates a sent invoice through the focused invoice RPC", async () => {
    rpc.mockResolvedValue({ data: "00000000-0000-4000-8000-000000000102", error: null });
    const { createInvoice } = await import("./invoices");

    await createInvoice(initialActionState, formData());

    expect(rpc).toHaveBeenCalledWith("save_invoice", {
      p_load_id: "00000000-0000-4000-8000-000000000102",
      p_invoice_status: "Sent",
      p_invoice_number: "INV-102",
      p_invoice_date: "2026-09-04",
      p_payment_terms_days: 30,
      p_due_date: null,
    });
    expect(redirect).toHaveBeenCalledWith("/invoices/00000000-0000-4000-8000-000000000102");
  });

  it("permits a draft without a number or date", async () => {
    rpc.mockResolvedValue({ data: "00000000-0000-4000-8000-000000000102", error: null });
    const { createInvoice } = await import("./invoices");

    await createInvoice(initialActionState, formData("Draft"));

    expect(rpc).toHaveBeenCalledWith("save_invoice", expect.objectContaining({
      p_invoice_status: "Draft",
      p_invoice_number: null,
      p_invoice_date: null,
    }));
  });

  it("rejects a sent invoice without its required details before writing", async () => {
    const { createInvoice } = await import("./invoices");
    const data = formData("Draft");
    data.set("invoice_status", "Sent");

    const result = await createInvoice(initialActionState, data);

    expect(result.status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a useful duplicate invoice-number error", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
    const { createInvoice } = await import("./invoices");

    const result = await createInvoice(initialActionState, formData());

    expect(result).toEqual({ status: "error", message: "That invoice number is already in use." });
    expect(logError).toHaveBeenCalled();
  });
});
