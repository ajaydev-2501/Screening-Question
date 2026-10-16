import Link from "next/link";

import { SCORED_QUESTION_COUNT } from "@/lib/assessment/questions";
import { requireAdmin } from "@/lib/admin-auth";
import {
  LIST_LIMIT_HINT,
  listAssessments,
  type AdminListFilters,
  type AdminSort,
  type AdminStatus,
} from "@/lib/admin/queries";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = new Set<AdminStatus>(["all", "submitted", "in_progress"]);
const SORTS = new Set<AdminSort>(["submitted", "score", "name", "activity"]);

const STATUS_OPTIONS: { value: AdminStatus; label: string }[] = [
  { value: "all", label: "All records" },
  { value: "submitted", label: "Filed only" },
  { value: "in_progress", label: "In progress only" },
];

export default async function AdminRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const filters = parseFilters(await searchParams);
  const rows = await listAssessments(filters);

  return (
    <main className="flex-1 px-5 py-8 md:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[1.5rem] leading-[1.2] font-medium tracking-[-0.02em] md:text-[1.7rem]">
            Candidate records
          </h2>
          <p className="mt-2 text-[13.5px] leading-[1.55] text-soft">
            {rows.length === 0
              ? "Nothing matches the current filter."
              : `${rows.length}${rows.length === LIST_LIMIT_HINT ? "+" : ""} ${
                  rows.length === 1 ? "record" : "records"
                }${rows.length === LIST_LIMIT_HINT ? ` (first ${LIST_LIMIT_HINT} — narrow the filter or export the CSV)` : ""}.`}
          </p>
        </div>

        <form method="get" action="/admin" className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Search name or email"
            aria-label="Search candidates"
            className="h-10 w-[220px] border border-rule bg-sheet px-3 text-[14px] text-ink placeholder:text-soft focus:border-ochre focus:outline-none"
          />
          <select
            name="status"
            defaultValue={filters.status}
            aria-label="Filter by status"
            className="mono h-10 border border-rule bg-sheet px-2.5 text-[11.5px] tracking-[0.06em] text-ink focus:border-ochre focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input type="hidden" name="sort" value={filters.sort} />
          <input type="hidden" name="dir" value={filters.direction} />

          <button
            type="submit"
            className="mono h-10 border border-navy bg-navy px-4 text-[11.5px] font-semibold tracking-[0.12em] text-white uppercase transition-colors duration-150 hover:bg-[#16293f]"
          >
            Apply
          </button>

          {hasFilters(filters) ? (
            <Link
              href="/admin"
              className="mono h-10 border border-rule px-4 text-[11.5px] leading-[38px] tracking-[0.12em] text-soft uppercase transition-colors duration-150 hover:border-navy hover:text-navy"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <div className="relative mt-7 overflow-x-auto border border-rule">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-rule bg-paper/60">
              <SortHeader filters={filters} sort="name" label="Candidate" className="w-[26%]" />
              <th className="mono px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                Status
              </th>
              <SortHeader filters={filters} sort="submitted" label="Filed" />
              <SortHeader filters={filters} sort="score" label="Score" className="text-right" />
              <SortHeader filters={filters} sort="activity" label="Last activity" />
              <th className="mono px-4 py-2.5 text-right text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                Moves
              </th>
              <th className="mono px-4 py-2.5 text-right text-[10.5px] font-normal tracking-[0.16em] text-soft uppercase">
                Tools
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-[14px] text-soft">
                  No records match this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-rule transition-colors duration-150 hover:bg-paper/70"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/candidates/${row.id}`}
                      className="text-[14.5px] font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {row.firstName}
                    </Link>
                    <span className="mt-0.5 block text-[12px] text-soft">{row.email}</span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "mono inline-flex border px-2 py-0.5 text-[10.5px] tracking-[0.12em] uppercase",
                        row.status === "submitted"
                          ? "border-certified text-certified"
                          : "border-rule text-soft",
                      )}
                    >
                      {row.status === "submitted" ? "Filed" : "In progress"}
                    </span>
                  </td>

                  <td className="mono px-4 py-3 text-[12px] whitespace-nowrap text-soft">
                    {formatTimestamp(row.submittedAt)}
                  </td>

                  <td className="mono px-4 py-3 text-right text-[15px] font-bold tabular-nums">
                    {row.totalScore ?? "\u2014"}
                  </td>

                  <td className="mono px-4 py-3 text-[12px] whitespace-nowrap text-soft">
                    {formatTimestamp(row.lastActivityAt)}
                  </td>

                  <td className="mono px-4 py-3 text-right text-[12.5px] tabular-nums text-soft">
                    {row.answeredCount}/{SCORED_QUESTION_COUNT}
                  </td>

                  <td className="mono px-4 py-3 text-right text-[12.5px] tabular-nums text-soft">
                    {row.toolCount}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/candidates/${row.id}`}
                      className="mono text-[11px] tracking-[0.12em] text-soft uppercase underline-offset-4 transition-colors duration-150 hover:text-navy hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function hasFilters(filters: AdminListFilters): boolean {
  return filters.query.length > 0 || filters.status !== "all";
}

function SortHeader({
  filters,
  sort,
  label,
  className,
}: {
  filters: AdminListFilters;
  sort: AdminSort;
  label: string;
  className?: string;
}) {
  const active = filters.sort === sort;
  const nextDirection = active && filters.direction === "desc" ? "asc" : "desc";

  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.status !== "all") params.set("status", filters.status);
  params.set("sort", sort);
  params.set("dir", nextDirection);

  return (
    <th
      className={cn(
        "mono px-4 py-2.5 text-[10.5px] font-normal tracking-[0.16em] uppercase",
        className,
      )}
    >
      <Link
        href={`/admin?${params.toString()}`}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-navy",
          active ? "text-ink" : "text-soft",
        )}
      >
        {label}
        <span aria-hidden="true" className="text-[9px]">
          {active ? (filters.direction === "desc" ? "\u25bc" : "\u25b2") : "\u2195"}
        </span>
        <span className="sr-only">
          {active
            ? filters.direction === "desc"
              ? "sorted descending, activate for ascending"
              : "sorted ascending, activate for descending"
            : "not sorted"}
        </span>
      </Link>
    </th>
  );
}

/** Filters come from the URL, so every one is checked against its closed set before it is used. */
function parseFilters(
  params: Record<string, string | string[] | undefined>,
): AdminListFilters {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const status = one("status");
  const sort = one("sort");

  return {
    status: status && STATUSES.has(status as AdminStatus) ? (status as AdminStatus) : "all",
    sort: sort && SORTS.has(sort as AdminSort) ? (sort as AdminSort) : "submitted",
    direction: one("dir") === "asc" ? "asc" : "desc",
    query: (one("q") ?? "").slice(0, 80),
  };
}

export const metadata = {
  title: "Records · AI Engineering Developer Assessment",
  robots: { index: false, follow: false },
};
