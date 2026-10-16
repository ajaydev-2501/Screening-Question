"use client";

import { useActionState } from "react";

import {
  saveQuestionEdit,
  type QuestionEditState,
} from "@/app/admin/(dashboard)/questions/actions";
import { cn } from "@/lib/utils";

const IDLE: QuestionEditState = { fields: {}, formError: null, publishedVersion: null };

/**
 * The shape the editor renders. Declared here rather than imported from the server-only bank
 * module so this client component keeps its import graph free of server code.
 */
export type EditableQuestionView = {
  key: string;
  position: number;
  prompt: string;
  competencyLabel: string;
  options: { key: string; letter: string; label: string }[];
};

/**
 * One editable question: the prompt and its four option labels, each block its own form.
 *
 * Per-question forms rather than one page-wide save: an administrator fixing one awkward sentence
 * should publish exactly one new version, and a page-wide save would republish all twenty.
 * Inputs are uncontrolled with defaults — the server round-trip is the state, and a `publishedVersion`
 * in the action result is the confirmation.
 */
export function QuestionEditorBlock({ question }: { question: EditableQuestionView }) {
  const [state, formAction, pending] = useActionState(saveQuestionEdit, IDLE);

  return (
    <form action={formAction} className="border border-rule bg-sheet">
      <input type="hidden" name="questionKey" value={question.key} />

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="mono text-[13px] font-bold tabular-nums">
            {String(question.position).padStart(2, "0")}
          </span>
          <span className="mono text-[11px] tracking-[0.16em] text-soft uppercase">
            {question.key}
          </span>
          <span className="mono hidden truncate border-l border-rule pl-3 text-[11px] tracking-[0.13em] text-soft uppercase sm:block">
            {question.competencyLabel}
          </span>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={cn(
            "mono text-[11px] tracking-[0.12em] uppercase",
            state.publishedVersion ? "text-certified" : "text-transparent",
          )}
        >
          {state.publishedVersion ? `Published as version ${state.publishedVersion}` : "No change yet"}
        </p>
      </header>

      <div className="px-5 py-4">
        <label
          htmlFor={`${question.key}-prompt`}
          className="mono text-[10.5px] tracking-[0.16em] text-soft uppercase"
        >
          Prompt
        </label>
        <textarea
          id={`${question.key}-prompt`}
          name="prompt"
          rows={3}
          defaultValue={question.prompt}
          aria-invalid={state.fields.prompt ? true : undefined}
          aria-describedby={state.fields.prompt ? `${question.key}-prompt-error` : undefined}
          className={cn(
            "mt-2 block w-full border bg-sheet px-3 py-2.5 text-[15px] leading-[1.55] text-ink",
            "focus:outline-none",
            state.fields.prompt ? "border-flag" : "border-rule focus:border-ochre",
          )}
        />
        {state.fields.prompt ? (
          <p id={`${question.key}-prompt-error`} className="mt-2 text-[12.5px] text-flag">
            {state.fields.prompt}
          </p>
        ) : null}
      </div>

      <ul className="border-t border-rule">
        {question.options.map((option, index) => {
          const field = `label_${option.letter.toLowerCase()}` as const;
          const error = state.fields[field];
          const errorId = `${question.key}-${field}-error`;

          return (
            <li
              key={option.key}
              className={cn(
                "grid grid-cols-[2rem_1fr] items-start gap-3 px-5 py-3",
                index > 0 && "border-t border-rule",
              )}
            >
              <label
                htmlFor={`${question.key}-${field}`}
                className="mono w-7 border border-rule py-1 text-center text-[12px] font-bold text-soft"
              >
                {option.letter}
              </label>
              <div className="min-w-0">
                <input
                  id={`${question.key}-${field}`}
                  name={field}
                  defaultValue={option.label}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className={cn(
                    "block w-full border-b bg-transparent pb-1.5 text-[15px] text-ink",
                    "focus:outline-none",
                    error ? "border-flag" : "border-rule focus:border-ochre",
                  )}
                />
                {error ? (
                  <p id={errorId} className="mt-2 text-[12.5px] text-flag">
                    {error}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {state.formError ? (
        <p
          role="alert"
          className="border-t border-rule bg-flag/8 px-5 py-3 text-[13px] leading-[1.5] text-flag"
        >
          {state.formError}
        </p>
      ) : null}

      <footer className="flex items-center justify-end border-t border-rule px-5 py-3">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "mono h-9 border px-4 text-[11px] font-semibold tracking-[0.12em] uppercase",
            "transition-colors duration-150",
            "disabled:cursor-not-allowed disabled:border-rule disabled:bg-rule disabled:text-soft",
            "border-navy bg-navy text-white hover:bg-[#16293f]",
          )}
        >
          {pending ? "Publishing…" : "Save as new version"}
        </button>
      </footer>
    </form>
  );
}
