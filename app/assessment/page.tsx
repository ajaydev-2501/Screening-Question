import { redirect } from "next/navigation";

import { AssessmentShell, type ShellScreen } from "@/components/assessment/assessment-shell";
import { TOTAL_SCREEN_COUNT } from "@/lib/assessment/questions";
import {
  firstOpenMove,
  isInventoryComplete,
  loadAssessmentState,
  type AssessmentState,
} from "@/lib/assessment/service";
import { readCandidateSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * One move per screen, addressed by `?move=`.
 *
 * The move number is a URL parameter rather than client state so the browser's own back button
 * walks the sheet, a paused candidate can bookmark where they were, and a reload lands on the same
 * question instead of the first one.
 */
export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ move?: string }>;
}) {
  const session = await readCandidateSession();
  if (!session) redirect("/");

  const state = await loadAssessmentState(session.assessmentId);
  if (!state) redirect("/");
  if (state.status === "submitted") redirect("/assessment/submitted");

  const requested = Number.parseInt((await searchParams).move ?? "", 10);
  const fallback = firstOpenMove(state) ?? 1;
  const move = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), TOTAL_SCREEN_COUNT)
    : fallback;

  const screen = state.screens[move - 1];
  if (!screen) redirect(`/assessment?move=${fallback}`);

  return (
    <AssessmentShell
      // Remounting per move resets the shell's local state from the fresh server props, so a move
      // is always rendered from the record rather than from whatever the browser still held.
      key={move}
      move={move}
      total={TOTAL_SCREEN_COUNT}
      submitted={false}
      answeredMoves={answeredMoves(state)}
      skippedMoves={skippedMoves(state)}
      screen={shellScreen(state, move)}
    />
  );
}

/** Which rail marks are filled. A move counts as answered once its decision is on the sheet. */
function answeredMoves(state: AssessmentState): number[] {
  const moves: number[] = [];
  for (const screen of state.screens) {
    if (screen.kind === "question" && screen.question.key in state.answers) {
      moves.push(screen.move);
    }
  }
  if (isInventoryComplete(state.inventory)) moves.push(TOTAL_SCREEN_COUNT);
  return moves;
}

/** Which rail marks carry the skip stroke. Complete wins: a filled mark outranks a skipped one. */
function skippedMoves(state: AssessmentState): number[] {
  const moves: number[] = [];
  for (const screen of state.screens) {
    if (screen.kind === "question" && state.skippedKeys.includes(screen.question.key)) {
      moves.push(screen.move);
    }
  }
  if (state.inventory.skipped && !isInventoryComplete(state.inventory)) {
    moves.push(TOTAL_SCREEN_COUNT);
  }
  return moves;
}

function shellScreen(state: AssessmentState, move: number): ShellScreen {
  const screen = state.screens[move - 1];
  if (!screen) throw new Error(`Move ${move} is not part of this assessment.`);

  if (screen.kind === "inventory") {
    return { kind: "inventory", inventory: state.inventory };
  }

  return {
    kind: "question",
    questionKey: screen.question.key,
    prompt: screen.question.prompt,
    options: screen.question.options.map((o) => ({
      key: o.key,
      letter: o.letter,
      label: o.label,
    })),
    selectedKey: state.answers[screen.question.key] ?? null,
  };
}

export const metadata = {
  title: "Moves · AI Engineering Developer Assessment",
};
