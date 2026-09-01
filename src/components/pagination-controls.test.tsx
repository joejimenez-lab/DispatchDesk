// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaginationControls } from "./pagination-controls";

afterEach(cleanup);

describe("PaginationControls", () => {
  it("preserves filters in navigation and bounds links", () => {
    render(<PaginationControls basePath="/loads" params={{ q: "Dallas", status: "active" }} pagination={{ page: 2, pageSize: 25 }} total={64} />);

    expect(screen.getByText("Showing 26–50 of 64")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toBe("/loads?q=Dallas&status=active");
    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/loads?q=Dallas&status=active&page=3");
    expect((screen.getByRole("combobox", { name: "Rows" }) as HTMLSelectElement).value).toBe("25");
  });

  it("disables navigation when there are no results", () => {
    render(<PaginationControls basePath="/reports" params={{}} pagination={{ page: 1, pageSize: 25 }} total={0} />);
    expect(screen.getByText("No results")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
  });
});
