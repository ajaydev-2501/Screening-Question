"use client";

import { usePathname } from "next/navigation";

/** The header chip naming which half of the admin shell you are in. */
export function SectionMark() {
  const pathname = usePathname();
  const label = pathname.startsWith("/admin/questions") ? "QUESTIONS" : "RECORDS";

  return (
    <span className="mono hidden shrink-0 border-l border-rule pl-3.5 text-[11px] tracking-[0.13em] text-soft md:block">
      {label}
    </span>
  );
}
