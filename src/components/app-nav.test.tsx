// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppNav } from "./app-nav";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/versions",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));

describe("AppNav", () => {
  it("links the visible current version to the version history", () => {
    render(<AppNav />);

    const versionLink = screen.getByRole("link", { name: "View version history, current version v2.8.1" });
    expect(versionLink.getAttribute("href")).toBe("/versions");
    expect(versionLink.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("v2.8.1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dispatch" }).getAttribute("href")).toBe("/dispatch");
  });
});
