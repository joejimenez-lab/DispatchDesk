import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("security headers", () => {
  it("allows only same-origin framing for receipt previews", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "/(.*)",
        headers: expect.arrayContaining([
          { key: "X-Frame-Options", value: "DENY" },
        ]),
      }),
      {
        source: "/api/bookkeeping/receipts/:id/view",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ]));
  });

  it("prevents caching and indexing of the private status page", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toEqual(expect.arrayContaining([
      {
        source: "/status",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ]));
  });
});
