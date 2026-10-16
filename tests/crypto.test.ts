import { describe, expect, it } from "vitest";

import { generateToken, hashSubject, hashToken, randomId, safeEqual } from "@/lib/crypto";

const HEX_256 = /^[0-9a-f]{64}$/;

describe("session tokens", () => {
  it("generates 256 bits of base64url, never the same value twice", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("stores only a one-way digest of the token, so a leaked table is not a usable session", () => {
    const token = generateToken();
    const digest = hashToken(token);

    expect(digest).toMatch(HEX_256);
    expect(digest).toBe(hashToken(token));
    expect(digest).not.toContain(token);
    expect(hashToken(generateToken())).not.toBe(digest);
  });
});

describe("hashSubject", () => {
  it("hashes an IP or email into an opaque, stable rate-limit key", () => {
    const subject = "203.0.113.7";
    const key = hashSubject(subject);

    expect(key).toMatch(HEX_256);
    expect(key).toBe(hashSubject(subject));
    expect(key).not.toContain(subject);
  });
});

describe("safeEqual", () => {
  it("compares equal values, and unequal values of equal or different length", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("randomId", () => {
  it("produces a v4 UUID", () => {
    expect(randomId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(randomId()).not.toBe(randomId());
  });
});
