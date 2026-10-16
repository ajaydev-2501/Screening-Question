"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Files the assessment.
 *
 * The button stays disabled until the POST resolves and then navigates, rather than redirecting
 * optimistically: a candidate who is sent to the confirmation screen while the write is still in
 * flight would see "filed" for a record that is not.
 */
export function SubmitButton({ blocked }: { blocked: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/assessment/submit", { method: "POST" });
      if (response.ok) {
        router.push("/assessment/submitted");
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Your assessment could not be submitted. Try again.");
      setSubmitting(false);
    } catch {
      setError("Your assessment could not be submitted. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  const disabled = blocked || submitting;

  return (
    <div>
      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        className={cn(
          "mono flex h-12 items-center justify-center border px-7 text-[11.5px] font-semibold tracking-[0.13em] uppercase transition-colors duration-150",
          disabled
            ? "cursor-not-allowed border-rule bg-rule text-soft"
            : "border-navy bg-navy text-white hover:bg-[#16293f]",
        )}
      >
        {submitting ? "Filing your record…" : "Submit this record"}
      </button>

      {blocked ? (
        <p className="mt-3 max-w-[52ch] text-[12.5px] leading-[1.55] text-soft">
          Every move must be answered before the record can be filed.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 max-w-[52ch] text-[13px] leading-[1.5] text-flag">
          {error}
        </p>
      ) : null}
    </div>
  );
}
