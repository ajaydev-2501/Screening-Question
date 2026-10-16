import { describe, expect, it } from "vitest";

import { QUESTIONS } from "@/lib/assessment/questions";
import { RUBRIC } from "@/lib/assessment/rubric";
import { SECTIONS } from "@/lib/assessment/sections";

const ALL_OPTION_KEYS = QUESTIONS.flatMap((q) => q.options.map((o) => o.key));
const SECTION_IDS = new Set(SECTIONS.map((s) => s.id));
const PROFICIENCIES = [1, 2, 3, 4];

describe("scoring rubric", () => {
  it("covers every option of every question, with no orphans in either direction", () => {
    expect(Object.keys(RUBRIC).sort()).toEqual([...ALL_OPTION_KEYS].sort());
  });

  it("assigns every entry a known section and an integer proficiency 1-4", () => {
    for (const [optionKey, entry] of Object.entries(RUBRIC)) {
      expect(SECTION_IDS.has(entry.section), `${optionKey} -> ${entry.section}`).toBe(true);
      expect(PROFICIENCIES, optionKey).toContain(entry.score);
    }
  });

  it("scopes each question to exactly one section", () => {
    for (const question of QUESTIONS) {
      const sections = new Set(question.options.map((o) => RUBRIC[o.key]!.section));
      expect(sections.size, question.key).toBe(1);
    }
  });

  it("uses each proficiency exactly once per question, so the four options stay distinguishable", () => {
    for (const question of QUESTIONS) {
      const scores = question.options.map((o) => RUBRIC[o.key]!.score).sort((a, b) => a - b);
      expect(scores, question.key).toEqual(PROFICIENCIES);
    }
  });

  it("carries no scoring text, so the stored answer rows cannot leak the key", () => {
    for (const [optionKey, entry] of Object.entries(RUBRIC)) {
      expect(Object.keys(entry).sort(), optionKey).toEqual(["score", "section"]);
    }
  });

  it("gives every question exactly one best answer, the proficiency 4", () => {
    for (const question of QUESTIONS) {
      const best = question.options.filter((o) => RUBRIC[o.key]!.score === 4);
      expect(best.length, question.key).toBe(1);
    }
  });

  it("measures every section with at least one question", () => {
    for (const section of SECTIONS) {
      const measured = QUESTIONS.some((q) => RUBRIC[q.options[0]!.key]!.section === section.id);
      expect(measured, section.id).toBe(true);
    }
  });
});
