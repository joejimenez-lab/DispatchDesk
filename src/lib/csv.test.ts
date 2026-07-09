import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "./csv";

describe("csv serializer", () => {
  it("preserves ordinary text and scalar values", () => {
    expect(csvCell("Plain load")).toBe("Plain load");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(-42)).toBe("-42");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(false)).toBe("false");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("escapes delimiters, quotes, and newlines", () => {
    expect(csvCell("Los Angeles, CA")).toBe("\"Los Angeles, CA\"");
    expect(csvCell("Broker \"A\"")).toBe("\"Broker \"\"A\"\"\"");
    expect(csvCell("Pickup\nDelivery")).toBe("\"Pickup\nDelivery\"");
    expect(csvRow(["L1", "Broker, Inc.", "Ready"])).toBe("L1,\"Broker, Inc.\",Ready");
  });

  it.each(["=SUM(A1:A2)", "+CMD", "-CMD", "@HYPERLINK"])(
    "neutralizes formula-like strings beginning with %s",
    (value) => {
      expect(csvCell(value)).toBe(`'${value}`);
    },
  );

  it.each([" =SUM(A1:A2)", "\t=SUM(A1:A2)", "\r\n+CMD", "\u0000@HYPERLINK"])(
    "neutralizes formula-like strings after leading whitespace or control characters",
    (value) => {
      const safe = `'${value}`;
      const expected = /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
      expect(csvCell(value)).toBe(expected);
    },
  );
});
