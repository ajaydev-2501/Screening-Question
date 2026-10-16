"use client";

import { cn } from "@/lib/utils";

/**
 * Animated proper loader designed for buttons during backend response storage.
 * Features a spinning high-precision arc, glowing track, and central pulsing core.
 */
export function ButtonLoader({
  className,
  size = 17,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      role="status"
      aria-label="Processing"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        className="size-full animate-spin text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Track circle */}
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeWidth="2.5"
          className="opacity-25"
        />
        {/* Main rotating arc */}
        <path
          d="M 12 2.5 A 9.5 9.5 0 0 1 21.5 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Accent tick */}
        <circle cx="21.5" cy="12" r="1.5" fill="#f59e0b" />
      </svg>
      {/* Central pulsing ochre indicator */}
      <span className="absolute size-1.5 rounded-full bg-ochre opacity-85 animate-pulse" />
    </span>
  );
}

/**
 * Protective click shield to intercept and prevent accidental clicks across the
 * assessment screen while backend is processing to store a response.
 */
export function ClickShield({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-30 cursor-wait bg-black/[0.015] select-none transition-opacity duration-150"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}
