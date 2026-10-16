import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { Sheet, SheetHeader } from "@/components/scoresheet/sheet";
import { readAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await readAdminSession()) redirect("/admin");

  return (
    <Sheet>
      <SheetHeader>
        <span className="mono hidden shrink-0 border-l border-rule pl-4 text-[11px] tracking-[0.13em] text-soft whitespace-nowrap md:block">
          HIRING TEAM ONLY
        </span>
      </SheetHeader>

      <main className="flex flex-1 items-start justify-center px-5 py-16 md:py-24">
        <div className="w-full max-w-[440px]">
          <h2 className="text-[1.6rem] leading-[1.2] font-medium tracking-[-0.02em] md:text-[1.9rem]">
            Recruiter access
          </h2>
          <p className="mt-4 max-w-[56ch] text-[14.5px] leading-[1.6] text-soft">
            Candidate records, scores, and tool inventories are readable only from here. Every
            record belongs to a named candidate, and nothing on this side is public.
          </p>

          <LoginForm />
        </div>
      </main>
    </Sheet>
  );
}

export const metadata = {
  title: "Sign in · Assessment records",
  robots: { index: false, follow: false },
};
