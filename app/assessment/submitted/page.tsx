import Link from "next/link";
import { redirect } from "next/navigation";

import { Sheet, SheetHeader } from "@/components/scoresheet/sheet";
import { SCORED_QUESTION_COUNT, TOTAL_SCREEN_COUNT } from "@/lib/assessment/questions";
import { firstOpenMove, loadAssessmentState } from "@/lib/assessment/service";
import { readCandidateSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const FILED_ON = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/**
 * The filed record.
 *
 * This screen deliberately reports no score. The candidate receives a confirmation that the record
 * exists and is final and nothing else: the score is an internal screening indicator, and showing
 * it would turn a single attempt into a result to argue with. The wording says what filing means —
 * read by a person, used to plan a conversation — without implying a pass or a fail either way.
 */
export default async function SubmittedPage() {
  const session = await readCandidateSession();
  if (!session) redirect("/");

  const state = await loadAssessmentState(session.assessmentId);
  if (!state) redirect("/");

  if (state.status !== "submitted") {
    const move = firstOpenMove(state);
    redirect(move === null ? "/assessment/confirm" : `/assessment?move=${move}`);
  }

  const filedOn = FILED_ON.format(state.submittedAt ?? new Date());
  const tools = state.inventory.selections.length;

  const FACTS = [
    {
      label: "Decisions",
      value: `${state.answeredCount + state.skippedKeys.length} of ${SCORED_QUESTION_COUNT} recorded`,
    },
    {
      label: "Inventory",
      value: tools === 0 ? "No tools named" : `${tools} ${tools === 1 ? "tool" : "tools"} named`,
    },
    { label: "Moves", value: `${TOTAL_SCREEN_COUNT} of ${TOTAL_SCREEN_COUNT}` },
    { label: "Attempts", value: "One of one used" },
  ];

  return (
    <Sheet>
      <SheetHeader>
        <span className="mono hidden shrink-0 border-l border-rule pl-4 text-[11px] tracking-[0.13em] text-soft whitespace-nowrap md:block">
          RECORD FILED
        </span>
      </SheetHeader>

      <main className="flex-1 px-5 py-12 md:px-12 md:py-16">
        <div className="mx-auto w-full max-w-[640px]">
          <div className="inline-block border-2 border-certified px-7 py-4">
            <p className="mono text-[15px] leading-none font-bold tracking-[0.4em] text-certified">
              FILED
            </p>
            <p className="mono mt-2.5 text-[11px] leading-none tracking-[0.16em] text-soft">
              {filedOn}
            </p>
          </div>

          <h2 className="mt-9 max-w-[24ch] text-[1.7rem] leading-[1.16] font-medium tracking-[-0.02em] text-balance md:text-[2.1rem]">
            {state.firstName}, your record is with the hiring team.
          </h2>

          <p className="mt-5 max-w-[60ch] text-[15px] leading-[1.65] text-soft">
            Nothing further is needed from you, and the sheet can no longer be changed. An
            interviewer reads your twenty-one decisions alongside your tool inventory and uses them
            to plan a technical conversation with you.
          </p>

          <dl className="mt-10 max-w-[520px] border border-rule">
            {FACTS.map((fact) => (
              <div
                key={fact.label}
                className="grid grid-cols-[110px_1fr] gap-5 border-t border-rule px-5 py-3.5 first:border-t-0"
              >
                <dt className="mono pt-[2px] text-[11px] tracking-[0.18em] text-soft uppercase">
                  {fact.label}
                </dt>
                <dd className="text-[14px] leading-[1.5] text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 max-w-[60ch] border-t border-rule pt-7">
            <h3 className="text-[15px] font-semibold tracking-[0.01em] text-ink">
              Why there is no score here
            </h3>
            <p className="mt-3 text-[14.5px] leading-[1.6] text-soft">
              Your record produces a screening indicator for the review team only. It is not a
              measurement of your ability and it is not a pass or a fail — it exists to give the
              interviewer better questions to ask you.
            </p>
          </div>

          <p className="mt-10">
            <Link
              href="/"
              className="mono text-[11.5px] font-semibold tracking-[0.13em] text-navy uppercase underline decoration-rule underline-offset-4 transition-colors duration-150 hover:decoration-navy"
            >
              Back to the start
            </Link>
          </p>
        </div>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-5 md:px-8">
        <p className="mono text-[11px] tracking-[0.14em] text-soft uppercase">
          Every record is read by a person
        </p>
        <p className="text-[12.5px] text-soft">
          You may close this tab. Your record is stored for the hiring team only.
        </p>
      </footer>
    </Sheet>
  );
}

export const metadata = {
  title: "Record filed · AI Engineering Developer Assessment",
};
