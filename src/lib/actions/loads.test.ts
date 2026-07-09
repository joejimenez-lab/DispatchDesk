import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/state";

const createAuthenticatedClient = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn();
const logError = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
const rpc = vi.fn();
const cleanupDeleteIn = vi.fn();
const cleanupUpdateIn = vi.fn();
const cleanupInsert = vi.fn();
const documentInsert = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/authenticated", () => ({ createAuthenticatedClient }));
vi.mock("@/lib/logger", () => ({ logError }));

function supabaseClient() {
  return {
    rpc,
    storage: {
      from: vi.fn(() => ({
        upload,
        remove,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "storage_cleanup_jobs") {
        return {
          insert: cleanupInsert,
          update: vi.fn(() => ({ in: cleanupUpdateIn })),
          delete: vi.fn(() => ({ in: cleanupDeleteIn })),
        };
      }

      return {
        insert: documentInsert,
      };
    }),
  };
}

function loadFormData() {
  const formData = new FormData();
  formData.set("load_number", "L-100");
  formData.set("broker_id", "");
  formData.set("carrier_company", "Carrier");
  formData.set("driver_id", "");
  formData.set("pickup_location", "Los Angeles, CA");
  formData.set("pickup_date", "");
  formData.set("delivery_location", "Phoenix, AZ");
  formData.set("delivery_date", "");
  formData.set("return_location", "");
  formData.set("round_trip_details", "");
  formData.set("load_rate", "1000");
  formData.set("driver_pay", "500");
  formData.set("dispatcher_fee", "100");
  formData.set("fuel_cost", "50");
  formData.set("notes", "");
  formData.set("status", "Booked");
  formData.set("invoice_sent_date", "");
  formData.set("client_amount_received", "0");
  formData.set("client_date_received", "");
  formData.set("driver_amount_paid", "0");
  formData.set("driver_date_paid", "");
  formData.set("dispatcher_fee_amount", "100");
  formData.set("dispatcher_date_paid", "");
  return formData;
}

describe("load and document actions", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedClient.mockReset();
    revalidatePath.mockReset();
    redirect.mockReset();
    logError.mockReset();
    upload.mockReset();
    remove.mockReset();
    rpc.mockReset();
    cleanupDeleteIn.mockReset();
    cleanupUpdateIn.mockReset();
    cleanupInsert.mockReset();
    documentInsert.mockReset();
  });

  it("rejects spoofed active content before writing to storage", async () => {
    createAuthenticatedClient.mockResolvedValue({ supabase: supabaseClient() });
    const { uploadDocument } = await import("./loads");
    const formData = new FormData();
    formData.set("load_id", "00000000-0000-4000-8000-000000000000");
    formData.set("category", "BOL");
    formData.set("notes", "");
    formData.set(
      "file",
      new File([new TextEncoder().encode("<!doctype html><script>alert(1)</script>")], "bol.pdf", {
        type: "application/pdf",
      }),
    );

    const result = await uploadDocument(initialActionState, formData);

    expect(result).toEqual({
      status: "error",
      message: "Upload PDF, PNG, JPEG, HEIC, or HEIF files up to 10 MB.",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("updates load, payment, and activity through one RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    createAuthenticatedClient.mockResolvedValue({ supabase: supabaseClient() });
    const { updateLoad } = await import("./loads");

    await updateLoad("load-1", initialActionState, loadFormData());

    expect(rpc).toHaveBeenCalledWith("update_load_with_payment", {
      p_load_id: "load-1",
      p_load: expect.objectContaining({ load_number: "L-100", load_rate: 1000 }),
      p_payment: expect.objectContaining({ dispatcher_fee_amount: 100 }),
    });
    expect(redirect).toHaveBeenCalledWith("/loads/load-1");
  });

  it("returns an error when the atomic load update RPC fails", async () => {
    const error = new Error("payment write failed");
    rpc.mockResolvedValue({ data: null, error });
    createAuthenticatedClient.mockResolvedValue({ supabase: supabaseClient() });
    const { updateLoad } = await import("./loads");

    const result = await updateLoad("load-1", initialActionState, loadFormData());

    expect(result).toEqual({ status: "error", message: "payment write failed" });
    expect(logError).toHaveBeenCalledWith("load.update_failed", error, { loadId: "load-1" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("deletes a document using only server-resolved metadata from the cleanup RPC", async () => {
    rpc.mockResolvedValue({
      data: [{ job_id: "job-1", bucket_id: "load-documents", storage_path: "load-1/bol.pdf", load_id: "load-1" }],
      error: null,
    });
    remove.mockResolvedValue({ data: [], error: null });
    cleanupDeleteIn.mockResolvedValue({ error: null });
    createAuthenticatedClient.mockResolvedValue({ supabase: supabaseClient() });
    const { deleteDocument } = await import("./loads");

    const result = await deleteDocument("document-1", initialActionState);

    expect(result).toEqual({ status: "success", message: "Document deleted." });
    expect(rpc).toHaveBeenCalledWith("delete_document_with_cleanup", { p_document_id: "document-1" });
    expect(remove).toHaveBeenCalledWith(["load-1/bol.pdf"]);
    expect(cleanupDeleteIn).toHaveBeenCalledWith("id", ["job-1"]);
    expect(revalidatePath).toHaveBeenCalledWith("/loads/load-1");
  });

  it("leaves document cleanup queued and logs when Storage deletion fails", async () => {
    const error = new Error("storage unavailable");
    rpc.mockResolvedValue({
      data: [{ job_id: "job-1", bucket_id: "load-documents", storage_path: "load-1/bol.pdf", load_id: "load-1" }],
      error: null,
    });
    remove.mockResolvedValue({ data: null, error });
    cleanupUpdateIn.mockResolvedValue({ error: null });
    createAuthenticatedClient.mockResolvedValue({ supabase: supabaseClient() });
    const { deleteDocument } = await import("./loads");

    const result = await deleteDocument("document-1", initialActionState);

    expect(result).toEqual({ status: "error", message: "storage unavailable" });
    expect(logError).toHaveBeenCalledWith("storage_cleanup.remove_failed", error, {
      operation: "deleteDocument",
      documentId: "document-1",
      loadId: "load-1",
      bucketId: "load-documents",
      paths: ["load-1/bol.pdf"],
    });
    expect(cleanupUpdateIn).toHaveBeenCalledWith("id", ["job-1"]);
    expect(cleanupDeleteIn).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalledWith("/loads/load-1");
  });

  it("returns an error when deleting a load cannot clear completed cleanup jobs", async () => {
    const error = new Error("queue clear failed");
    rpc.mockResolvedValue({
      data: [{ job_id: "job-2", bucket_id: "load-documents", storage_path: "load-1/invoice.pdf", load_id: "load-1" }],
      error: null,
    });
    remove.mockResolvedValue({ data: [], error: null });
    cleanupDeleteIn.mockResolvedValue({ error });
    createAuthenticatedClient.mockResolvedValue({ supabase: supabaseClient() });
    const { deleteLoad } = await import("./loads");

    const result = await deleteLoad("load-1", initialActionState);

    expect(result).toEqual({ status: "error", message: "queue clear failed" });
    expect(remove).toHaveBeenCalledWith(["load-1/invoice.pdf"]);
    expect(logError).toHaveBeenCalledWith("storage_cleanup.clear_failed", error, {
      operation: "deleteLoad",
      loadId: "load-1",
      jobIds: ["job-2"],
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not remove Storage objects when the load delete RPC fails", async () => {
    const error = new Error("database unavailable");
    rpc.mockResolvedValue({ data: null, error });
    createAuthenticatedClient.mockResolvedValue({ supabase: supabaseClient() });
    const { deleteLoad } = await import("./loads");

    const result = await deleteLoad("load-1", initialActionState);

    expect(result).toEqual({ status: "error", message: "database unavailable" });
    expect(logError).toHaveBeenCalledWith("load.delete_failed", error, { loadId: "load-1" });
    expect(remove).not.toHaveBeenCalled();
  });
});
