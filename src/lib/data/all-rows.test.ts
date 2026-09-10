import { describe, expect, it, vi } from "vitest";
import { readAllRows } from "./all-rows";
describe("complete accounting reads", () => {
  it("includes rows past the API limit and stops after the last page", async () => {
    const query = { range: vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }).mockResolvedValueOnce({ data: [{ id: 1000 }], error: null }) };
    const result = await readAllRows(query);
    expect(result.data).toHaveLength(1001);
    expect(query.range).toHaveBeenLastCalledWith(1000, 1999);
  });
  it("rejects failed pages rather than returning partial financial totals", async () => {
    const error = new Error("Database unavailable");
    await expect(readAllRows({ range: vi.fn().mockResolvedValue({ data: null, error }) })).rejects.toBe(error);
  });
});
