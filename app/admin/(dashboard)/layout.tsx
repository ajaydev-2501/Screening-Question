import Link from "next/link";

import { leaveAssessment } from "@/app/actions";
import { adminLogout } from "@/app/admin/actions";
import { SectionMark } from "@/components/admin/section-mark";
import { Seal } from "@/components/scoresheet/marks";
import { Sheet } from "@/components/scoresheet/sheet";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * The hiring team's shell.
 *
 * The candidate never sees this chrome and this side never sees the candidate's. Sign-out is a form
 * posting to a server action rather than a link, so a session cannot be ended by a prefetch or a
 * stray GET from another page.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <Sheet>
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-rule px-5 md:px-7">
        <div className="flex min-w-0 items-center gap-3.5">
          <Seal />
          <h1 className="truncate text-[11.5px] font-bold tracking-[0.19em] whitespace-nowrap uppercase">
            AI Engineering Developer Assessment
          </h1>
          <SectionMark />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <Link
            href="/admin/questions"
            className="mono border border-[#bcc3ca] px-3 py-1.5 text-[11px] tracking-[0.12em] text-ink uppercase transition-colors duration-150 hover:border-navy hover:text-navy"
          >
            Questions
          </Link>

          <Link
            href="/api/admin/export"
            className="mono border border-[#bcc3ca] px-3 py-1.5 text-[11px] tracking-[0.12em] text-ink uppercase transition-colors duration-150 hover:border-navy hover:text-navy"
          >
            Export CSV
          </Link>

          <form action={leaveAssessment} className="hidden md:block">
            <button
              type="submit"
              title="End the candidate session in this browser and open the entry screen"
              className="mono border border-[#bcc3ca] px-3 py-1.5 text-[11px] tracking-[0.12em] text-ink uppercase transition-colors duration-150 hover:border-navy hover:text-navy"
            >
              Reset
            </button>
          </form>

          <span className="mono hidden text-[11px] tracking-[0.1em] text-soft lg:block">
            {session.email}
          </span>

          <form action={adminLogout}>
            <button
              type="submit"
              className="mono text-[11px] tracking-[0.12em] text-soft uppercase underline decoration-rule underline-offset-4 transition-colors duration-150 hover:text-flag hover:decoration-flag"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {children}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-4 md:px-7">
        <p className="mono text-[11px] tracking-[0.14em] text-soft uppercase">
          Scores and evaluations are internal
        </p>
        <p className="text-[12.5px] text-soft">
          Records are visible to signed-in staff only, and every session expires after eight hours.
        </p>
      </footer>
    </Sheet>
  );
}
