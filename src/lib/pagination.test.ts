import { describe, expect, it } from "vitest";
import { pageHref, pageRange, paginationLabel, parsePagination, totalPages } from "./pagination";

describe("pagination", () => {
  it("normalizes invalid values and only accepts supported page sizes", () => {
    expect(parsePagination({ page: "-4", pageSize: "500" })).toEqual({ page: 1, pageSize: 25 });
    expect(parsePagination({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
    expect(parsePagination({ page: ["2", "9"], pageSize: ["100"] })).toEqual({ page: 2, pageSize: 100 });
  });

  it("creates inclusive database ranges and useful result labels", () => {
    expect(pageRange({ page: 3, pageSize: 25 })).toEqual({ from: 50, to: 74 });
    expect(totalPages(51, 25)).toBe(3);
    expect(totalPages(0, 25)).toBe(1);
    expect(paginationLabel(64, { page: 2, pageSize: 25 })).toBe("Showing 26–50 of 64");
    expect(paginationLabel(0, { page: 1, pageSize: 25 })).toBe("No results");
  });

  it("preserves filters while replacing paging values", () => {
    expect(pageHref("/loads", { q: "Dallas", status: "active", page: "9" }, 2, 50))
      .toBe("/loads?q=Dallas&status=active&page=2&pageSize=50");
    expect(pageHref("/reports", {}, 1, 25)).toBe("/reports");
  });
});
