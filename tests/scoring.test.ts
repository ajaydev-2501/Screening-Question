import { describe, expect, it } from "vitest";

import { QUESTIONS, type Question, type QuestionOption } from "@/lib/assessment/questions";
import { RUBRIC } from "@/lib/assessment/rubric";
import {
  ASSESSMENT_BANDS,
  bandForScore,
  IncompleteAssessmentError,
  scoreAssessment,
  serializeSectionScores,
} from "@/lib/assessment/scoring";
import { SECTIONS, sectionById, type SectionId } from "@/lib/assessment/sections";

type Rank = "best" | "worst";

function extreme(question: Question, rank: Rank): QuestionOption {
  return question.options.reduce((chosen, candidate) => {
    const chosenScore = RUBRIC[chosen.key]!.score;
    const candidateScore = RUBRIC[candidate.key]!.score;
    if (rank === "best") return candidateScore > chosenScore ? candidate : chosen;
    return candidateScore < chosenScore ? candidate : chosen;
  });
}

function answerEveryQuestion(rank: Rank): Map<string, string> {
  return new Map(QUESTIONS.map((q) => [q.key, extreme(q, rank).key]));
}

/**
 * The scoring contract restated independently of scoring.ts: every question is worth 4 available
 * points in its section, the chosen proficiency is what is earned, each section is normalized to
 * 0-100 on its own points, and the total is the raw sum of the twenty earned levels (20-80).
 * Any drift in the implementation must fail this comparison.
 */
function expectedSection(sectionId: SectionId, rank: Rank) {
  const questions = QUESTIONS.filter((q) => RUBRIC[q.options[0]!.key]!.section === sectionId);
  const available = questions.length * 4;
  const earned = questions.reduce((sum, q) => {
    const scores = q.options.map((o) => RUBRIC[o.key]!.score);
    return sum + (rank === "best" ? Math.max(...scores) : Math.min(...scores));
  }, 0);
  const normalized = available === 0 ? 0 : Math.round((earned / available) * 100);
  return { earned, available, normalized };
}

function expectedTotal(rank: Rank): number {
  return SECTIONS.reduce((sum, section) => {
    const { earned } = expectedSection(section.id, rank);
    return sum + earned;
  }, 0);
}

