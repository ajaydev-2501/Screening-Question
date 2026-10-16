"use client";

import { useActionState } from "react";

import { adminLogin, type LoginState } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const IDLE: LoginState = { fields: {}, formError: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, IDLE);

  return (
    <form action={formAction} className="mt-8 border border-rule bg-sheet">
      <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
        <h3 className="mono text-[11px] tracking-[0.18em] text-ink uppercase">Sign in</h3>
        <span className="mono text-[11px] tracking-[0.14em] text-soft">STAFF ONLY</span>
      </div>

      {state.formError ? (
        <p
          role="alert"
          tabIndex={-1}
          className="border-b border-rule bg-flag/8 px-5 py-3 text-[13px] leading-[1.5] text-flag outline-none"
        >
          {state.formError}
        </p>
      ) : null}

      <Field label="Email" name="email" type="email" autoComplete="username" error={state.fields.email} disabled={pending} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fields.password}
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
          {pending ? "Checking credentials…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  error,
  disabled,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  error?: string;
  disabled?: boolean;
}) {
  const id = `admin-${name}`;
  const errorId = `${id}-error`;

  return (
    <div className="grid grid-cols-1 gap-1 border-b border-rule px-5 py-4 sm:grid-cols-[110px_1fr] sm:items-center sm:gap-5">
      <label htmlFor={id} className="mono text-[11px] tracking-[0.18em] text-soft uppercase">
        {label}
      </label>
      <div className="min-w-0">
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full border-b bg-transparent pb-1 text-[17px] text-ink focus:outline-none",
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
