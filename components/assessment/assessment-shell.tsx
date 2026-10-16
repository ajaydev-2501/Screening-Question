"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { ButtonLoader, ClickShield } from "@/components/assessment/button-loader";
import { MoveRail } from "@/components/assessment/move-rail";
import { ParticleFlow } from "@/components/assessment/particle-flow";
import { QuestionPanel, type PanelOption } from "@/components/assessment/question-panel";
import { ToolInventoryPanel } from "@/components/assessment/tool-inventory-panel";
import { Seal, SaveMark } from "@/components/scoresheet/marks";
import { Sheet } from "@/components/scoresheet/sheet";
import type { ToolInventoryState } from "@/lib/assessment/service-types";
import { cn } from "@/lib/utils";

export type SaveChannel = {
  saving: boolean;
  error: string | null;
  retry: (() => void) | null;
  /** A change exists in the browser that no request has carried yet. */
  queue: () => void;
  start: () => void;
  succeed: () => void;
  fail: (message: string, retry: () => void) => void;
};

export type ShellScreen =
  | {
      kind: "question";
      questionKey: string;
      prompt: string;
      options: PanelOption[];
      selectedKey: string | null;
    }
  | { kind: "inventory"; inventory: ToolInventoryState };

const TITLE = "AI Engineering Developer Assessment";

