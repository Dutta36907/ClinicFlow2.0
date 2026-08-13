import { describe, it, expect } from "vitest";
import { maskPhone, maskEmail } from "./mask";

describe("maskPhone", () => {
  it("masks a plain 10-digit number", () => {
    expect(maskPhone("9876543210")).toBe("XXXXX43210");
  });
  it("strips a 91 country-code prefix (12 digits)", () => {
    expect(maskPhone("919876543210")).toBe("XXXXX43210");
  });
  it("strips a +91 country-code prefix", () => {
    expect(maskPhone("+919876543210")).toBe("XXXXX43210");
  });
  it("handles spaces and dashes", () => {
    expect(maskPhone("+91 98765-43210")).toBe("XXXXX43210");
  });
  it("returns fallback for undefined", () => {
    expect(maskPhone(undefined)).toBe("XXXXXXXXXX");
  });
  it("returns fallback for null", () => {
    expect(maskPhone(null)).toBe("XXXXXXXXXX");
  });
  it("returns fallback for empty string", () => {
    expect(maskPhone("")).toBe("XXXXXXXXXX");
  });
  it("returns fallback for numbers shorter than 5 digits", () => {
    expect(maskPhone("1234")).toBe("XXXXXXXXXX");
  });
});

describe("maskEmail", () => {
  it("masks a normal email", () => {
    expect(maskEmail("priya@gmail.com")).toBe("pr***@gmail.com");
  });
  it("masks a single-char local part", () => {
    expect(maskEmail("a@gmail.com")).toBe("a****@gmail.com");
  });
  it("returns fallback for undefined", () => {
    expect(maskEmail(undefined)).toBe("***@***.***");
  });
  it("returns fallback for empty string", () => {
    expect(maskEmail("")).toBe("***@***.***");
  });
  it("returns fallback when @ is missing", () => {
    expect(maskEmail("notanemail")).toBe("***@***.***");
  });
});
