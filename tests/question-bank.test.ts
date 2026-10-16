import { describe, expect, it } from "vitest";

import {
  QUESTIONS,
  SCORED_QUESTION_COUNT,
  TOTAL_SCREEN_COUNT,
  optionByKey,
  optionKeyToQuestionKey,
  questionByKey,
} from "@/lib/assessment/questions";

const LETTERS = ["A", "B", "C", "D"];

describe("question bank", () => {
  it("holds the 20 scored questions, numbered 1-20 in authored order", () => {
    expect(SCORED_QUESTION_COUNT).toBe(20);
    expect(QUESTIONS).toHaveLength(SCORED_QUESTION_COUNT);
    QUESTIONS.forEach((question, index) => {
      expect(question.position).toBe(index + 1);
    });
  });

  it("adds exactly one screen for the unscored tool inventory", () => {
    expect(TOTAL_SCREEN_COUNT).toBe(SCORED_QUESTION_COUNT + 1);
  });

  it("keys every question qNN and every option qNN-x with letters A-D in order", () => {
    for (const question of QUESTIONS) {
      expect(question.key).toMatch(/^q(0[1-9]|1[0-9]|20)$/);
      expect(question.options).toHaveLength(4);
      question.options.forEach((option, index) => {
        expect(option.letter).toBe(LETTERS[index]);
        expect(option.key).toBe(`${question.key}-${LETTERS[index]!.toLowerCase()}`);
      });
    }
  });

  it("has no duplicate question or option keys anywhere in the bank", () => {
    const questionKeys = QUESTIONS.map((q) => q.key);
    expect(new Set(questionKeys).size).toBe(questionKeys.length);

    const optionKeys = QUESTIONS.flatMap((q) => q.options.map((o) => o.key));
    expect(new Set(optionKeys).size).toBe(optionKeys.length);
  });

  it("gives every question a prompt and four distinct, non-empty options", () => {
    for (const question of QUESTIONS) {
      expect(question.prompt.trim().length).toBeGreaterThan(0);
      const labels = question.options.map((o) => o.label.trim());
      for (const label of labels) {
        expect(label.length).toBeGreaterThan(0);
      }
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("looks questions and options up by key, and rejects unknown keys", () => {
    expect(questionByKey("q01")?.position).toBe(1);
    expect(questionByKey("q20")?.position).toBe(20);
    expect(questionByKey("q21")).toBeUndefined();

    expect(optionByKey("q20-d")?.letter).toBe("D");
    expect(optionByKey("q20-e")).toBeUndefined();

    expect(optionKeyToQuestionKey("q07-b")).toBe("q07");
    expect(optionKeyToQuestionKey("nonsense")).toBeUndefined();
  });
});
