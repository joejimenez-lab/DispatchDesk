import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedRouteClient: vi.fn(),
}));

vi.mock("@/lib/supabase/route-auth", () => ({
  createAuthenticatedRouteClient: mocks.createAuthenticatedRouteClient,
}));

import { GET as downloadDocument } from "./[id]/download/route";
import { GET as viewDocument } from "./[id]/view/route";

type RouteHandler = typeof viewDocument;

async function request(handler: RouteHandler, id = "document-1") {
  const response = await handler(
    new Request(`http://localhost/api/documents/${id}/view`),
    { params: Promise.resolve({ id }) },
  );

  if (!response) throw new Error("Document route did not return a response.");
  return response;
}

function authenticatedClient({
  document = { file_name: "rate-confirmation.pdf", storage_path: "load-1/document-1.pdf" },
  queryError = null,
  downloadData = new Blob(["%PDF-1.7"], { type: "application/pdf" }),
  downloadError = null,
}: {
  document?: { file_name: string; storage_path: string } | null;
  queryError?: { message: string } | null;
  downloadData?: Blob;
  downloadError?: { message: string } | null;
} = {}) {
  const single = vi.fn(async () => ({ data: document, error: queryError }));
  const download = vi.fn(async () => ({ data: downloadData, error: downloadError }));
  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({ download })),
    },
  };

  return { supabase, single, download };
}

describe.each([
  ["view", viewDocument],
  ["download", downloadDocument],
] as const)("document %s route", (kind, handler) => {
  beforeEach(() => {
    mocks.createAuthenticatedRouteClient.mockReset();
  });

  it("returns the authentication response before querying document data", async () => {
    mocks.createAuthenticatedRouteClient.mockResolvedValue({
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await request(handler);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns a 404 when the document record is unavailable", async () => {
    const local = authenticatedClient({ document: null, queryError: { message: "missing" } });
    mocks.createAuthenticatedRouteClient.mockResolvedValue({ supabase: local.supabase });

    const response = await request(handler, "missing-document");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Document not found" });
    expect(local.download).not.toHaveBeenCalled();
  });

  it("returns a 500 without file contents when private storage fails", async () => {
    const local = authenticatedClient({ downloadError: { message: "Storage unavailable" } });
    mocks.createAuthenticatedRouteClient.mockResolvedValue({ supabase: local.supabase });

    const response = await request(handler);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Storage unavailable" });
  });

  it(`serves an authenticated ${kind} response with safe headers`, async () => {
    const local = authenticatedClient();
    mocks.createAuthenticatedRouteClient.mockResolvedValue({ supabase: local.supabase });

    const response = await request(handler);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    if (kind === "view") {
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("content-disposition")).toBe('inline; filename="rate-confirmation.pdf"');
      expect(response.headers.get("content-security-policy")).toContain("sandbox");
    } else {
      expect(response.headers.get("content-type")).toBe("application/octet-stream");
      expect(response.headers.get("content-disposition")).toBe('attachment; filename="rate-confirmation.pdf"');
    }
    expect((await response.arrayBuffer()).byteLength).toBe(8);
  });
});
