import { describe, expect, it } from "vitest";
import {
  documentDownloadHeaders,
  documentViewHeaders,
  maxDocumentUploadBytes,
  validateUploadedDocument,
} from "./document-security";

function file(bytes: number[] | Uint8Array, name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("document upload security", () => {
  it.each([
    [file([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], "rate-confirmation.pdf", "application/pdf"), "application/pdf"],
    [file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "bol.png", "image/png"), "image/png"],
    [file([0xff, 0xd8, 0xff, 0xe0], "receipt.jpg", "image/jpeg"), "image/jpeg"],
    [file([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], "fuel.heic", "image/heic"), "image/heic"],
    [file([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31], "inspection.heif", "image/heif"), "image/heif"],
  ])("allows business-approved document files", async (documentFile, expectedMimeType) => {
    await expect(validateUploadedDocument(documentFile)).resolves.toMatchObject({
      mimeType: expectedMimeType,
    });
  });

  it("rejects oversized files before upload", async () => {
    const bytes = new Uint8Array(maxDocumentUploadBytes + 1);
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    await expect(validateUploadedDocument(
      file(bytes, "large.pdf", "application/pdf"),
    )).rejects.toThrow("Upload PDF, PNG, JPEG, HEIC, or HEIF files up to 10 MB.");
  });

  it("rejects a spoofed MIME type when the file signature does not match", async () => {
    const htmlPayload = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");

    await expect(validateUploadedDocument(
      file(htmlPayload, "invoice.pdf", "application/pdf"),
    )).rejects.toThrow("Upload PDF, PNG, JPEG, HEIC, or HEIF files up to 10 MB.");
  });

  it.each([
    file(new TextEncoder().encode("<!doctype html><script>alert(1)</script>"), "attack.html", "text/html"),
    file(new TextEncoder().encode("<svg><script>alert(1)</script></svg>"), "attack.svg", "image/svg+xml"),
  ])("rejects active document formats", async (documentFile) => {
    await expect(validateUploadedDocument(documentFile)).rejects.toThrow("Upload PDF, PNG, JPEG, HEIC, or HEIF files up to 10 MB.");
  });
});

describe("document response security", () => {
  it("serves allowed preview types inline with no-sniff and sandbox headers", () => {
    const headers = documentViewHeaders("invoice.pdf", "application/pdf");

    expect(headers["Content-Type"]).toBe("application/pdf");
    expect(headers["Content-Disposition"]).toBe("inline; filename=\"invoice.pdf\"");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toContain("sandbox");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
  });

  it.each([
    ["attack.html", "text/html"],
    ["attack.svg", "image/svg+xml"],
  ])("forces active content to download instead of rendering inline", (name, type) => {
    const headers = documentViewHeaders(name, type);

    expect(headers["Content-Type"]).toBe("application/octet-stream");
    expect(headers["Content-Disposition"]).toBe(`attachment; filename="${name}"`);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toContain("default-src 'none'");
  });

  it("always sends downloads as attachments with inert content type", () => {
    const headers = documentDownloadHeaders("attack.html");

    expect(headers["Content-Type"]).toBe("application/octet-stream");
    expect(headers["Content-Disposition"]).toBe("attachment; filename=\"attack.html\"");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});
