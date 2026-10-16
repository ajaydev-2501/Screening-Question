import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SubmitButton } from "@/components/assessment/submit-button";
import { SkipMark } from "@/components/scoresheet/marks";
import { Sheet, SheetHeader } from "@/components/scoresheet/sheet";
import { TOTAL_SCREEN_COUNT } from "@/lib/assessment/questions";
import {
  isInventoryComplete,
  loadAssessmentState,
  type AssessmentState,
} from "@/lib/assessment/service";
import { TOOLS_BY_KEY } from "@/lib/assessment/tool-catalog";
import {
  INVENTORY_TITLES,
  REAL_WORLD_EXAMPLE_MIN_LENGTH,
  primaryAgentOption,
  usageDepthOption,
} from "@/lib/assessment/tool-inventory";
import { readCandidateSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The review before filing.
 *
 * This is the one screen that reads the record back to the candidate in full, so it is also the one
 * screen where a missing decision is cheap to fix: every row links straight back to its move. It
 * shows the chosen option and nothing else — an option's label, never its score — and the wording
 * around the submit button says what filing means rather than urging the candidate on.
 */
export default async function ConfirmPage() {
  const session = await readCandidateSession();
  if (!session) redirect("/");

  const state = await loadAssessmentState(session.assessmentId);
  if (!state) redirect("/");
  if (state.status === "submitted") redirect("/assessment/submitted");

  const rows = reviewRows(state);
  const outstanding = rows.filter((row) => row.outstanding).length;

  return (
    <Sheet>
      <SheetHeader>
        <span className="mono hidden shrink-0 border-l border-rule pl-4 text-[11px] tracking-[0.13em] text-soft whitespace-nowrap md:block">
          REVIEW BEFORE FILING
        </span>
      </SheetHeader>

      <main className="flex-1 px-5 py-10 md:px-12 md:py-14">
        <div className="mx-auto w-full max-w-[880px]">
          <h2 className="max-w-[26ch] text-[1.75rem] leading-[1.15] font-medium tracking-[-0.02em] text-balance md:text-[2.2rem]">
            The sheet, as it stands.
          </h2>
          <p className="mt-4 max-w-[66ch] text-[15px] leading-[1.6] text-soft">
            Read your twenty-one moves back before you file them. Nothing is final yet — use Change
            to return to any move. Once the record is filed it can no longer be edited.
          </p>

          {outstanding > 0 ? (
            <div
              role="alert"
              className="mt-7 border border-flag/35 bg-flag/8 px-5 py-4"
            >
              <p className="text-[13.5px] font-semibold tracking-[0.01em] text-flag">
                {outstanding === 1
                  ? "One move has no decision yet."
                  : `${outstanding} moves have no decision yet.`}
              </p>
              <p className="mt-1 max-w-[66ch] text-[13px] leading-[1.55] text-ink">
                A record is only filed whole. Return to the marked moves below and answer or skip
                them, then come back here.
              </p>
            </div>
          ) : null}

          <ol className="mt-8 list-none border border-rule">
            {rows.map((row) => (
              <li
                key={row.move}
                className="border-t border-rule first:border-t-0"
              >
                <div className="grid grid-cols-[34px_minmax(0,1fr)_58px] items-start gap-x-4 px-5 py-4 md:grid-cols-[40px_minmax(0,1fr)_64px] md:px-6">
                  <span className="mono pt-px text-[13px] font-bold tabular-nums">
                    {String(row.move).padStart(2, "0")}
                  </span>

                  <div className="min-w-0">
                    <p className="max-w-[70ch] text-[13.5px] leading-[1.5] text-ink">
                      {row.prompt}
                    </p>
                    <div className="mt-2 text-[13px] leading-[1.55]">{row.detail}</div>
                  </div>

                  <Link
                    href={row.href}
                    className="mono justify-self-end pt-px text-[11px] tracking-[0.12em] text-soft uppercase underline-offset-4 transition-colors duration-150 hover:text-navy hover:underline"
                  >
                    Change
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-rule px-5 py-4 md:min-h-[76px] md:px-12">
        <Link
          href={`/assessment?move=${TOTAL_SCREEN_COUNT}`}
          className="mono flex h-11 items-center border border-[#bcc3ca] bg-sheet px-5 text-[11.5px] font-semibold tracking-[0.13em] text-ink uppercase transition-colors duration-150 hover:bg-paper md:h-12 md:px-6"
        >
          Back to the sheet
        </Link>

        <span className="mono hidden text-[11px] tracking-[0.14em] text-soft xl:block">
          FILING IS FINAL &middot; THE RECORD CANNOT BE EDITED AFTERWARDS
        </span>

        <SubmitButton blocked={outstanding > 0} />
      </footer>
    </Sheet>
  );
}

type ReviewRow = {
  move: number;
  prompt: string;
  detail: ReactNode;
  href: string;
  outstanding: boolean;
};

function reviewRows(state: AssessmentState): ReviewRow[] {
  const rows: ReviewRow[] = state.screens.flatMap((screen) => {
    if (screen.kind !== "question") return [];

    const chosen = state.answers[screen.question.key];
    const option = screen.question.options.find((o) => o.key === chosen);
    const skipped = state.skippedKeys.includes(screen.question.key);

    return [
      {
        move: screen.move,
        prompt: screen.question.prompt,
        href: `/assessment?move=${screen.move}`,
        outstanding: !option && !skipped,
        detail: option ? (
          <span className="flex items-baseline gap-2.5 text-ink">
            <span className="mono shrink-0 border border-rule px-[5px] py-px text-[11px] font-bold">
              {option.letter}
            </span>
            <span>{option.label}</span>
          </span>
        ) : skipped ? (
          <Skipped label="Skipped." />
        ) : (
          <Outstanding label="No decision recorded" />
        ),
      },
    ];
  });

  rows.push(inventoryRow(state));
  return rows;
}

function inventoryRow(state: AssessmentState): ReviewRow {
  const inventory = state.inventory;
  const complete = isInventoryComplete(inventory);
  const skipped = inventory.skipped && !complete;

  const topThree = inventory.productivityTools.map((tool) => toolLabel(tool.toolKey, tool.customName));
  const primary = primaryAgentOption(inventory.primaryAgentKey);
  const depth = usageDepthOption(inventory.usageDepthKey);
  const example = inventory.realWorldExample?.trim() ?? "";

  const missing = skipped
    ? []
    : [
        primary ? null : "your primary AI coding agent",
        depth ? null : "how you typically use it",
        example.length < REAL_WORLD_EXAMPLE_MIN_LENGTH ? "the written example" : null,
      ].filter((entry) => entry !== null);

  return {
    move: TOTAL_SCREEN_COUNT,
    prompt: INVENTORY_TITLES.question,
    href: `/assessment?move=${TOTAL_SCREEN_COUNT}`,
    outstanding: !complete && !inventory.skipped,
    detail: (
      <div className="space-y-1 text-soft">
        <p className="text-ink">
          {inventory.selections.length === 0
            ? "No tools selected."
            : `${inventory.selections.length} ${
                inventory.selections.length === 1 ? "tool" : "tools"
              } selected${
                topThree.length > 0 ? ` — top three: ${topThree.join(", ")}` : ""
              }.`}
        </p>
        <p>Primary agent: {primary ? primary.label : "not answered"}</p>
        {depth ? <p>Typical use: {depth.label}</p> : null}
        {example.length > 0 ? (
          <p>
            Example written: {example.length.toLocaleString("en-US")} characters.
          </p>
        ) : null}
        {skipped ? (
          <p className="pt-0.5">
            <Skipped label="Skipped — the follow-up questions were declined." />
          </p>
        ) : null}
        {missing.length > 0 ? (
          <p className="pt-0.5">
            <Outstanding label={`Still needed: ${joinList(missing)}.`} />
          </p>
        ) : null}
      </div>
    ),
  };
}

function Outstanding({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 text-ochre">
      <span aria-hidden="true" className="block size-[10px] shrink-0 border border-dashed border-ochre" />
      {label}
    </span>
  );
}

function Skipped({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 text-soft">
      <SkipMark />
      {label}
    </span>
  );
}

function toolLabel(toolKey: string, customName: string | null): string {
  if (customName) return customName;
  return TOOLS_BY_KEY.get(toolKey)?.name ?? toolKey;
}

function joinList(entries: string[]): string {
  if (entries.length <= 1) return entries[0] ?? "";
  return `${entries.slice(0, -1).join(", ")} and ${entries[entries.length - 1]}`;
}

export const metadata = {
  title: "Review · AI Engineering Developer Assessment",
};
