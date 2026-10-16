import { Seal } from "@/components/scoresheet/marks";
import { cn } from "@/lib/utils";

export const ASSESSMENT_TITLE = "AI Engineering Developer Assessment";

/**
 * The sheet's header: institutional name in tracked uppercase on the left, the move counter and
 * save state on the right. Every candidate-facing screen wears it unchanged, so the candidate
 * recognises where they are after any navigation.
 */
export function SheetHeader({
  move,
  total,
  children,
}: {
  move?: number;
  total?: number;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-rule px-5 md:px-7">
      <div className="flex min-w-0 items-center gap-3.5">
        <Seal />
        <h1 className="truncate text-[11.5px] font-bold tracking-[0.19em] whitespace-nowrap uppercase">
          {ASSESSMENT_TITLE}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-3.5 md:gap-4">
        {move !== undefined && total !== undefined ? (
          <span className="mono text-[11px] tracking-[0.14em] text-soft">
            MOVE{" "}
            <b className="text-[13px] font-bold tracking-normal text-ink">
              {String(move).padStart(2, "0")}
            </b>
            <span className="hidden sm:inline"> / {total}</span>
          </span>
        ) : null}
        {children}
      </div>
    </header>
  );
}

/**
 * The sheet: the page itself, edge to edge.
 *
 * There is no paper margin, no border, no width cap and no shadow — the sheet fills the viewport
 * at every size, and the ruled interior (masthead, hairlines, marks, notation type) carries the
 * identity on its own. The column structure stays: fixed header, flexible body, fixed footer.
 */
export function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-sheet">{children}</div>
  );
}

/**
 * A ruled row of the sheet: a label in the left column, its value in the right.
 *
 * The scoresheet's own header block is a stack of these — White, Black, Result, Date — and the
 * entry form and the confirmation screen both reuse it, so the candidate reads the same furniture
 * at the start of the record and at the end of it.
 */
export function RuledRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-1 border-t border-rule px-5 py-4 first:border-t-0 sm:grid-cols-[120px_1fr] sm:items-start sm:gap-5",
        className,
      )}
    >
      <span className="mono pt-[3px] text-[11px] tracking-[0.18em] text-soft uppercase">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
