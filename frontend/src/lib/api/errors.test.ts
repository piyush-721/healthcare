import { describe, expect, it } from "vitest";

import { getErrorMessage, getFieldErrors, isForbidden, isNotFound } from "./errors";

const validation = {
  status: 400,
  data: {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request contains invalid data.",
      fields: { email: ["Enter a valid email address."], nested: { a: ["x"] } },
    },
  },
};

describe("API error helpers", () => {
  it("maps field errors from the backend envelope", () => {
    expect(getFieldErrors(validation)).toEqual({
      email: "Enter a valid email address.",
      nested: "Please check this field.",
    });
  });

  it("uses the backend message and falls back safely", () => {
    expect(
      getErrorMessage({
        status: 403,
        data: { error: { code: "SHARE_EXPIRED", message: "Expired." } },
      }),
    ).toBe("Expired.");
    expect(getErrorMessage({ status: "FETCH_ERROR" })).toMatch(/couldn't reach/);
    expect(getErrorMessage(new Error("boom"), "Fallback")).toBe("Fallback");
  });

  it("prefers non-field validation messages", () => {
    const err = {
      status: 400,
      data: {
        error: {
          code: "VALIDATION_ERROR",
          message: "x",
          fields: { non_field_errors: ["Pick one."] },
        },
      },
    };
    expect(getErrorMessage(err)).toBe("Pick one.");
  });

  it("detects status codes", () => {
    expect(isNotFound({ status: 404 })).toBe(true);
    expect(isForbidden({ status: 403 })).toBe(true);
    expect(isForbidden(undefined)).toBe(false);
  });
});
