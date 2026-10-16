import { SkipMark } from "@/components/scoresheet/marks";
import { cn } from "@/lib/utils";

export type RailMark = "answered" | "current" | "pending" | "skipped" | "unanswered";

/**
 * The move rail: 21 equal steps, one per screen.
 *
 * Every step is the same height and the same width. The seven competency groupings the questions
 * are scored under are deliberately invisible here — a rail whose sections were sized by extent, or
 * broken by heading, would publish the weighting the brief keeps internal. The rail communicates
 * position and completion and nothing else.
 *
 * State is carried by the mark's form as well as its colour, so the rail reads correctly without
 * colour vision: filled = on the sheet, hollow = not yet, inverted half = the move in hand,
 * dashed = written but not yet saved, struck hollow = declined.
 */
export function MoveRail({
  total,
  currentMove,
  answeredMoves,
  skippedMoves,
  pendingMove,
  submitted,
  className,
}: {
  total: number;
  currentMove: number;
  answeredMoves: ReadonlySet<number>;
  skippedMoves: ReadonlySet<number>;
  pendingMove: number | null;
  submitted: boolean;
  className?: string;
}) {
  const moves = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <>
      {/* Compact strip: the same 21 marks, laid horizontally where there is no left edge to spare. */}
      <nav
        aria-label={`Assessment progress: move ${currentMove} of ${total}`}
        className={cn(
          "flex shrink-0 items-center gap-[3px] overflow-x-auto border-b border-rule px-4 py-3 lg:hidden",
          className,
        )}
      >
        {moves.map((move) => (
          <Mark
            key={move}
            move={move}
            state={markState(move, currentMove, answeredMoves, skippedMoves, pendingMove)}
            orientation="horizontal"
          />
        ))}
        <ResultCell submitted={submitted} className="ml-2" />
      </nav>

      {/* Full rail: mark, then the ruled line of a scoresheet row extending to the right. */}
      <nav
        aria-label={`Assessment progress: move ${currentMove} of ${total}`}
        className={cn(
          "hidden w-[104px] shrink-0 flex-col border-r border-rule px-4 pt-5 pb-4 lg:flex",
          className,
        )}
      >
        <div className="mono flex items-baseline justify-between border-b border-rule pb-2 text-[11px] tracking-[0.18em] text-soft">
          <span>MOVES</span>
          <span>{total}</span>
        </div>

        <ul className="mt-3 list-none">
          {moves.map((move) => (
            <li key={move}>
              <Mark
                move={move}
                state={markState(move, currentMove, answeredMoves, skippedMoves, pendingMove)}
                orientation="vertical"
              />
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4">
          <span className="mono mb-1.5 block text-[10px] tracking-[0.2em] text-soft">RESULT</span>
          <ResultCell submitted={submitted} />
        </div>
      </nav>
    </>
  );
}

function markState(
  move: number,
  currentMove: number,
  answeredMoves: ReadonlySet<number>,
  skippedMoves: ReadonlySet<number>,
  pendingMove: number | null,
): RailMark {
  if (move === pendingMove) return "pending";
  if (move === currentMove) return "current";
  if (skippedMoves.has(move)) return "skipped";
  return answeredMoves.has(move) ? "answered" : "unanswered";
}

function Mark({
  move,
  state,
  orientation,
}: {
  move: number;
  state: RailMark;
  orientation: "vertical" | "horizontal";
}) {
  const isCurrent = state === "current";

  return (
    <div
      className={cn(
        "flex items-center",
        orientation === "vertical" ? "h-[22px] gap-2.5" : "shrink-0",
      )}
      aria-current={isCurrent ? "step" : undefined}
    >
      {state === "skipped" ? (
        <SkipMark className="size-3" />
      ) : (
        <span
          aria-hidden="true"
          className={cn("block size-3 shrink-0", {
            "bg-navy": state === "answered",
            "border border-dashed border-ochre bg-sheet": state === "pending",
            "border-2 border-ochre": isCurrent,
            "border border-soft/45 bg-sheet": state === "unanswered",
          })}
          style={
            isCurrent
              ? { background: "linear-gradient(90deg, var(--color-ochre) 50%, #fff 50%)" }
              : undefined
          }
        />
      )}
      <span className="sr-only">
        {`Move ${move}: ${
          state === "answered"
            ? "answered"
            : state === "skipped"
              ? "skipped"
              : state === "pending"
                ? "answer saving"
                : isCurrent
                  ? "current"
                  : "not answered"
        }`}
      </span>
      {orientation === "vertical" ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex-1",
            isCurrent ? "h-[2px] bg-ochre" : "h-px bg-rule",
          )}
        />
      ) : null}
    </div>
  );
}

/**
 * The boxed result cell at the foot of the rail.
 *
 * It stays an em dash for the whole assessment and only ever resolves on the submitted screen.
 * Showing a running score here would turn an untimed record into a live tally, which is exactly the
 * pressure the no-timer constraint exists to remove.
 */
function ResultCell({ submitted, className }: { submitted: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mono flex h-[26px] items-center justify-center border text-[12px]",
        submitted ? "border-certified text-certified" : "border-rule text-soft",
        className,
      )}
    >
      {submitted ? "FILED" : "\u2014"}
    </span>
  );
}
