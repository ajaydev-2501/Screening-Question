import { describe, expect, it } from "vitest";

import { bankFromRows, type OptionRow, type QuestionRow } from "@/lib/assessment/bank-rows";
import { SCORED_QUESTION_COUNT } from "@/lib/assessment/questions";

const LETTERS = ["A", "B", "C", "D"] as const;

function fullQuestionRows(): QuestionRow[] {
  return Array.from({ length: SCORED_QUESTION_COUNT }, (_, index) => ({
    id: `question-row-${index + 1}`,
    questionKey: `q${String(index + 1).padStart(2, "0")}`,
    prompt: `Prompt ${index + 1}?`,
    canonicalPosition: index + 1,
  }));
}

function fullOptionRows(): OptionRow[] {
  return fullQuestionRows().flatMap((question, index) =>
    LETTERS.map((letter, optionIndex) => ({
      questionId: question.id,
      optionKey: `${question.questionKey}-${letter.toLowerCase()}`,
      letter,
      label: `Option ${letter} of prompt ${index + 1}`,
      position: optionIndex + 1,
    })),
  );
}

describe("bankFromRows", () => {
  it("maps a complete row set onto the Question shape, sorted into canonical order", () => {
    // Shuffled input, deliberately: the database promises no row order, and both questions and
    // options must come back ordered by their persisted positions regardless.
    const questions = bankFromRows(
      [...fullQuestionRows()].reverse(),
      [...fullOptionRows()].reverse(),
    );

    expect(questions).not.toBeNull();
    expect(questions!).toHaveLength(SCORED_QUESTION_COUNT);

    questions!.forEach((question, index) => {
      expect(question.position).toBe(index + 1);
      expect(question.key).toBe(`q${String(index + 1).padStart(2, "0")}`);
      expect(question.prompt).toBe(`Prompt ${index + 1}?`);
      expect(question.options).toHaveLength(4);
      question.options.forEach((option, optionIndex) => {
        expect(option.letter).toBe(LETTERS[optionIndex]);
        expect(option.key).toBe(`${question.key}-${LETTERS[optionIndex]!.toLowerCase()}`);
        expect(option.label).toBe(`Option ${LETTERS[optionIndex]} of prompt ${index + 1}`);
      });
    });
  });

  it("carries the row's own letter through rather than deriving it from position", () => {
    const optionRows = fullOptionRows().map((row) =>
      row.optionKey === "q07-c" ? { ...row, letter: "X" } : row,
    );
    const questions = bankFromRows(fullQuestionRows(), optionRows);

    const option = questions!.find((q) => q.key === "q07")!.options[2]!;
    expect(option.letter).toBe("X");
  });

  it("returns null for a question count that is not exactly the scored count", () => {
    const rows = fullQuestionRows();
    expect(bankFromRows(rows.slice(0, -1), fullOptionRows())).toBeNull();
    expect(
      bankFromRows(
        [...rows, { id: "question-row-21", questionKey: "q99", prompt: "?", canonicalPosition: 21 }],
        fullOptionRows(),
      ),
    ).toBeNull();
  });

  it("returns null when any question is missing options or has extra ones", () => {
    const dropped = fullOptionRows().filter((row) => row.optionKey !== "q03-b");
    expect(bankFromRows(fullQuestionRows(), dropped)).toBeNull();

    const extra = [
      ...fullOptionRows(),
      { questionId: "question-row-5", optionKey: "q05-e", letter: "E", label: "Extra", position: 5 },
    ];
    expect(bankFromRows(fullQuestionRows(), extra)).toBeNull();
  });

  it("returns null when a question has no option rows at all", () => {
    const orphaned = [
      ...fullOptionRows().filter((row) => row.questionId !== "question-row-9"),
      { questionId: "question-row-other", optionKey: "q09-a", letter: "A", label: "Stray", position: 1 },
    ];
    expect(bankFromRows(fullQuestionRows(), orphaned)).toBeNull();
  });
});
