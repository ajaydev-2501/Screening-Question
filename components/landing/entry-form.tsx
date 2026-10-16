"use client";

import { useActionState, useEffect, useRef } from "react";

import { beginAssessment, type BeginState } from "@/app/actions";
import { cn } from "@/lib/utils";

const IDLE: BeginState = { fields: {}, formError: null };

export function EntryForm() {
  const [state, formAction, pending] = useActionState(beginAssessment, IDLE);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // The failure is announced rather than left to be discovered: a form that silently re-renders
  // with red text under a field the candidate is not looking at reads as the page ignoring them.
  useEffect(() => {
    if (state.formError) errorRef.current?.focus();
  }, [state.formError]);

  return (
    <form action={formAction} noValidate className="border border-rule bg-sheet">
      <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
        <h2 className="mono text-[11px] tracking-[0.18em] text-ink uppercase">Entry</h2>
        <span className="mono text-[11px] tracking-[0.14em] text-soft">MOVE 01 / 21</span>
      </div>

      {state.formError ? (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="border-b border-rule bg-flag/8 px-5 py-3 text-[13px] leading-[1.5] text-flag outline-none"
        >
          {state.formError}
        </p>
      ) : null}

      <Field
        label="Name"
        name="firstName"
        autoComplete="given-name"
        placeholder="Given name"
        error={state.fields.firstName}
        disabled={pending}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
        error={state.fields.email}
        disabled={pending}
      />

      <div className="border-t border-rule px-5 py-5">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "h-12 w-full border border-navy bg-navy px-6",
            "mono text-[12px] font-medium tracking-[0.14em] text-white uppercase",
            "transition-colors duration-150 hover:bg-[#16293f]",
            "disabled:cursor-not-allowed disabled:border-rule disabled:bg-rule disabled:text-soft",
          )}
        >
          {pending ? "Opening the sheet…" : "Begin the assessment"}
        </button>

        <p className="mt-4 text-[12.5px] leading-[1.55] text-soft">
          Single attempt. Your question order is shuffled once, when you begin, and saved against
          this browser.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  error,
  disabled,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  disabled?: boolean;
}) {
  const id = `entry-${name}`;
  const errorId = `${id}-error`;

  return (
    <div className="grid grid-cols-1 gap-1 border-b border-rule px-5 py-4 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-5">
      <label
        htmlFor={id}
        className="mono text-[11px] tracking-[0.18em] text-soft uppercase"
      >
        {label}
      </label>
      <div className="min-w-0">
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full border-b bg-transparent pb-1 text-[17px] text-ink",
            "placeholder:text-soft focus:outline-none",
            error ? "border-flag" : "border-rule focus:border-ochre",
          )}
        />
        {error ? (
          <p id={errorId} className="mt-2 text-[12.5px] leading-[1.5] text-flag">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
