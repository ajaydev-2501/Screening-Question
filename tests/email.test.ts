import { describe, expect, it } from "vitest";

import { InvalidEmailError, normalizeEmail, redactEmail } from "@/lib/email";

describe("normalizeEmail", () => {
  it("lowercases, trims, and keeps the typed address for display", () => {
    const result = normalizeEmail("  Alice@Example.COM  ");
    expect(result.normalized).toBe("alice@example.com");
    expect(result.display).toBe("Alice@Example.COM");
    expect(result.domain).toBe("example.com");
  });

  it("does not fold a provider that does not support folding", () => {
    expect(normalizeEmail("user.name+tag@example.com").normalized).toBe(
      "user.name+tag@example.com",
    );
  });

  it("folds subaddressing for providers known to ignore everything after +", () => {
    expect(normalizeEmail("jane+news@outlook.com").normalized).toBe("jane@outlook.com");
    expect(normalizeEmail("jane.doe+news@icloud.com").normalized).toBe("jane.doe@icloud.com");
    expect(normalizeEmail("jane+1@proton.me").normalized).toBe("jane@proton.me");
  });

  it("folds dots only for the providers that ignore them", () => {
    expect(normalizeEmail("First.Last+Promo@GMail.com").normalized).toBe("firstlast@gmail.com");
    expect(normalizeEmail("a.b+1@googlemail.com").normalized).toBe("ab@googlemail.com");
    expect(normalizeEmail("a.b@protonmail.com").normalized).toBe("ab@protonmail.com");
    expect(normalizeEmail("a.b@proton.me").normalized).toBe("a.b@proton.me");
  });

  it("folds full-width characters before validating, so one mailbox cannot register twice", () => {
    expect(normalizeEmail("Ａlice@Ｅxample.com").normalized).toBe("alice@example.com");
  });

  it("strips a trailing dot from the domain", () => {
    expect(normalizeEmail("a@example.com.").normalized).toBe("a@example.com");
  });

  it("rejects empty, spaced, and structurally broken addresses", () => {
    const cases: [string, RegExp][] = [
      ["   ", /Enter your email address/],
      ["a b@example.com", /cannot contain spaces/],
      ["no-at-sign", /complete email address/],
      ["@example.com", /complete email address/],
      ["alice@", /complete email address/],
      ["a@b@example.com", /characters we cannot accept/],
      ["a@localhost", /complete email address/],
      ["a@host.1", /complete email address/],
      ["a@example..com", /complete email address/],
      ["a@-bad.com", /complete email address/],
      ["a@bad-.com", /complete email address/],
    ];
    for (const [input, message] of cases) {
      expect(() => normalizeEmail(input), input).toThrow(message);
    }
  });

  it("rejects dotted local parts that are not legal addresses", () => {
    expect(() => normalizeEmail(".a@example.com")).toThrow(InvalidEmailError);
    expect(() => normalizeEmail("a.@example.com")).toThrow(InvalidEmailError);
    expect(() => normalizeEmail("a..b@example.com")).toThrow(InvalidEmailError);
  });

  it("rejects a local part beyond RFC 5321's 64 characters", () => {
    expect(() => normalizeEmail(`${"a".repeat(65)}@example.com`)).toThrow(/not valid/);
    expect(normalizeEmail(`${"a".repeat(64)}@example.com`).normalized).toBe(
      `${"a".repeat(64)}@example.com`,
    );
  });

  it("rejects an address longer than the RFC 5322 ceiling before normalization", () => {
    expect(() => normalizeEmail(`a@${"b".repeat(252)}.com`)).toThrow(/too long/);
  });

  it("rejects a plus-only local part that folds to nothing", () => {
    expect(() => normalizeEmail("+tag@gmail.com")).toThrow(InvalidEmailError);
  });
});

describe("redactEmail", () => {
  it("keeps the first character and the domain only", () => {
    expect(redactEmail("alice@example.com")).toBe("a***@example.com");
  });

  it("falls back to a placeholder when there is nothing safe to keep", () => {
    expect(redactEmail("not-an-email")).toBe("[redacted]");
    expect(redactEmail("@example.com")).toBe("[redacted]");
  });
});
