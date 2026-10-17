"use client";

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