function captureError(run: () => unknown): unknown {
  try {
    run();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("scoreAssessment", () => {
  it("scores a perfect sheet at exactly 80 with every section at 100", () => {
    const result = scoreAssessment(answerEveryQuestion("best"));

    expect(result.totalScore).toBe(80);
    expect(result.band.id).toBe("strong");
    for (const section of result.sections) {
      expect(section.normalized, section.id).toBe(100);
    }
    // Every section tied at the top: the report says so rather than picking a winner.
    expect(result.strongest).toHaveLength(SECTIONS.length);
    expect(result.weakest).toHaveLength(SECTIONS.length);
    expect(result.skippedCount).toBe(0);
  });

  it("scores the weakest sheet from the rubric, not a hardcoded expectation", () => {
    const answers = answerEveryQuestion("worst");
    const result = scoreAssessment(answers);

    for (const section of result.sections) {
      const expected = expectedSection(section.id, "worst");
      expect(section.earned, section.id).toBe(expected.earned);
      expect(section.available, section.id).toBe(expected.available);
      expect(section.normalized, section.id).toBe(expected.normalized);
    }
    expect(result.totalScore).toBe(20);
    expect(result.band.id).toBe("developing");
    expect(result.totalScore).toBeLessThan(expectedTotal("best"));
  });

  it("names every section tied for strongest, not an arbitrary one", () => {
    // Answer best everywhere except one three-question section, which is answered worst.
    const answers = new Map<string, string>();
    for (const question of QUESTIONS) {
      const section = RUBRIC[question.options[0]!.key]!.section;
      answers.set(question.key, extreme(question, section === "testing-validation" ? "worst" : "best").key);
    }

    const result = scoreAssessment(answers);
    const tops = result.sections.filter((s) => s.normalized === 100).map((s) => s.id);
    expect(result.strongest.map((s) => s.id)).toEqual(tops);
    expect(result.strongest.map((s) => s.id)).not.toContain("testing-validation");
    expect(result.weakest.map((s) => s.id)).toEqual(["testing-validation"]);
  });

  it("refuses an incomplete sheet and names every missing question", () => {
    const answers = answerEveryQuestion("best");
    answers.delete("q05");
    answers.delete("q17");

    const error = captureError(() => scoreAssessment(answers));
    expect(error).toBeInstanceOf(IncompleteAssessmentError);
    expect((error as IncompleteAssessmentError).missingQuestionKeys).toEqual(["q05", "q17"]);

    const emptyError = captureError(() => scoreAssessment(new Map()));
    expect((emptyError as IncompleteAssessmentError).missingQuestionKeys).toHaveLength(
      QUESTIONS.length,
    );
  });

  it("accepts a sheet where skipped moves take the place of answers", () => {
    const answers = answerEveryQuestion("best");
    answers.delete("q05");
    answers.delete("q12");

    const result = scoreAssessment(answers, new Set(["q05", "q12"]));
    expect(result.skippedCount).toBe(2);
    expect(result.answeredCount).toBe(QUESTIONS.length - 2);
    expect(result.totalQuestions).toBe(QUESTIONS.length);
  });

  it("charges a skipped move the four available points and the 1-point floor on the sheet", () => {
    const skippedKey = "q05";
    const answers = answerEveryQuestion("best");
    answers.delete(skippedKey);

    const result = scoreAssessment(answers, new Set([skippedKey]));

    for (const section of result.sections) {
      const questions = QUESTIONS.filter(
        (q) => RUBRIC[q.options[0]!.key]!.section === section.id,
      );
      const expectedEarned = questions.reduce(
        (sum, q) =>
          sum +
          (q.key === skippedKey
            ? 1
            : Math.max(...q.options.map((o) => RUBRIC[o.key]!.score))),
        0,
      );
      expect(section.earned, section.id).toBe(expectedEarned);
      expect(section.available, section.id).toBe(questions.length * 4);
    }

    // The floor keeps a skip inside the published bands: one skip can never read as a hole.
    expect(result.totalScore).toBe(80 - 4 + 1);
    expect(bandForScore(result.totalScore).id).toBe("strong");
  });

  it("keeps every possible sheet inside the 20-80 bands", () => {
    const floors = scoreAssessment(new Map(), new Set(QUESTIONS.map((q) => q.key)));
    expect(floors.totalScore).toBe(20);

    const ceilings = scoreAssessment(answerEveryQuestion("best"));
    expect(ceilings.totalScore).toBe(80);
  });

  it("still refuses a move that is neither answered nor skipped", () => {
    const answers = answerEveryQuestion("best");
    answers.delete("q05");

    const error = captureError(() => scoreAssessment(answers, new Set(["q12"])));
    expect(error).toBeInstanceOf(IncompleteAssessmentError);
    expect((error as IncompleteAssessmentError).missingQuestionKeys).toEqual(["q05"]);
  });

  it("refuses an option key the rubric does not know", () => {
    const answers = answerEveryQuestion("best");
    answers.set("q01", "q01-invented");

    expect(() => scoreAssessment(answers)).toThrow(/scoring record/);
  });

  it("is deterministic for identical answers", () => {
    const answers = answerEveryQuestion("best");
    expect(scoreAssessment(answers)).toEqual(scoreAssessment(answers));
  });

  it("counts answered questions against the bank size", () => {
    const result = scoreAssessment(answerEveryQuestion("best"));
    expect(result.answeredCount).toBe(QUESTIONS.length);
    expect(result.totalQuestions).toBe(QUESTIONS.length);
  });

  it("reads completeness and section attribution from the passed bank, not the module bank", () => {
    // A pinned bank that is missing its last question; the module bank still has it, so the same
    // answer sheet must pass against the narrowed bank and fail against the module one.
    const narrowed: Question[] = QUESTIONS.slice(0, -1);
    const last = QUESTIONS[QUESTIONS.length - 1]!;
    const answers = new Map(narrowed.map((q) => [q.key, extreme(q, "best").key]));

    const result = scoreAssessment(answers, new Set(), narrowed);
    expect(result.totalQuestions).toBe(narrowed.length);
    expect(result.answeredCount).toBe(narrowed.length);
    expect(result.totalScore).toBe(80 - 4);

    // The removed question's section now stands on its remaining two questions: 8 available.
    const removedSection = RUBRIC[last.options[0]!.key]!.section;
    const section = result.sections.find((s) => s.id === removedSection)!;
    expect(section.available).toBe(8);

    expect(() => scoreAssessment(answers)).toThrow(IncompleteAssessmentError);
  });
});

describe("bands", () => {
  it("has full, non-overlapping coverage of 20-80", () => {
    for (let total = 20; total <= 80; total += 1) {
      const band = bandForScore(total);
      const overlapping = ASSESSMENT_BANDS.filter((b) => total >= b.min && total <= b.max);
      expect(overlapping, String(total)).toHaveLength(1);
      expect(band.id).toBe(overlapping[0]!.id);
    }
  });

  it("places each boundary in exactly one band", () => {
    expect(bandForScore(80).id).toBe("strong");
    expect(bandForScore(68).id).toBe("strong");
    expect(bandForScore(67).id).toBe("good");
    expect(bandForScore(52).id).toBe("good");
    expect(bandForScore(51).id).toBe("intermediate");
    expect(bandForScore(36).id).toBe("intermediate");
    expect(bandForScore(35).id).toBe("developing");
    expect(bandForScore(20).id).toBe("developing");
  });

  it("refuses a total the published bands cannot describe", () => {
    expect(() => bandForScore(19)).toThrow(/outside every screening band/);
    expect(() => bandForScore(81)).toThrow(/outside every screening band/);
  });
});

describe("sections", () => {
  it("resolves every authored id and rejects unknown ones", () => {
    for (const section of SECTIONS) {
      expect(sectionById(section.id)).toBe(section);
    }
    expect(() => sectionById("nope" as SectionId)).toThrow(/Unknown section/);
  });
});

describe("serializeSectionScores", () => {
  it("emits exactly the section ids with numeric fields and no rubric text", () => {
    const serialized = serializeSectionScores(scoreAssessment(answerEveryQuestion("best")));

    expect(Object.keys(serialized).sort()).toEqual(SECTIONS.map((s) => s.id).sort());
    for (const value of Object.values(serialized)) {
      expect(typeof value.earned).toBe("number");
      expect(typeof value.available).toBe("number");
      expect(typeof value.normalized).toBe("number");
    }
    expect(JSON.stringify(serialized)).not.toMatch(/note|interview|rubric|score/i);
  });
});
