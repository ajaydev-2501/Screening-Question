import Link from "next/link";

import { EntryForm } from "@/components/landing/entry-form";
import { Sheet, SheetHeader } from "@/components/scoresheet/sheet";
import { SCORED_QUESTION_COUNT, TOTAL_SCREEN_COUNT } from "@/lib/assessment/questions";
import { resumeSummary } from "@/lib/assessment/service";
import { readCandidateSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const CONDITIONS = [
  {
    label: "Format",
    value: `${TOTAL_SCREEN_COUNT} moves — ${SCORED_QUESTION_COUNT} scored decisions, then one tool inventory.`,
  },
  {
    label: "Clock",
    value: "None. No timer, no countdown, and nothing advances until you say so.",
  },
  {
    label: "Attempts",
    value: "One. Your question order is shuffled when you begin and saved against this browser.",
  },
  {
    label: "Saving",
    value: "Automatic, after every move. Close the tab and return here to pick up where you left off.",
  },
] as const;

export default async function LandingPage() {
  const session = await readCandidateSession();
  const summary = session ? await resumeSummary(session.assessmentId) : null;

  return (
    <Sheet>
      <SheetHeader>
        <span className="mono hidden shrink-0 border-l border-rule pl-4 text-[11px] tracking-[0.13em] text-soft whitespace-nowrap md:block">
          SINGLE ATTEMPT &middot; PROGRESS SAVED AUTOMATICALLY
        </span>
      </SheetHeader>

      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="px-6 py-12 md:px-14 md:py-16">
          <h2 className="max-w-[24ch] text-[2.1rem] leading-[1.12] font-medium tracking-[-0.02em] text-balance md:text-[3rem] md:leading-[1.08]">
            Twenty-one decisions, recorded the way you would actually make them.
          </h2>

          <p className="mt-7 max-w-[62ch] text-[16px] leading-[1.65] text-soft md:text-[17px]">
            This screening covers the full arc of building with AI coding agents: requirement
            analysis, planning and architecture, agent orchestration, testing, review and debugging,
            security and autonomy, and production ownership. Each move presents one situation and
            four responses.
          </p>

          <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.65] text-soft md:text-[17px]">
            Choose the one you would really take. The options are close together on purpose, and the
            distinction between them is usually whether you keep independent judgement over the
            work — so the answer that reads best is not automatically the one that scores best.
          </p>

          <dl className="mt-12 max-w-[640px] border border-rule">
            {CONDITIONS.map((condition) => (
              <div
                key={condition.label}
                className="grid grid-cols-1 gap-1 border-t border-rule px-5 py-4 first:border-t-0 sm:grid-cols-[110px_1fr] sm:gap-5"
              >
                <dt className="mono pt-[2px] text-[11px] tracking-[0.18em] text-soft uppercase">
                  {condition.label}
                </dt>
                <dd className="text-[14.5px] leading-[1.55] text-ink">{condition.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-12 max-w-[62ch] border-t border-rule pt-7">
            <h3 className="text-[15px] font-semibold tracking-[0.01em] text-ink">
              What happens afterwards
            </h3>
            <p className="mt-3 text-[14.5px] leading-[1.6] text-soft">
              An interviewer reads your record alongside your tool inventory and uses it to plan a
              technical conversation with you. The score is a screening indicator for that
              conversation — it is not a measurement of your ability, and no result is used to
              reject a candidate automatically.
            </p>
          </div>
        </section>

        <aside className="border-t border-rule px-6 py-12 md:py-16 lg:border-t-0 lg:border-l lg:px-8">
          {summary ? (
            <ResumePanel
              firstName={summary.firstName}
              status={summary.status}
              answeredCount={summary.answeredCount}
              move={summary.move}
            />
          ) : (
            <EntryForm />
          )}
        </aside>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-rule px-6 py-5 md:px-8">
        <p className="mono text-[11px] tracking-[0.14em] text-soft uppercase">
          Every result is read by a person
        </p>
        <p className="text-[12.5px] text-soft">
          Your answers and tool selections are visible to the hiring team only.
        </p>
      </footer>
    </Sheet>
  );
}

function ResumePanel({
  firstName,
  status,
  answeredCount,
  move,
}: {
  firstName: string;
  status: "in_progress" | "submitted";
  answeredCount: number;
  move: number;
}) {
  const submitted = status === "submitted";

  return (
    <div className="border border-rule bg-sheet">
      <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
        <h2 className="mono text-[11px] tracking-[0.18em] text-ink uppercase">
          {submitted ? "Record" : "Resume"}
        </h2>
        <span className="mono text-[11px] tracking-[0.14em] text-soft">
          MOVE {String(move).padStart(2, "0")} / {TOTAL_SCREEN_COUNT}
        </span>
      </div>

      <div className="border-b border-rule px-5 py-5">
        <p className="text-[17px] leading-[1.45] text-ink">{firstName},</p>
        <p className="mt-2 text-[14px] leading-[1.6] text-soft">
          {submitted
            ? "your record is complete and with the hiring team. Nothing further is needed from you."
            : `this browser still holds your sheet, with ${answeredCount} of ${SCORED_QUESTION_COUNT} moves answered.`}
        </p>
      </div>

      <div className="px-5 py-5">
        <Link
          href={submitted ? "/assessment/submitted" : `/assessment?move=${move}`}
          className="mono flex h-12 w-full items-center justify-center border border-navy bg-navy px-6 text-[12px] font-medium tracking-[0.14em] text-white uppercase transition-colors duration-150 hover:bg-[#16293f]"
        >
          {submitted ? "View your record" : `Continue at move ${String(move).padStart(2, "0")}`}
        </Link>
        <p className="mt-4 text-[12.5px] leading-[1.55] text-soft">
          Progress is stored in this browser only. On a different device, contact the hiring team.
        </p>
      </div>
    </div>
  );
}
