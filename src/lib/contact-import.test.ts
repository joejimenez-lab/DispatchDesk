import { describe, expect, it } from "vitest";
import { buildContactImportPreview } from "@/lib/contact-import";
import { parseContactCsv } from "@/lib/contact-csv";

describe("contact import preview", () => {
  it("detects matches against existing records and earlier rows in the same file", () => {
    const rows = parseContactCsv("broker", "company_name,phone\nExisting Co,555-0100\nNew Co,555-0200\nNew Company LLC,555-0200");
    const preview = buildContactImportPreview("broker", rows, [
      { id: "existing", company_name: "Existing Company", contact_name: null, phone: "555-0100", email: null, notes: null },
    ]);
    expect(preview[0].match).toMatchObject({ id: "existing", source: "existing" });
    expect(preview[1].match).toBeNull();
    expect(preview[2].match).toMatchObject({ id: "__csv_3", source: "file" });
  });
});
