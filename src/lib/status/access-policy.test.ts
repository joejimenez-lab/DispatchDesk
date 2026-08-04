import { describe, expect, it } from "vitest";
import { isStatusViewerAllowed } from "./access-policy";

describe("status viewer access", () => {
  it("allows a case-insensitive email match", () => {
    expect(isStatusViewerAllowed(
      { id: "user-1", email: "Owner@Example.com" },
      { STATUS_PAGE_ALLOWED_EMAILS: "other@example.com, owner@example.com", STATUS_PAGE_ALLOWED_USER_IDS: "" },
    )).toBe(true);
  });

  it("allows an exact user id match", () => {
    expect(isStatusViewerAllowed(
      { id: "user-1", email: "person@example.com" },
      { STATUS_PAGE_ALLOWED_EMAILS: "", STATUS_PAGE_ALLOWED_USER_IDS: "user-1,user-2" },
    )).toBe(true);
  });

  it("fails closed when the allowlist is empty", () => {
    expect(isStatusViewerAllowed(
      { id: "user-1", email: "person@example.com" },
      { STATUS_PAGE_ALLOWED_EMAILS: "", STATUS_PAGE_ALLOWED_USER_IDS: "" },
    )).toBe(false);
  });
});
