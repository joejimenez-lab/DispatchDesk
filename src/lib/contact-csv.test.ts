import { describe, expect, it } from "vitest";
import { parseContactCsv, parseCsv } from "@/lib/contact-csv";

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes, and Windows newlines", () => {
    expect(parseCsv('company,notes\r\n"Acme, LLC","Said ""hello"""\r\n')).toEqual([
      ["company", "notes"],
      ["Acme, LLC", 'Said "hello"'],
    ]);
  });
});

describe("parseContactCsv", () => {
  it("maps documented broker aliases and retains valid rows beside errors", () => {
    const rows = parseContactCsv("broker", "Broker,Primary Contact,Email Address,Telephone\nAcme,Sam,sam@example.com,555-0100\n,,invalid,");
    expect(rows[0]).toEqual({
      rowNumber: 2,
      values: { company_name: "Acme", contact_name: "Sam", email: "sam@example.com", phone: "555-0100", notes: null },
      errors: [],
    });
    expect(rows[1].errors).toEqual(["Company name is required", "Email is not valid"]);
  });

  it("maps driver equipment columns", () => {
    expect(parseContactCsv("driver", "Driver Name,Default Truck,Default Trailer\nA Driver,101,5001")[0].values).toMatchObject({
      name: "A Driver",
      truck_number: "101",
      trailer_number: "5001",
    });
  });
});
