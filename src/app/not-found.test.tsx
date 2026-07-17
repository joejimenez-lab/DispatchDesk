import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("not found page", () => {
  it("renders a branded recovery page for unknown routes", () => {
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).toContain("DispatchDesk");
    expect(html).toContain("Page not found");
    expect(html).toContain("href=\"/dashboard\"");
    expect(html).toContain("href=\"/loads\"");
    expect(html).toContain("href=\"/reports\"");
    expect(html).not.toContain("This page could not be found");
  });
});
