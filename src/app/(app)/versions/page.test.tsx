import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VersionsPage from "./page";

describe("VersionsPage", () => {
  it("renders release generations and versions newest first", () => {
    const html = renderToStaticMarkup(<VersionsPage />);

    expect(html.indexOf("Version 2.x")).toBeLessThan(html.indexOf("Version 1.x"));
    expect(html.indexOf("Version 1.x")).toBeLessThan(html.indexOf("Version 0.x"));
    expect(html.indexOf("v2.12.1")).toBeLessThan(html.indexOf("v2.12.0"));
  });
});
