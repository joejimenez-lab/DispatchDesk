import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/state";

const createAuthenticatedClient = vi.fn();
const revalidatePath = vi.fn();
const rpc = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/authenticated", () => ({ createAuthenticatedClient }));

const firstBroker = {
  id: "00000000-0000-4000-8000-000000000001",
  organization_id: "00000000-0000-4000-8000-000000000100",
  company_name: "Acme Logistics",
  contact_name: "Alex",
  phone: "555-0100",
  email: "legacy email",
  notes: "First note",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};
const secondBroker = {
  ...firstBroker,
  id: "00000000-0000-4000-8000-000000000002",
  company_name: "Acme Logistic",
  contact_name: "Sam",
  email: null,
  notes: "Second note",
};

function mergeClient(records = [firstBroker, secondBroker]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ in: vi.fn(async () => ({ data: records, error: null })) })),
    })),
    rpc,
  };
}

describe("contact merge actions", () => {
  beforeEach(() => {
    createAuthenticatedClient.mockReset();
    revalidatePath.mockReset();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: {}, error: null });
  });

  it("requires explicit broker field choices and sends one atomic merge request", async () => {
    createAuthenticatedClient.mockResolvedValue({ supabase: mergeClient() });
    const { mergeBrokers } = await import("./brokers");
    const formData = new FormData();
    formData.set("survivor_id", firstBroker.id);
    formData.set("company_name_choice", "first");
    formData.set("contact_name_choice", "second");
    formData.set("phone_choice", "first");
    formData.set("email_choice", "first");
    formData.set("notes_choice", "combine");

    const result = await mergeBrokers(firstBroker.id, secondBroker.id, initialActionState, formData);

    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("merge_broker_records", {
      p_survivor_id: firstBroker.id,
      p_duplicate_id: secondBroker.id,
      p_values: expect.objectContaining({ contact_name: "Sam", email: "legacy email", notes: "First note\n\nSecond note" }),
    });
  });

  it("refuses a merge when RLS does not return both records", async () => {
    createAuthenticatedClient.mockResolvedValue({ supabase: mergeClient([firstBroker]) });
    const { mergeBrokers } = await import("./brokers");
    const formData = new FormData();
    formData.set("survivor_id", firstBroker.id);

    const result = await mergeBrokers(firstBroker.id, secondBroker.id, initialActionState, formData);

    expect(result).toMatchObject({ status: "error", message: "Both broker records must be available in this workspace." });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("contact CSV import action", () => {
  beforeEach(() => {
    createAuthenticatedClient.mockReset();
    revalidatePath.mockReset();
  });

  it("keeps valid rows when another row fails server-side validation", async () => {
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { ...firstBroker, id: "created", company_name: "New Co" }, error: null })) })) }));
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ order: vi.fn(async () => ({ data: [], error: null })) })),
        insert,
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      })),
    };
    createAuthenticatedClient.mockResolvedValue({ supabase });
    const { importContacts } = await import("@/lib/contact-import-server");
    const formData = new FormData();
    formData.set("rows_json", JSON.stringify([
      { rowNumber: 2, values: { company_name: "New Co", contact_name: null, phone: null, email: "new@example.com", notes: null }, decision: "create", matchId: null },
      { rowNumber: 3, values: { company_name: "Bad Email", contact_name: null, phone: null, email: "not valid", notes: null }, decision: "create", matchId: null },
      { rowNumber: 4, values: { company_name: "Skipped", contact_name: null, phone: null, email: null, notes: null }, decision: "skip", matchId: null },
    ]));

    const result = await importContacts("broker", formData);

    expect(result.summary).toEqual({ created: 1, updated: 0, skipped: 1, failed: 1 });
    expect(result.rowErrors).toEqual([{ rowNumber: 3, message: "Enter a valid email address" }]);
    expect(insert).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/brokers");
  });

  it("can update an earlier created row when the CSV itself contains a match", async () => {
    const updateEq = vi.fn(async () => ({ error: null }));
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { ...firstBroker, id: "00000000-0000-4000-8000-000000000099", company_name: "New Co" }, error: null })) })) }));
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ order: vi.fn(async () => ({ data: [], error: null })) })),
        insert,
        update: vi.fn(() => ({ eq: updateEq })),
      })),
    };
    createAuthenticatedClient.mockResolvedValue({ supabase });
    const { importContacts } = await import("@/lib/contact-import-server");
    const formData = new FormData();
    formData.set("rows_json", JSON.stringify([
      { rowNumber: 2, values: { company_name: "New Co", contact_name: null, phone: "555-0100", email: null, notes: null }, decision: "create", matchId: null },
      { rowNumber: 3, values: { company_name: "New Company", contact_name: "Final Contact", phone: "555-0100", email: null, notes: null }, decision: "update", matchId: "__csv_2" },
    ]));

    const result = await importContacts("broker", formData);

    expect(result.summary).toEqual({ created: 1, updated: 1, skipped: 0, failed: 0 });
    expect(updateEq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000099");
  });
});
