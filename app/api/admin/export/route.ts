import { SECTIONS } from "@/lib/assessment/sections";
import { primaryAgentOption, usageDepthOption } from "@/lib/assessment/tool-inventory";
import { requireAdmin } from "@/lib/admin-auth";
import { isSectionReport, listForExport, type StoredReport } from "@/lib/admin/queries";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The shortlist as a spreadsheet.
 *
 * Every cell is quoted and the free-text columns are neutralised, because the content of this file
 * is candidate-supplied: a cell beginning with `=` or `@` is a formula to Excel and Sheets, and an
 * export that a candidate can weaponise against the reviewer's machine is worse than no export.
 */
export async function GET() {
  await requireAdmin();

  const rows = await listForExport();

  const header = [
    "candidate",
    "email",
    "status",
    "started_at",
    "submitted_at",
    "total_score",
    "band",
    ...SECTIONS.map((section) => `section_${section.id}`),
    "strongest",
    "needs_development",
    "risk_flag_count",
    "tools_named",
    "top_three",
    "primary_agent",
    "usage_depth",
    "real_world_example",
  ];

  const lines = [header.map(cell).join(",")];

  for (const row of rows) {
    const report = row.resultDetail;
    const sectionReport = report && isSectionReport(report) ? report : null;

    // Section ids key the stored competencyScores object. Records filed under the retired
    // competency model leave these cells blank rather than mixing two vocabularies in one column.
    const sectionScores = SECTIONS.map((section) => {
      const stored = row.competencyScores?.[section.id];
      return stored ? String(stored.normalized) : "";
    });

    lines.push(
      [
        row.firstName,
        row.email,
        row.status === "submitted" ? "filed" : "in progress",
        formatTimestamp(row.startedAt),
        row.submittedAt ? formatTimestamp(row.submittedAt) : "",
        row.totalScore === null ? "" : String(row.totalScore),
        sectionReport?.band.label ?? "",
        ...sectionScores,
        namesFor(strongestIds(report), report),
        namesFor(needsIds(report), report),
        riskFlagCount(report),
        row.tools ?? "",
        row.topThree ?? "",
        agentLabel(row.primaryAgentKey, row.primaryAgentOther),
        usageDepthOption(row.usageDepth)?.label ?? "",
        row.realWorldExample ?? "",
      ]
        .map(cell)
        .join(","),
    );
  }

  const filename = `assessments-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function strongestIds(report: StoredReport | null): string[] {
  return report?.strongest ?? [];
}

function needsIds(report: StoredReport | null): string[] {
  if (!report) return [];
  return isSectionReport(report) ? report.weakest : report.needsValidation;
}

/** Blank when record predates or postdates the flagged competency model, else the count. */
function riskFlagCount(report: StoredReport | null): string {
  if (!report || isSectionReport(report)) return "";
  return String(report.riskFindings.length);
}

function namesFor(ids: string[], report: StoredReport | null): string {
  if (!report) return "";
  const names = isSectionReport(report) ? report.sections : report.competencies;
  return ids.map((id) => names.find((entry) => entry.id === id)?.name ?? id).join("; ");
}

function agentLabel(key: string | null, other: string | null): string {
  if (!key) return "";
  if (key === "other") return other ?? "Other";
  return primaryAgentOption(key)?.label ?? key;
}

/** RFC 4180 quoting, plus a guard against a cell being read as a formula. */
function cell(value: string): string {
  const neutralised = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${neutralised.replace(/"/g, '""')}"`;
}
