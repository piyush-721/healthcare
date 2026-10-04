import { describe, expect, it } from "vitest";

import { safeNext, validateEmail, validateNewPassword } from "./validation";

describe("safeNext", () => {
  it("allows same-site relative paths", () => {
    expect(safeNext("/medications?profile=1")).toBe("/medications?profile=1");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    null,
    "",
  ])("rejects open-redirect target %s", (value) => {
    expect(safeNext(value)).toBe("/dashboard");
  });
});

describe("validateNewPassword", () => {
  it("requires length and matching confirmation", () => {
    expect(validateNewPassword("short", "short").password).toMatch(/at least 10/);
    expect(validateNewPassword("1234567890123").password).toMatch(/numeric/);
    expect(validateNewPassword("Long-enough-pass", "different").confirm).toBe(
      "Passwords don't match.",
    );
    expect(validateNewPassword("Long-enough-pass", "Long-enough-pass")).toEqual({});
  });
});

describe("validateEmail", () => {
  it("validates format", () => {
    expect(validateEmail("")).toBeDefined();
    expect(validateEmail("nope")).toBeDefined();
    expect(validateEmail("a@b.co")).toBeUndefined();
  });
});
