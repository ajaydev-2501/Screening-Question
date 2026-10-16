import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  MAX_CUSTOM_TOOL_NAME_LENGTH,
  MAX_FIRST_NAME_LENGTH,
  MAX_PRIMARY_AGENT_OTHER_LENGTH,
  MAX_REAL_WORLD_EXAMPLE_LENGTH,
  MAX_TOOL_SELECTIONS,
  fieldErrors,
  saveAnswerSchema,
  skipInventorySchema,
  startAssessmentSchema,
  toolInventorySchema,
} from "@/lib/validation";

describe("startAssessmentSchema", () => {
  it("trims and accepts a normal name and email", () => {
    const parsed = startAssessmentSchema.parse({
      firstName: "  Ada  ",
      email: "  ada@example.com  ",
    });
    expect(parsed).toEqual({ firstName: "Ada", email: "ada@example.com" });
  });

  it("rejects a blank name and an over-long field", () => {
    expect(startAssessmentSchema.safeParse({ firstName: "   ", email: "a@b.co" }).success).toBe(
      false,
    );
    expect(
      startAssessmentSchema.safeParse({
        firstName: "a".repeat(MAX_FIRST_NAME_LENGTH + 1),
        email: "a@b.co",
      }).success,
    ).toBe(false);
  });

  it("strips unknown keys instead of persisting them", () => {
    const parsed = startAssessmentSchema.parse({
      firstName: "Ada",
      email: "ada@example.com",
      isAdmin: true,
    });
    expect(parsed).not.toHaveProperty("isAdmin");
  });
});

describe("saveAnswerSchema", () => {
  it("accepts exactly the 20 scored questions and their options", () => {
    for (let n = 1; n <= 20; n += 1) {
      const key = `q${String(n).padStart(2, "0")}`;
      for (const letter of ["a", "b", "c", "d"]) {
        expect(
          saveAnswerSchema.safeParse({ questionKey: key, optionKey: `${key}-${letter}` }).success,
          `${key}-${letter}`,
        ).toBe(true);
      }
    }
  });

  it("rejects the inventory screen and malformed keys", () => {
    for (const pair of [
      { questionKey: "q21", optionKey: "q21-a" },
      { questionKey: "q00", optionKey: "q00-a" },
      { questionKey: "q1", optionKey: "q1-a" },
      { questionKey: "q01", optionKey: "q01-e" },
    ]) {
      expect(saveAnswerSchema.safeParse(pair).success, JSON.stringify(pair)).toBe(false);
    }
  });

  // The schema validates each field's shape only; that an option belongs to its question is
  // enforced where the write happens (service.saveAnswer) and covered by the candidate E2E spec.
  it("leaves cross-field pairing to the service layer", () => {
    expect(saveAnswerSchema.safeParse({ questionKey: "q01", optionKey: "q02-a" }).success).toBe(
      true,
    );
  });

  it("accepts a skip body, and only for a scored question", () => {
    expect(saveAnswerSchema.safeParse({ questionKey: "q01", skipped: true }).success).toBe(true);
    expect(saveAnswerSchema.safeParse({ questionKey: "q21", skipped: true }).success).toBe(false);
    expect(saveAnswerSchema.safeParse({ questionKey: "q01", skipped: false }).success).toBe(false);
    expect(saveAnswerSchema.safeParse({ questionKey: "q01" }).success).toBe(false);
  });

  it("reads a body carrying both as an answer, so a skip cannot displace a chosen option", () => {
    const parsed = saveAnswerSchema.parse({
      questionKey: "q01",
      optionKey: "q01-b",
      skipped: true,
    });
    expect(parsed).toEqual({ questionKey: "q01", optionKey: "q01-b" });
  });
});

describe("skipInventorySchema", () => {
  it("accepts only the literal skip body", () => {
    expect(skipInventorySchema.safeParse({ skipped: true }).success).toBe(true);
    expect(skipInventorySchema.safeParse({}).success).toBe(false);
    expect(skipInventorySchema.safeParse({ skipped: false }).success).toBe(false);
    expect(skipInventorySchema.safeParse({ skipped: "true" }).success).toBe(false);
  });
});

describe("toolInventorySchema", () => {
  it("defaults every field, because it guards an autosave rather than a submission", () => {
    const parsed = toolInventorySchema.parse({});
    expect(parsed).toEqual({
      selections: [],
      productivityTools: [],
      primaryAgentKey: null,
      primaryAgentOther: null,
      usageDepthKey: null,
      realWorldExample: null,
    });
  });

  it("folds blank free text to null so cleared and never-filled store alike", () => {
    const parsed = toolInventorySchema.parse({
      selections: [{ toolKey: "vscode", customName: "   " }],
      primaryAgentOther: "  ",
      realWorldExample: "\t",
    });
    expect(parsed.selections).toEqual([{ toolKey: "vscode", customName: null }]);
    expect(parsed.primaryAgentOther).toBeNull();
    expect(parsed.realWorldExample).toBeNull();
  });

  it("keeps a filled custom name and strips unknown selection keys", () => {
    const parsed = toolInventorySchema.parse({
      selections: [{ toolKey: "other-editor-ide", customName: "Fleet", injected: "x" }],
    });
    expect(parsed.selections).toEqual([{ toolKey: "other-editor-ide", customName: "Fleet" }]);
  });

  it("enforces the selection ceiling above the catalog size", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ toolKey: `tool-${i}` }));
    expect(toolInventorySchema.safeParse({ selections: many(MAX_TOOL_SELECTIONS) }).success).toBe(
      true,
    );
    expect(
      toolInventorySchema.safeParse({ selections: many(MAX_TOOL_SELECTIONS + 1) }).success,
    ).toBe(false);
  });

  it("allows at most three productivity tools", () => {
    const tools = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ toolKey: `tool-${i}` }));
    expect(toolInventorySchema.safeParse({ productivityTools: tools(3) }).success).toBe(true);
    expect(toolInventorySchema.safeParse({ productivityTools: tools(4) }).success).toBe(false);
  });

  it("caps every free-text field", () => {
    expect(
      toolInventorySchema.safeParse({
        realWorldExample: "x".repeat(MAX_REAL_WORLD_EXAMPLE_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      toolInventorySchema.safeParse({
        realWorldExample: "x".repeat(MAX_REAL_WORLD_EXAMPLE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      toolInventorySchema.safeParse({
        primaryAgentOther: "x".repeat(MAX_PRIMARY_AGENT_OTHER_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      toolInventorySchema.safeParse({
        selections: [{ toolKey: "vscode", customName: "x".repeat(MAX_CUSTOM_TOOL_NAME_LENGTH + 1) }],
      }).success,
    ).toBe(false);
  });

  it("rejects wrong types instead of coercing them", () => {
    expect(toolInventorySchema.safeParse({ selections: "vscode" }).success).toBe(false);
    expect(toolInventorySchema.safeParse({ selections: [{ toolKey: "" }] }).success).toBe(false);
    expect(toolInventorySchema.safeParse({ productivityTools: [{}] }).success).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("keeps only the first message per field", () => {
    const schema = z.object({
      email: z.string().min(3, "too short").regex(/^x/, "must start with x"),
    });
    const result = schema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    const errors = fieldErrors(result.error!);
    expect(Object.keys(errors)).toEqual(["email"]);
    expect(errors.email).toBe("too short");
  });

  it("joins nested paths and falls back to 'form' for root issues", () => {
    const schema = z.object({ a: z.object({ b: z.string().min(1, "required") }) });
    const nested = schema.safeParse({ a: { b: "" } });
    expect(fieldErrors(nested.error!)).toEqual({ "a.b": "required" });
  });
});
