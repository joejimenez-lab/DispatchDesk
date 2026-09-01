// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadStatusSelect } from "./load-status-select";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/loads", () => ({ updateLoadStatus: vi.fn() }));

afterEach(cleanup);

describe("LoadStatusSelect", () => {
  it("prevents operational changes until a closed load is reopened", () => {
    render(<LoadStatusSelect loadId="load-1" status="Delivered" closeoutStatus="Closed" />);

    const select = screen.getByRole("combobox", { name: "Update load status" });
    expect((select as HTMLSelectElement).disabled).toBe(true);
    expect(select.getAttribute("title")).toContain("Reopen");
  });

  it("keeps non-closed operational statuses editable", () => {
    render(<LoadStatusSelect loadId="load-1" status="Delivered" closeoutStatus="Paid" />);
    expect((screen.getByRole("combobox", { name: "Update load status" }) as HTMLSelectElement).disabled).toBe(false);
  });
});
