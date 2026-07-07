import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/state";

const createAuthenticatedClient = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn();
const upload = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/authenticated", () => ({ createAuthenticatedClient }));

function supabaseClient() {
  return {
    storage: {
      from: vi.fn(() => ({
        upload,
        remove: vi.fn(),
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(),
    })),
  };
}

describe("uploadDocument", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedClient.mockReset();
    revalidatePath.mockReset();
    redirect.mockReset();
    upload.mockReset();
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
});