export function AssessmentShell({
  move,
  total,
  answeredMoves,
  skippedMoves,
  submitted,
  screen,
}: {
  move: number;
  total: number;
  answeredMoves: number[];
  skippedMoves: number[];
  submitted: boolean;
  screen: ShellScreen;
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();

  // The page remounts this shell per move (key={move}), so every piece of per-move state below
  // seeds itself from the server props on mount: navigating back re-reads the saved choice instead
  // of carrying a stale one across.
  const [selectedKey, setSelectedKey] = useState<string | null>(
    screen.kind === "question" ? screen.selectedKey : null,
  );
  const [answered, setAnswered] = useState<ReadonlySet<number>>(
    () => new Set(answeredMoves),
  );
  const [skipped] = useState<ReadonlySet<number>>(() => new Set(skippedMoves));
  const [pendingMove, setPendingMove] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [isSavingSkip, setIsSavingSkip] = useState(false);
  const advanceQueuedRef = useRef(false);
  const [queued, setQueued] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  const channel: SaveChannel = {
    saving,
    error: saveError,
    retry,
    queue: () => setQueued(true),
    start: () => {
      setSaving(true);
      setSaveError(null);
      setRetry(null);
    },
    succeed: () => {
      setSaving(false);
      setQueued(false);
      setPendingMove(null);
      setAnswered((prev) => new Set(prev).add(move));
    },
    fail: (message, retryFn) => {
      setSaving(false);
      setSaveError(message);
      setRetry(() => retryFn);
    },
  };

  const backHref = move > 1 ? `/assessment?move=${move - 1}` : "/";
  const nextHref = move < total ? `/assessment?move=${move + 1}` : "/assessment/confirm";

  const persistAnswer = useCallback(
    (questionKey: string, optionKey: string) => {
      const send = () => {
        setIsSavingAnswer(true);
        channel.start();
        setPendingMove(move);

        fetch("/api/assessment/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionKey, optionKey }),
        })
          .then(async (response) => {
            if (response.ok) {
              channel.succeed();
              setIsSavingAnswer(false);
              if (advanceQueuedRef.current) {
                advanceQueuedRef.current = false;
                startTransition(() => {
                  router.push(nextHref);
                });
              }
              return;
            }
            const payload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            setIsSavingAnswer(false);
            advanceQueuedRef.current = false;
            channel.fail(
              payload?.error ?? "Your answer could not be saved. Check your connection and retry.",
              send,
            );
          })
          .catch(() => {
            setIsSavingAnswer(false);
            advanceQueuedRef.current = false;
            channel.fail("Your answer could not be saved. Check your connection and retry.", send);
          });
      };

      send();
    },
    // channel is rebuilt every render; depending on it would re-create persistAnswer constantly and
    // re-run the effect below. The setters it closes over are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [move, nextHref, router, startTransition],
  );

  const handleSelect = useCallback(
    (optionKey: string) => {
      if (screen.kind !== "question") return;
      setSelectedKey(optionKey);
      persistAnswer(screen.questionKey, optionKey);
    },
    [persistAnswer, screen],
  );

  // A queued draft blocks the same way a failed write does: the next screen reads the record back
  // from the database, so moving on before the write lands would show the candidate a sheet that
  // is missing the answer they just gave.
  const blocked = saving || queued || saveError !== null;

  // A question move is decided once an option is selected or a skip is on the record. An undecided
  // move is never carried forward: the forward controls below stay dormant until then. A move that
  // was answered or skipped earlier is decided, so revisiting it keeps Next open.
  const undecided =
    screen.kind === "question" && selectedKey === null && !skipped.has(move);
  const advanceBlocked = blocked || undecided;

  // Backend processing states
  const isNextProcessing = isSavingAnswer || (saving && !isSavingSkip) || isNavigating;
  const isSkipProcessing = isSavingSkip;
  const isProcessing = isNextProcessing || isSkipProcessing;

  // Skipping writes the decline to the sheet like any answer, then moves on the same way Next
  // does. It is a separate write rather than "advance without saving" so the record can never
  // confuse a skip with an omission.
  const persistSkip = useCallback(() => {
    const send = () => {
      setIsSavingSkip(true);
      channel.start();
      setPendingMove(move);

      const isQuestion = screen.kind === "question";
      fetch(isQuestion ? "/api/assessment/answer" : "/api/assessment/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isQuestion ? { questionKey: screen.questionKey, skipped: true } : { skipped: true },
        ),
      })
        .then(async (response) => {
          if (response.ok) {
            channel.succeed();
            if (isQuestion) setSelectedKey(null);
            startTransition(() => {
              router.push(nextHref);
            });
            return;
          }
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          setIsSavingSkip(false);
          channel.fail(
            payload?.error ?? "This move could not be skipped. Check your connection and retry.",
            send,
          );
        })
        .catch(() => {
          setIsSavingSkip(false);
          channel.fail(
            "This move could not be skipped. Check your connection and retry.",
            send,
          );
        });
    };

    send();
    // channel is rebuilt every render; depending on it would re-create persistSkip constantly.
    // The setters it closes over are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move, nextHref, router, screen, startTransition]);

  const handleSkip = useCallback(() => {
    if (blocked || isProcessing) return;
    persistSkip();
  }, [blocked, isProcessing, persistSkip]);

  const goNext = useCallback(() => {
    if (isProcessing) {
      if (isNextProcessing && saving) {
        advanceQueuedRef.current = true;
      }
      return;
    }
    if (advanceBlocked) {
      if (saving || queued) {
        advanceQueuedRef.current = true;
      }
      return;
    }
    startTransition(() => {
      router.push(nextHref);
    });
  }, [advanceBlocked, isNextProcessing, isProcessing, nextHref, queued, router, saving, startTransition]);

  const handleNextClick = useCallback(
    (event: React.MouseEvent) => {
      if (isProcessing) {
        event.preventDefault();
        if (isNextProcessing && saving) {
          advanceQueuedRef.current = true;
        }
        return;
      }
      if (advanceBlocked) {
        event.preventDefault();
        if (saving || queued) {
          advanceQueuedRef.current = true;
        }
        return;
      }
      event.preventDefault();
      startTransition(() => {
        router.push(nextHref);
      });
    },
    [advanceBlocked, isNextProcessing, isProcessing, nextHref, queued, router, saving, startTransition],
  );

  // 1-4 selects, S skips, Enter continues. All are additions on top of the native radio keyboard
  // model, never a replacement for it, so the flow still works with the arrow keys alone.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (isProcessing) {
        if (event.key === "Enter" && isNextProcessing && saving) {
          advanceQueuedRef.current = true;
        }
        event.preventDefault();
        return;
      }

      const target = event.target as HTMLElement | null;
      const inField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (screen.kind === "question" && !inField && /^[1-4]$/.test(event.key)) {
        const option = screen.options[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          handleSelect(option.key);
        }
        return;
      }

      if (screen.kind === "question" && !inField && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSkip();
        return;
      }

      if (event.key === "Enter") {
        if (target instanceof HTMLAnchorElement || target instanceof HTMLButtonElement) return;
        if (inField) return;
        event.preventDefault();
        goNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, handleSelect, handleSkip, isNextProcessing, isProcessing, saving, screen]);

  const saveLabel = saveError
    ? "SAVE FAILED"
    : saving || queued
      ? `SAVING MOVE ${pad(move)}\u2026`
      : "PROGRESS SAVED";
  const saveState = saveError ? "error" : saving || queued ? "saving" : "saved";

  return (
    <Sheet>
      <ClickShield active={isProcessing} />

      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-rule px-5 md:px-7">
        <div className="flex min-w-0 items-center gap-3.5">
          <Seal />
          <h1 className="truncate text-[11.5px] font-bold tracking-[0.19em] whitespace-nowrap uppercase">
            {TITLE}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3.5 md:gap-4">
          <span className="mono text-[11px] tracking-[0.14em] text-soft">
            MOVE <b className="text-[13px] font-bold tracking-normal text-ink">{pad(move)}</b>
            <span className="hidden sm:inline"> / {total}</span>
          </span>

          <span aria-hidden="true" className="hidden h-[18px] w-px bg-rule sm:block" />

          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-soft"
          >
            <SaveMark state={saveState} />
            <span className="mono hidden md:inline">{saveLabel}</span>
            {saveError && retry ? (
              <button
                type="button"
                onClick={retry}
                className="mono border border-flag px-2 py-[3px] text-[11px] tracking-[0.12em] text-flag uppercase transition-colors duration-150 hover:bg-flag hover:text-sheet"
              >
                Retry
              </button>
            ) : null}
          </span>
        </div>
      </header>

      {saveError ? (
        <p
          role="alert"
          className="shrink-0 border-b border-rule bg-flag/8 px-5 py-3 text-[13px] leading-[1.5] text-flag md:px-7"
        >
          {saveError} This move has not been written to the sheet — retry before you move on.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className={cn("flex flex-col lg:flex-row", isProcessing && "pointer-events-none select-none")}>
          <MoveRail
            total={total}
            currentMove={move}
            answeredMoves={answered}
            skippedMoves={skipped}
            pendingMove={pendingMove}
            submitted={submitted}
          />
        </div>

        <main className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-y-5 px-5 pt-8 pb-10 md:grid-cols-[88px_1px_minmax(0,1fr)] md:gap-y-0 md:px-12 md:pt-12">
            <div className="flex items-baseline gap-3 md:flex-col md:items-start md:gap-2.5">
              <span className="mono text-[11px] tracking-[0.2em] text-soft">MOVE</span>
              <span className="mono text-[2.2rem] leading-[0.86] font-bold tracking-[-0.02em] md:text-[2.6rem]">
                {pad(move)}
              </span>
              <span aria-hidden="true" className="hidden h-[3px] w-7 bg-ochre md:mt-1 md:block" />
            </div>

            <div aria-hidden="true" className="hidden bg-rule md:block" />

            <div className="min-w-0 md:pl-9">
              {screen.kind === "question" ? (
                <QuestionPanel
                  promptId={screen.questionKey}
                  prompt={screen.prompt}
                  options={screen.options}
                  selectedKey={selectedKey}
                  onSelect={handleSelect}
                  locked={submitted || isProcessing}
                />
              ) : (
                <ToolInventoryPanel
                  inventory={screen.inventory}
                  channel={channel}
                  locked={submitted || isProcessing}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className="relative z-40 flex h-[72px] shrink-0 items-center justify-between gap-4 border-t border-rule px-5 md:h-[76px] md:px-12">
        <Link
          href={backHref}
          aria-disabled={isProcessing || undefined}
          tabIndex={isProcessing ? -1 : undefined}
          onClick={(event) => {
            if (isProcessing) event.preventDefault();
          }}
          className={cn(
            "mono flex h-11 items-center border border-[#bcc3ca] bg-sheet px-5 text-[11.5px] font-semibold tracking-[0.13em] text-ink uppercase transition-colors duration-150 md:h-12 md:px-6",
            isProcessing
              ? "pointer-events-none opacity-40 cursor-wait"
              : "hover:bg-paper",
          )}
        >
          Back
        </Link>

        <span className="mono hidden text-[11px] tracking-[0.14em] text-soft md:block">
          {isNextProcessing
            ? "STORING YOUR RECORD \u00b7 PLEASE WAIT\u2026"
            : isSkipProcessing
              ? "STORING SKIP DECISION \u00b7 PLEASE WAIT\u2026"
              : screen.kind === "question"
                ? undecided
                  ? "SELECT AN OPTION OR SKIP TO CONTINUE"
                  : "PRESS 1\u20134 TO SELECT \u00b7 S TO SKIP \u00b7 ENTER TO CONTINUE"
                : "SEARCH OR FILTER \u00b7 ENTER TO CONTINUE"}
        </span>

        <div className="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isProcessing || blocked || submitted}
            aria-label="Skip question"
            aria-busy={isSkipProcessing || undefined}
            className={cn(
              "mono relative overflow-hidden h-11 px-3 text-[11.5px] font-semibold tracking-[0.13em] uppercase transition-all duration-150 md:h-12 md:px-3.5",
              isSkipProcessing
                ? "flex items-center gap-2 border border-navy bg-[#16293f] text-white shadow-sm cursor-wait"
                : isProcessing || blocked || submitted
                  ? "cursor-not-allowed text-soft/40 pointer-events-none"
                  : "text-soft hover:text-ink hover:underline",
            )}
          >
            {isSkipProcessing ? (
              <>
                <ParticleFlow active={true} count={36} variant="ochre" />
                <div className="relative z-10 flex items-center gap-2">
                  <ButtonLoader size={15} />
                  <span>Skipping…</span>
                </div>
              </>
            ) : (
              <>
                Skip<span className="hidden sm:inline"> question</span>
              </>
            )}
          </button>

          {move < total ? (
            <Link
              href={nextHref}
              onClick={handleNextClick}
              aria-disabled={advanceBlocked && !isNextProcessing ? "true" : undefined}
              tabIndex={advanceBlocked && !isNextProcessing ? -1 : undefined}
              aria-label={`Next move ${pad(move + 1)}`}
              aria-busy={isNextProcessing || undefined}
              className={cn(
                "mono relative overflow-hidden flex h-11 items-center gap-3 border px-5 text-[11.5px] font-semibold tracking-[0.13em] uppercase transition-all duration-150 md:h-12 md:px-6",
                isNextProcessing
                  ? "border-navy bg-[#16293f] text-white cursor-wait shadow-sm"
                  : advanceBlocked
                    ? "pointer-events-none border-rule bg-rule text-soft"
                    : "border-navy bg-navy text-white hover:bg-[#16293f]",
              )}
            >
              {isNextProcessing ? (
                <>
                  <ParticleFlow active={true} count={42} />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <ButtonLoader size={16} />
                    <span>{isSavingAnswer ? "Saving move…" : isNavigating ? "Moving next…" : "Next move"}</span>
                    <b className="mono border-l border-white/30 pl-3 text-[12px] font-normal tracking-normal text-navy-soft/85">
                      {pad(move + 1)}
                    </b>
                  </div>
                </>
              ) : (
                <>
                  Next move
                  <b className="mono border-l border-white/30 pl-3 text-[12px] font-normal tracking-normal text-navy-soft/75">
                    {pad(move + 1)}
                  </b>
                </>
              )}
            </Link>
          ) : (
            <Link
              href="/assessment/confirm"
              onClick={handleNextClick}
              aria-disabled={advanceBlocked && !isNextProcessing ? "true" : undefined}
              tabIndex={advanceBlocked && !isNextProcessing ? -1 : undefined}
              aria-label="Review & submit"
              aria-busy={isNextProcessing || undefined}
              className={cn(
                "mono relative overflow-hidden flex h-11 items-center gap-2.5 border px-5 text-[11.5px] font-semibold tracking-[0.13em] uppercase transition-all duration-150 md:h-12 md:px-6",
                isNextProcessing
                  ? "border-navy bg-[#16293f] text-white cursor-wait shadow-sm"
                  : advanceBlocked
                    ? "pointer-events-none border-rule bg-rule text-soft"
                    : "border-navy bg-navy text-white hover:bg-[#16293f]",
              )}
            >
              {isNextProcessing ? (
                <>
                  <ParticleFlow active={true} count={42} />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <ButtonLoader size={16} />
                    <span>Saving &amp; reviewing…</span>
                  </div>
                </>
              ) : (
                <>Review &amp; submit</>
              )}
            </Link>
          )}
        </div>
      </footer>
    </Sheet>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
