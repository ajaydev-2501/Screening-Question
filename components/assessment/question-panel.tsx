import { cn } from "@/lib/utils";

export type PanelOption = { key: string; letter: string; label: string };

/**
 * One move's question and its four option bands.
 *
 * The options are real radio inputs inside real labels rather than divs wearing `role="radio"`.
 * Arrow-key movement, single-selection semantics, form association and screen-reader grouping then
 * come from the platform instead of from a reimplementation of it, and the 1-4 shortcut is an
 * addition on top rather than the only way in.
 */
export function QuestionPanel({
  promptId,
  prompt,
  options,
  selectedKey,
  onSelect,
  locked,
}: {
  promptId: string;
  prompt: string;
  options: PanelOption[];
  selectedKey: string | null;
  onSelect: (optionKey: string) => void;
  locked: boolean;
}) {
  return (
    <div>
      <h2
        id={promptId}
        className="max-w-[38ch] text-[1.65rem] leading-[1.26] font-medium tracking-[-0.015em] text-balance md:text-[2rem] md:leading-[1.24]"
      >
        {prompt}
      </h2>

      <div
        role="radiogroup"
        aria-labelledby={promptId}
        className="mt-9 border border-rule md:mt-11"
      >
        {options.map((option, index) => {
          const selected = option.key === selectedKey;

          return (
            <label
              key={option.key}
              data-selected={selected}
              className={cn(
                "ink-flood flex min-h-[92px] cursor-pointer items-center border-t border-rule first:border-t-0 md:min-h-[102px]",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ochre",
                !selected && "transition-colors duration-150 hover:bg-paper",
              )}
            >
              <input
                type="radio"
                name={promptId}
                value={option.key}
                checked={selected}
                disabled={locked}
                onChange={() => onSelect(option.key)}
                className="sr-only"
              />

              <span
                aria-hidden="true"
                className={cn(
                  "mono flex w-11 shrink-0 self-stretch items-center justify-center border-r text-[15px] font-bold transition-colors duration-150 md:w-[58px]",
                  selected
                    ? "border-navy-soft/25 text-white"
                    : "border-rule text-soft",
                )}
              >
                {option.letter}
              </span>

              <span
                className={cn(
                  "max-w-[68ch] px-5 py-4 text-[15.5px] leading-[1.5] transition-colors duration-150 md:px-7 md:text-[17px]",
                  selected ? "text-navy-soft" : "text-ink",
                )}
              >
                {option.label}
              </span>

              <span
                aria-hidden="true"
                className={cn(
                  "mono ml-auto mr-4 flex h-[26px] w-[30px] shrink-0 items-center justify-center border text-[11px] transition-colors duration-150 md:mr-5",
                  selected
                    ? "border-navy-soft/40 text-navy-soft"
                    : "border-rule text-soft",
                )}
              >
                {index + 1}
              </span>
            </label>
          );
        })}
      </div>

      <p className="mt-6 max-w-[64ch] text-[12.5px] leading-[1.55] text-soft md:mt-7 md:text-[13px]">
        Choose the approach you would actually take. There is no clock, and you can return to any
        earlier move.
      </p>
    </div>
  );
}
