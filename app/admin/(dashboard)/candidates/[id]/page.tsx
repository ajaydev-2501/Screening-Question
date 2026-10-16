import Link from "next/link";
import { notFound } from "next/navigation";

import { SkillRadar } from "@/components/admin/skill-radar";
import { SkipMark } from "@/components/scoresheet/marks";
import { SCORED_QUESTION_COUNT } from "@/lib/assessment/questions";
import { ASSESSMENT_BANDS } from "@/lib/assessment/scoring";
import { isInventoryComplete } from "@/lib/assessment/service";
import { TOOLS_BY_KEY } from "@/lib/assessment/tool-catalog";
import { primaryAgentOption, usageDepthOption } from "@/lib/assessment/tool-inventory";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getAssessmentDetail,
  isSectionReport,
  type StoredReport,
  type StoredReportV2,
  type StoredReportV3,
} from "@/lib/admin/queries";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One candidate's record, in full.
 *
 * This is the only screen in the product that shows the rubric: per-answer scores, the section
 * radar with its strongest-skill callout, and — on records filed under the retired competency
 * model — the evaluation notes, risk flags and interview follow-ups. It is behind `requireAdmin()`,
 * is never cached, and is not linked from anywhere a candidate can reach.
 */
export default async function CandidateRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const record = await getAssessmentDetail(id);
  if (!record) notFound();

  const report = record.resultDetail;
  const sectionReport = report && isSectionReport(report) ? report : null;
  const filed = record.status === "submitted";
  const skippedCount = record.answers.filter((answer) => answer.skipped).length;
  // Complete wins, as everywhere else: the skip note only shows when the follow-ups are actually
  // outstanding, so a fully-written inventory is never labeled declined.
  const inventorySkipped =
    record.inventory.skipped &&
    !isInventoryComplete({
      primaryAgentKey: record.inventory.primaryAgentKey,
      usageDepthKey: record.inventory.usageDepth,
      realWorldExample: record.inventory.realWorldExample,
    });

  return (
    <main className="flex-1 px-5 py-8 md:px-7">
      <Link
        href="/admin"
        className="mono text-[11px] tracking-[0.12em] text-soft uppercase underline decoration-rule underline-offset-4 transition-colors duration-150 hover:text-navy hover:decoration-navy"
      >
        All records
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-rule pb-6">
        <div className="min-w-0">
          <h2 className="text-[1.6rem] leading-[1.15] font-medium tracking-[-0.02em] md:text-[2rem]">
            {record.firstName}
          </h2>
          <p className="mt-1.5 text-[14px] text-soft">{record.email}</p>
          <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span
              className={cn(
                "mono border px-2 py-0.5 text-[10.5px] tracking-[0.12em] uppercase",
                filed ? "border-certified text-certified" : "border-ochre text-ochre",
              )}
            >
              {filed ? "Filed" : "In progress"}
            </span>
            <span className="mono text-[11.5px] tracking-[0.1em] text-soft">
              STARTED {formatTimestamp(record.startedAt)}
            </span>
            <span className="mono text-[11.5px] tracking-[0.1em] text-soft">
              FILED {formatTimestamp(record.submittedAt)}
            </span>
          </p>
        </div>

        <div className="shrink-0 border border-rule px-6 py-4 text-right">
          <p className="mono text-[10.5px] tracking-[0.18em] text-soft uppercase">Total score</p>
          <p className="mono mt-1.5 text-[2.4rem] leading-none font-bold tabular-nums">
            {record.totalScore ?? "\u2014"}
            <span className="text-[15px] font-normal text-soft">
              {" "}
              / {sectionReport ? 80 : 100}
            </span>
          </p>
          {sectionReport ? (
            <>
              <p className="mono mt-2.5 text-[10.5px] tracking-[0.12em] text-soft uppercase">
                {sectionReport.band.label}
              </p>
              <p className="mt-1.5 ml-auto max-w-[210px] text-[10.5px] leading-[1.45] text-soft">
                Preliminary screening band — not a validated benchmark.
              </p>
            </>
          ) : null}
          <p className="mono mt-2 text-[10.5px] tracking-[0.12em] text-soft">
            {record.answers.length}/{SCORED_QUESTION_COUNT} MOVES &middot;{" "}
            {record.inventory.selections.length} TOOLS
            {skippedCount > 0 ? ` \u00b7 ${skippedCount} SKIPPED` : ""}
          </p>
        </div>
      </div>

      {!filed ? (
        <p className="mt-6 border border-rule bg-paper/60 px-5 py-4 text-[13.5px] leading-[1.6] text-soft">
          This candidate has not filed the record. Scores are computed at submission, so nothing on
          this page is final — the answers below are what has been saved so far.
        </p>
      ) : null}

      {report ? <Report report={report} /> : null}

      <Section title="Answers" note={`${record.answers.length} of ${SCORED_QUESTION_COUNT} recorded`}>
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule bg-paper/60">
                <th className="mono w-[52px] px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                  #
                </th>
                <th className="mono px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                  Question
                </th>
                <th className="mono px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                  Chosen
                </th>
                {filed ? (
                  <th className="mono px-4 py-2.5 text-right text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                    Score
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {record.answers.map((answer) => (
                <tr key={answer.questionKey} className="border-t border-rule align-top">
                  <td className="mono px-4 py-3 text-[12px] text-soft">
                    {answer.position === null
                      ? "\u2014"
                      : String(answer.position).padStart(2, "0")}
                  </td>
                  <td className="max-w-[46ch] px-4 py-3 text-[13px] leading-[1.5] text-ink">
                    {answer.prompt ?? answer.questionKey}
                    {answer.riskFlags.length > 0 ? (
                      <span className="mono mt-1.5 block text-[10.5px] tracking-[0.1em] text-flag uppercase">
                        Flagged: {answer.riskFlags.join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[46ch] px-4 py-3 text-[13px] leading-[1.5] text-soft">
                    {answer.skipped ? (
                      <span className="flex items-center gap-2">
                        <SkipMark />
                        Skipped
                      </span>
                    ) : (
                      <>
                        <span className="mono mr-2 border border-rule px-[5px] py-px text-[11px] font-bold text-ink">
                          {answer.letter}
                        </span>
                        {answer.label}
                      </>
                    )}
                  </td>
                  {filed ? (
                    <td className="mono px-4 py-3 text-right text-[14px] font-bold tabular-nums">
                      {answer.skipped ? (sectionReport ? 1 : 0) : (answer.score ?? "\u2014")}
                      <span className="text-[11px] font-normal text-soft">
                        /{sectionReport ? 4 : 3}
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Tool inventory" note={`${record.inventory.selections.length} tools named`}>
        <div className="border border-rule">
          {inventorySkipped ? (
            <Row label="Status">
              <span className="flex items-center gap-2 text-[13.5px] text-soft">
                <SkipMark />
                Skipped — the follow-up questions were declined.
              </span>
            </Row>
          ) : null}

          <Row label="Top three">
            {record.inventory.topThree.length === 0 ? (
              <span className="text-soft">None ranked.</span>
            ) : (
              <ol className="space-y-1">
                {record.inventory.topThree.map((tool, index) => (
                  <li key={tool.toolKey} className="text-[13.5px] text-ink">
                    <span className="mono mr-2 text-[11px] text-soft">{index + 1}.</span>
                    {toolLabel(tool.toolKey, tool.customName)}
                  </li>
                ))}
              </ol>
            )}
          </Row>

          <Row label="Primary agent">
            <span className="text-[13.5px] text-ink">
              {agentLabel(record.inventory.primaryAgentKey, record.inventory.primaryAgentOther)}
            </span>
          </Row>

          <Row label="Typical use">
            <span className="text-[13.5px] text-ink">
              {usageDepthOption(record.inventory.usageDepth)?.label ?? "Not answered."}
            </span>
          </Row>

          <Row label="Tools named">
            {record.inventory.selections.length === 0 ? (
              <span className="text-[13.5px] text-soft">
                None — the catalog holds 319 tools and they selected none of them.
              </span>
            ) : (
              <p className="text-[13.5px] leading-[1.7] text-ink">
                {record.inventory.selections
                  .map((tool) => toolLabel(tool.toolKey, tool.customName))
                  .join(", ")}
              </p>
            )}
          </Row>

          <Row label="Real-world example">
            {record.inventory.realWorldExample ? (
              <p className="max-w-[86ch] text-[14px] leading-[1.65] whitespace-pre-wrap text-ink">
                {record.inventory.realWorldExample}
              </p>
            ) : (
              <span className="text-[13.5px] text-soft">Not written.</span>
            )}
          </Row>
        </div>
      </Section>
    </main>
  );
}

function Report({ report }: { report: StoredReport }) {
  return isSectionReport(report) ? (
    <SectionProfile report={report} />
  ) : (
    <CompetencyReport report={report} />
  );
}

/**
 * Records filed under the current section model: the radar is the headline, the table beside it
 * is the source of record, and the callout names the strongest section.
 */
function SectionProfile({ report }: { report: StoredReportV3 }) {
  const best = report.sections.filter((section) => report.strongest.includes(section.id));
  const allTied = report.strongest.length === report.sections.length;

  return (
    <>
      <Section title="Skill profile" note="Each section normalized to 100; the total is the raw sum out of 80">
        <div className="grid gap-6 border border-rule px-5 py-5 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8">
          <div className="min-w-0">
            <div className="border border-rule bg-paper/60 px-5 py-4">
              <p className="mono text-[10.5px] tracking-[0.18em] text-soft uppercase">
                {allTied ? "Strongest skill" : best.length > 1 ? "Strongest skills (tie)" : "Strongest skill"}
              </p>
              {allTied ? (
                <>
                  <p className="mt-2 text-[15px] leading-[1.35] font-medium text-ink">
                    Every section scored equally.
                  </p>
                  <p className="mono mt-1.5 text-[12px] text-soft">
                    {report.sections[0]?.normalized ?? 0}% across the board
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[15px] leading-[1.35] font-medium text-ink">
                    {best.map((section) => section.name).join(" · ")}
                  </p>
                  <p className="mono mt-1.5 text-[12px] text-soft">
                    {best[0]?.normalized ?? 0}% normalized
                  </p>
                </>
              )}
            </div>
            <SkillRadar
              className="mx-auto mt-5 max-w-[320px]"
              axes={report.sections.map((section) => ({
                label: section.shortName,
                value: section.normalized,
              }))}
            />
          </div>

          <div className="min-w-0 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule bg-paper/60">
                  <th className="mono px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                    Section
                  </th>
                  <th className="mono px-4 py-2.5 text-right text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                    Earned
                  </th>
                  <th className="mono px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                    Normalized
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.sections.map((section) => (
                  <tr key={section.id} className="border-t border-rule">
                    <td className="px-4 py-3 text-[13.5px] text-ink">{section.name}</td>
                    <td className="mono px-4 py-3 text-right text-[12.5px] tabular-nums text-soft">
                      {section.earned}/{section.available}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-[6px] min-w-[120px] flex-1 bg-rule/50">
                          <div
                            className="h-full bg-navy"
                            style={{ width: `${section.normalized}%` }}
                          />
                        </div>
                        <span className="mono w-[34px] shrink-0 text-right text-[13px] font-bold tabular-nums">
                          {section.normalized}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <div className="mt-8">
        <Panel
          title="Needs development"
          emptiness="Every section scored equally."
          entries={
            allTied
              ? []
              : report.weakest.map((id) => sectionName(report, id))
          }
          tone="ochre"
        />
      </div>

      <p className="mt-6 max-w-[88ch] text-[12px] leading-[1.6] text-soft">
        Screening bands: {ASSESSMENT_BANDS.map((band) => `${band.label} ${band.min}\u2013${band.max}`).join(" \u00b7 ")}.
        This record landed in <strong className="font-medium text-ink">{report.band.label}</strong>. These
        are preliminary screening bands, not validated benchmarks — they describe the workflow a
        candidate reported, not measured performance.
      </p>
    </>
  );
}

function CompetencyReport({ report }: { report: StoredReportV2 }) {
  return (
    <>
      <Section title="Skill profile" note="Each competency normalized to 100">
        <div className="max-w-[380px] border border-rule px-5 py-5">
          <SkillRadar
            axes={report.competencies.map((competency) => ({
              label: competency.shortName,
              value: competency.normalized,
            }))}
          />
        </div>
      </Section>

      <Section title="Competency scores" note="Weighted; each competency normalized to 100 then combined">
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule bg-paper/60">
                <th className="mono px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                  Competency
                </th>
                <th className="mono px-4 py-2.5 text-right text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                  Weight
                </th>
                <th className="mono px-4 py-2.5 text-right text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                  Earned
                </th>
                <th className="mono px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                  Normalized
                </th>
              </tr>
            </thead>
            <tbody>
              {report.competencies.map((competency) => (
                <tr key={competency.id} className="border-t border-rule">
                  <td className="px-4 py-3 text-[13.5px] text-ink">{competency.name}</td>
                  <td className="mono px-4 py-3 text-right text-[12.5px] tabular-nums text-soft">
                    {Math.round(competency.weight * 100)}%
                  </td>
                  <td className="mono px-4 py-3 text-right text-[12.5px] tabular-nums text-soft">
                    {competency.earned}/{competency.available}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-[6px] min-w-[120px] flex-1 bg-rule/50">
                        <div
                          className="h-full bg-navy"
                          style={{ width: `${competency.normalized}%` }}
                        />
                      </div>
                      <span className="mono w-[34px] shrink-0 text-right text-[13px] font-bold tabular-nums">
                        {competency.normalized}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Panel
          title="Demonstrated strengths"
          emptiness="Nothing at or above 75."
          entries={report.strongest.map((id) => competencyName(report, id))}
          tone="certified"
        />
        <Panel
          title="Needs interview validation"
          emptiness="Nothing below 50."
          entries={report.needsValidation.map((id) => competencyName(report, id))}
          tone="ochre"
        />
      </div>

      <Section title="Ask in interview" note={`${report.followUps.length} generated from their answers`}>
        {report.followUps.length === 0 ? (
          <p className="border border-rule px-5 py-4 text-[13.5px] text-soft">
            No answers scored low enough to generate a follow-up question.
          </p>
        ) : (
          <ul className="list-none border border-rule">
            {report.followUps.map((followUp) => (
              <li
                key={followUp.questionKey}
                className="border-t border-rule first:border-t-0"
              >
                <div className="px-5 py-4">
                  <p className="mono text-[10.5px] tracking-[0.14em] text-soft uppercase">
                    {followUp.competencyName}
                  </p>
                  <p className="mt-2 max-w-[88ch] text-[13px] leading-[1.55] text-soft">
                    {followUp.prompt}
                  </p>
                  <p className="mt-2.5 max-w-[88ch] text-[14px] leading-[1.6] text-ink">
                    {followUp.interview}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Risk findings"
        note={`${report.riskFindings.length} answers carrying a flag`}
      >
        {report.riskFindings.length === 0 ? (
          <p className="border border-rule px-5 py-4 text-[13.5px] text-soft">
            No answer carried a risk flag.
          </p>
        ) : (
          <ul className="list-none border border-rule">
            {report.riskFindings.map((finding) => (
              <li key={finding.optionKey} className="border-t border-rule first:border-t-0">
                <div className="px-5 py-4">
                  <p className="mono text-[10.5px] tracking-[0.14em] text-soft uppercase">
                    Move {String(finding.questionPosition).padStart(2, "0")} &middot;{" "}
                    {finding.flagLabels.join(" · ")}
                  </p>
                  <p className="mt-2 max-w-[88ch] text-[13px] leading-[1.55] text-soft">
                    {finding.prompt}
                  </p>
                  <p className="mt-2 max-w-[88ch] text-[14px] leading-[1.6] text-ink">
                    <span className="mono mr-2 border border-rule px-[5px] py-px text-[11px] font-bold">
                      {finding.optionLetter}
                    </span>
                    {finding.answer}
                  </p>
                  <p className="mt-3 max-w-[88ch] border-l-2 border-flag/40 pl-3.5 text-[13px] leading-[1.6] text-soft">
                    {finding.note}
                  </p>
                  <p className="mt-2.5 max-w-[88ch] text-[13.5px] leading-[1.6] text-ink">
                    {finding.interview}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2">
        <h3 className="mono text-[11px] tracking-[0.18em] text-ink uppercase">{title}</h3>
        {note ? <span className="text-[12px] text-soft">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-rule px-5 py-4 first:border-t-0 sm:grid-cols-[150px_1fr] sm:gap-6">
      <span className="mono pt-[3px] text-[10.5px] tracking-[0.16em] text-soft uppercase">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Panel({
  title,
  entries,
  emptiness,
  tone,
}: {
  title: string;
  entries: string[];
  emptiness: string;
  tone: "certified" | "ochre";
}) {
  return (
    <div className="border border-rule">
      <h3 className="mono border-b border-rule px-5 py-2.5 text-[11px] tracking-[0.18em] text-ink uppercase">
        {title}
      </h3>
      <div className="px-5 py-4">
        {entries.length === 0 ? (
          <p className="text-[13.5px] text-soft">{emptiness}</p>
        ) : (
          <ul className="list-none space-y-2">
            {entries.map((entry) => (
              <li key={entry} className="flex items-center gap-2.5 text-[13.5px] text-ink">
                <span
                  aria-hidden="true"
                  className={cn(
                    "block size-[9px] shrink-0",
                    tone === "certified" ? "bg-certified" : "border border-dashed border-ochre",
                  )}
                />
                {entry}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function competencyName(report: StoredReportV2, id: string): string {
  return report.competencies.find((c) => c.id === id)?.name ?? id;
}

function sectionName(report: StoredReportV3, id: string): string {
  return report.sections.find((section) => section.id === id)?.name ?? id;
}

function agentLabel(key: string | null, other: string | null): string {
  if (!key) return "Not answered.";
  if (key === "other") return other ?? "Other (unnamed)";
  return primaryAgentOption(key)?.label ?? key;
}

/**
 * The catalog name for a tool key, unless the candidate named it themselves. The key is what was
 * stored, so a tool retired from a later catalog revision still resolves against this one.
 */
function toolLabel(toolKey: string, customName: string | null): string {
  if (customName) return `${customName} (other)`;
  return TOOLS_BY_KEY.get(toolKey)?.name ?? toolKey;
}
