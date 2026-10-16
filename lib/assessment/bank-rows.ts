import {
  SCORED_QUESTION_COUNT,
  type OptionLetter,
  type Question,
} from "@/lib/assessment/questions";

/**
 * Maps question-bank rows from the database onto the same `Question` shape the authored module
 * uses, so every consumer — candidate screens, answer validation, scoring text — reads one shape
 * regardless of where the content came from.
 *
 * Returns `null` when the row set is not a complete bank (a half-copied version, a stray manual
 * row). The caller falls back to the authored bank rather than rendering a partial assessment.
 */

export type QuestionRow = {
  id: string;
  questionKey: string;
  prompt: string;
  canonicalPosition: number;
};

export type OptionRow = {
  questionId: string;
  optionKey: string;
  letter: string;
  label: string;
  position: number;
};

const OPTIONS_PER_QUESTION = 4;

export function bankFromRows(
  questionRows: QuestionRow[],
  optionRows: OptionRow[],
): Question[] | null {
  if (questionRows.length !== SCORED_QUESTION_COUNT) return null;

  const optionsByQuestion = new Map<string, OptionRow[]>();
  for (const row of optionRows) {
    const list = optionsByQuestion.get(row.questionId);
    if (list) list.push(row);
    else optionsByQuestion.set(row.questionId, [row]);
  }

  const questions: Question[] = [];
  for (const row of [...questionRows].sort(
    (a, b) => a.canonicalPosition - b.canonicalPosition,
  )) {
    const options = optionsByQuestion.get(row.id);
    if (!options || options.length !== OPTIONS_PER_QUESTION) return null;

    questions.push({
      key: row.questionKey,
      position: row.canonicalPosition,
      prompt: row.prompt,
      options: [...options]
        .sort((a, b) => a.position - b.position)
        .map((option) => ({
          key: option.optionKey,
          letter: option.letter as OptionLetter,
          label: option.label,
        })),
    });
  }

  return questions;
}
