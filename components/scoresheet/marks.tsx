import { cn } from "@/lib/utils";

/**
 * The federation seal: a plain filled square, not a logo.
 *
 * It is the one mark that identifies the sheet as an official record rather than a web form, and it
 * is the only place the navy appears as a shape rather than as a surface.
 */
export function Seal({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block size-[11px] shrink-0 bg-navy", className)}
    />
  );
}

/**
 * The save-state mark beside the header's save label.
 *
 * State is carried by the mark's form as well as its colour, so the header still reads correctly
 * without colour vision: solid means the move is on the sheet, dashed means it is still being
 * written, ringed means the write failed and needs a retry.
 */
export function SaveMark({
  state,
  className,
}: {
  state: "saved" | "saving" | "error";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("block size-[10px] shrink-0", className, {
        "bg-certified": state === "saved",
        "border border-dashed border-ochre": state === "saving",
        "border-2 border-flag": state === "error",
      })}
    />
  );
}

/**
 * The skipped-move mark: a hollow square with a single 45° stroke through it.
 *
 * Drawn from the same vocabulary as the rail marks so it reads without colour: filled is on the
 * sheet, plain hollow is not yet, and hollow struck through is a decision the candidate made and
 * the record keeps. Used at 12px on the rail and at 10px beside "Skipped" wherever a skipped move
 * is read back.
 */
export function SkipMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[10px] shrink-0 items-center justify-center border border-soft/45 text-soft",
        className,
      )}
    >
      <svg viewBox="0 0 10 10" className="size-full" fill="none" focusable="false">
        <line
          x1="1.2"
          y1="8.8"
          x2="8.8"
          y2="1.2"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="square"
        />
      </svg>
    </span>
  );
}
