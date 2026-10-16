"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SaveChannel } from "@/components/assessment/assessment-shell";
import { cn } from "@/lib/utils";
import { TOOL_CATEGORIES, TOOL_CATALOG } from "@/lib/assessment/tool-catalog";
import {
  INVENTORY_TITLES,
  MAX_PRODUCTIVITY_TOOLS,
  PRIMARY_AGENT_OPTIONS,
  REAL_WORLD_EXAMPLE_MAX_LENGTH,
  REAL_WORLD_EXAMPLE_MIN_LENGTH,
  USAGE_DEPTH_OPTIONS,
} from "@/lib/assessment/tool-inventory";
import type { ToolInventoryState } from "@/lib/assessment/service-types";

type Selection = { toolKey: string; customName: string | null };

const AUTOSAVE_DELAY_MS = 900;

/**
 * Move 21: the developer tools and AI engineering ecosystem inventory.
 *
 * Three decisions shape the screen. It is one question screen with the categorized list inside it,
 * not a separate application — the candidate never leaves the sheet. The catalog is never shown
 * whole; a search field and category filters are how a 319-entry list stays readable. And the
 * tool list is deliberately not the point: the three follow-ups beneath it ask what the candidate
 * actually did, because a tick beside "Claude Code" is a fact about familiarity, not about skill.
 */
export function ToolInventoryPanel({
  inventory,
  channel,
  locked,
}: {
  inventory: ToolInventoryState;
  channel: SaveChannel;
  locked: boolean;
}) {
  const [selections, setSelections] = useState<Selection[]>(inventory.selections);
  const [ranked, setRanked] = useState<Selection[]>(inventory.productivityTools);
  const [primaryAgentKey, setPrimaryAgentKey] = useState<string | null>(
    inventory.primaryAgentKey,
  );
  const [primaryAgentOther, setPrimaryAgentOther] = useState<string | null>(
    inventory.primaryAgentOther,
  );
  const [usageDepthKey, setUsageDepthKey] = useState<string | null>(
    inventory.usageDepthKey,
  );
  const [example, setExample] = useState<string>(inventory.realWorldExample ?? "");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  // The debounced writer reads the newest draft from a ref, so a write always sends what the
  // candidate last saw rather than the copy captured when the debounce was armed. The ref is
  // synced after commit — writing it during render would be unsafe under concurrent rendering.
  const draft = useRef({
    selections,
    ranked,
    primaryAgentKey,
    primaryAgentOther,
    usageDepthKey,
    example,
  });
  const sendRef = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(() => {
    const current = draft.current;
    channel.start();

    const retry = () => sendRef.current?.();

    fetch("/api/assessment/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive so a write in flight when the candidate closes the tab is still carried out.
      keepalive: true,
      body: JSON.stringify({
        selections: current.selections,
        productivityTools: current.ranked,
        primaryAgentKey: current.primaryAgentKey,
        primaryAgentOther: current.primaryAgentOther,
        usageDepthKey: current.usageDepthKey,
        realWorldExample: current.example,
      }),
    })
      .then(async (response) => {
        if (response.ok) {
          channel.succeed();
          return;
        }
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        channel.fail(
          payload?.error ?? "Your inventory could not be saved. Check your connection and retry.",
          retry,
        );
      })
      .catch(() => {
        channel.fail(
          "Your inventory could not be saved. Check your connection and retry.",
          retry,
        );
      });
    // channel is rebuilt each render; its setters are stable, so this stays correct without
    // re-creating the callback (and re-arming the debounce) on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    draft.current = {
      selections,
      ranked,
      primaryAgentKey,
      primaryAgentOther,
      usageDepthKey,
      example,
    };
    sendRef.current = send;
  });

  const schedule = useCallback(() => {
    channel.queue();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(send, AUTOSAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  // Leaving the move with the debounce still armed must not drop the write: the panel unmounts on
  // navigation, so the pending change is sent on the way out rather than cancelled with the timer.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        send();
      }
    };
  }, [send]);

  const selectedKeys = useMemo(
    () => new Set(selections.map((s) => s.toolKey)),
    [selections],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TOOL_CATALOG.filter((tool) => {
      if (category && tool.categoryKey !== category) return false;
      if (!needle) return true;
      const categoryName =
        TOOL_CATEGORIES.find((c) => c.key === tool.categoryKey)?.name ?? "";
      return (
        tool.name.toLowerCase().includes(needle) ||
        categoryName.toLowerCase().includes(needle)
      );
    });
  }, [category, query]);

  function toggle(toolKey: string) {
    setSelections((prev) => {
      const next = prev.some((s) => s.toolKey === toolKey)
        ? prev.filter((s) => s.toolKey !== toolKey)
        : [...prev, { toolKey, customName: null }];
      // Deselecting a tool must also drop it from the top three, or the ranked list could hold a
      // tool the candidate no longer claims to have used.
      setRanked((current) => current.filter((r) => next.some((s) => s.toolKey === r.toolKey)));
      return next;
    });
    schedule();
  }

  function setCustomName(toolKey: string, customName: string, target: "selections" | "ranked") {
    const apply = (list: Selection[]) =>
      list.map((s) => (s.toolKey === toolKey ? { ...s, customName } : s));
    if (target === "selections") setSelections(apply);
    else setRanked(apply);
    schedule();
  }

  const exampleLength = example.trim().length;
  const exampleShort = exampleLength > 0 && exampleLength < REAL_WORLD_EXAMPLE_MIN_LENGTH;

  return (
    <div>
      <h2
        id="q21"
        className="max-w-[38ch] text-[1.65rem] leading-[1.26] font-medium tracking-[-0.015em] text-balance md:text-[2rem] md:leading-[1.24]"
      >
        {INVENTORY_TITLES.question}
      </h2>

      <p className="mt-5 max-w-[68ch] text-[13.5px] leading-[1.6] text-soft">
        {INVENTORY_TITLES.questionNote}
      </p>

      {/* --- The list ------------------------------------------------------ */}
      <section aria-labelledby="inventory-tools" className="mt-9">
        <h3 id="inventory-tools" className="sr-only">
          Tool catalog
        </h3>

        <div className="border border-rule">
          <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3">
            <label htmlFor="tool-search" className="sr-only">
              Search the tool catalog
            </label>
            <input
              id="tool-search"
              type="search"
              value={query}
              disabled={locked}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={"Search 319 tools \u2014 try \u201Cplaywright\u201D or \u201Cvector\u201D"}
              className="min-w-0 flex-1 border-b border-rule bg-transparent pb-1 text-[15px] text-ink placeholder:text-soft focus:border-ochre focus:outline-none disabled:opacity-60"
            />
            <span className="mono shrink-0 text-[11px] tracking-[0.14em] text-soft">
              {visible.length} SHOWN
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-rule px-4 py-3">
            <FilterChip
              active={category === null}
              disabled={locked}
              onClick={() => setCategory(null)}
            >
              All
            </FilterChip>
            {TOOL_CATEGORIES.map((c) => (
              <FilterChip
                key={c.key}
                active={category === c.key}
                disabled={locked}
                title={c.name}
                onClick={() => setCategory(category === c.key ? null : c.key)}
              >
                {c.key}
              </FilterChip>
            ))}
          </div>

          <p className="border-b border-rule px-4 py-2 text-[12px] text-soft">
            {category
              ? (TOOL_CATEGORIES.find((c) => c.key === category)?.name ?? "")
              : "Every category. Filter by letter, or search by name."}
          </p>

          <div className="max-h-[360px] overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] text-soft">
                Nothing in the catalog matches “{query}”. Choose an <b className="font-semibold text-ink">Other</b>{" "}
                entry in the closest category and name it there.
              </p>
            ) : (
              visible.map((tool) => (
                <ToolRow
                  key={tool.key}
                  toolKey={tool.key}
                  name={tool.name}
                  categoryKey={tool.categoryKey}
                  isOther={tool.isOther}
                  checked={selectedKeys.has(tool.key)}
                  customName={
                    selections.find((s) => s.toolKey === tool.key)?.customName ?? ""
                  }
                  ranked={ranked.some((r) => r.toolKey === tool.key)}
                  locked={locked}
                  onToggle={toggle}
                  onCustomName={(value) => setCustomName(tool.key, value, "selections")}
                />
              ))
            )}
          </div>
        </div>

        <p className="mt-3 text-[12.5px] leading-[1.55] text-soft">
          Selecting a tool here records that you have used it. It does not count towards your score,
          and it is not read as proof of expertise.
        </p>
      </section>

      {/* --- Review -------------------------------------------------------- */}
      <section aria-labelledby="inventory-selected" className="mt-10">
        <div className="flex items-baseline justify-between border-b border-rule pb-2">
          <h3
            id="inventory-selected"
            className="mono text-[11px] tracking-[0.18em] text-ink uppercase"
          >
            Your selections
          </h3>
          <span className="mono text-[11px] tracking-[0.14em] text-soft">
            {selections.length} SELECTED
          </span>
        </div>

        {selections.length === 0 ? (
          <p className="py-5 text-[13.5px] leading-[1.6] text-soft">
            Nothing selected yet. If you have genuinely used none of these, that is a valid answer —
            continue below.
          </p>
        ) : (
          <ul className="mt-3 flex max-h-[168px] flex-wrap gap-1.5 overflow-y-auto list-none">
            {selections.map((s) => (
              <li key={s.toolKey}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => toggle(s.toolKey)}
                  className="mono flex items-center gap-2 border border-rule bg-sheet px-2.5 py-1.5 text-[11.5px] text-ink transition-colors duration-150 hover:border-flag hover:text-flag disabled:opacity-60"
                >
                  {labelFor(s)}
                  <Cross />
                  <span className="sr-only">Remove</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Follow-ups ---------------------------------------------------- */}
      <section aria-labelledby="inventory-followups" className="mt-11">
        <h3
          id="inventory-followups"
          className="mono border-b border-rule pb-2 text-[11px] tracking-[0.18em] text-ink uppercase"
        >
          Four questions about how you use them
        </h3>

        <FollowUp
          index={1}
          title={INVENTORY_TITLES.productivity}
          note={INVENTORY_TITLES.productivityNote}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((slot) => (
              <label key={slot} className="block">
                <span className="mono mb-1.5 block text-[10.5px] tracking-[0.16em] text-soft uppercase">
                  {["First", "Second", "Third"][slot]}
                </span>
                <select
                  disabled={locked}
                  value={ranked[slot]?.toolKey ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setRanked((prev) => {
                      const without = prev.filter((_, i) => i !== slot);
                      if (!value) return without;
                      const source = selections.find((s) => s.toolKey === value);
                      if (!source) return without;
                      if (without.some((r) => r.toolKey === value)) return without;
                      const next = [...without];
                      next.splice(slot, 0, {
                        toolKey: value,
                        customName: source.customName ?? null,
                      });
                      return next.slice(0, MAX_PRODUCTIVITY_TOOLS);
                    });
                    schedule();
                  }}
                  className="mono w-full border border-rule bg-sheet px-2.5 py-2 text-[12.5px] text-ink focus:border-ochre focus:outline-none disabled:opacity-60"
                >
                  <option value="">—</option>
                  {selections.map((s) => (
                    <option key={s.toolKey} value={s.toolKey}>
                      {labelFor(s)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {selections.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-soft">
              Select tools above and they will appear in these lists.
            </p>
          ) : null}
        </FollowUp>

        <FollowUp index={2} title={INVENTORY_TITLES.primaryAgent}>
          <ChoiceRows
            name="primary-agent"
            options={PRIMARY_AGENT_OPTIONS}
            value={primaryAgentKey}
            locked={locked}
            onChange={(key) => {
              setPrimaryAgentKey(key);
              if (key !== "other") setPrimaryAgentOther(null);
              schedule();
            }}
          />
          {primaryAgentKey === "other" ? (
            <label className="mt-3 block">
              <span className="mono mb-1.5 block text-[10.5px] tracking-[0.16em] text-soft uppercase">
                Which one
              </span>
              <input
                value={primaryAgentOther ?? ""}
                disabled={locked}
                maxLength={120}
                onChange={(event) => {
                  setPrimaryAgentOther(event.target.value || null);
                  schedule();
                }}
                placeholder="Name it"
                className="w-full max-w-[420px] border border-rule bg-transparent px-3 py-2 text-[15px] text-ink placeholder:text-soft focus:border-ochre focus:outline-none disabled:opacity-60"
              />
            </label>
          ) : null}
        </FollowUp>

        <FollowUp index={3} title={INVENTORY_TITLES.usageDepth}>
          <ChoiceRows
            name="usage-depth"
            options={USAGE_DEPTH_OPTIONS}
            value={usageDepthKey}
            locked={locked}
            onChange={(key) => {
              setUsageDepthKey(key);
              schedule();
            }}
          />
        </FollowUp>

        <FollowUp
          index={4}
          title={INVENTORY_TITLES.realWorldExample}
          note={INVENTORY_TITLES.realWorldExampleNote}
        >
          <textarea
            value={example}
            disabled={locked}
            rows={6}
            maxLength={REAL_WORLD_EXAMPLE_MAX_LENGTH}
            onChange={(event) => {
              setExample(event.target.value);
              schedule();
            }}
            placeholder={INVENTORY_TITLES.realWorldExamplePlaceholder}
            className="w-full border border-rule bg-transparent px-3.5 py-3 text-[15px] leading-[1.6] text-ink placeholder:text-soft focus:border-ochre focus:outline-none disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-4">
            <p className={cn("text-[12.5px]", exampleShort ? "text-flag" : "text-soft")}>
              {exampleShort
                ? `Add a little more — ${REAL_WORLD_EXAMPLE_MIN_LENGTH - exampleLength} more characters.`
                : `At least ${REAL_WORLD_EXAMPLE_MIN_LENGTH} characters, so an interviewer has something to ask about.`}
            </p>
            <span className="mono shrink-0 text-[11px] tracking-[0.12em] text-soft">
              {exampleLength} / {REAL_WORLD_EXAMPLE_MAX_LENGTH}
            </span>
          </div>
        </FollowUp>
      </section>
    </div>
  );
}

function labelFor(selection: Selection): string {
  if (selection.customName) return selection.customName;
  return TOOL_CATALOG.find((t) => t.key === selection.toolKey)?.name ?? selection.toolKey;
}

function FilterChip({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "mono min-w-[30px] border px-2 py-1 text-[11px] tracking-[0.08em] uppercase transition-colors duration-150 disabled:opacity-60",
        active
          ? "border-navy bg-navy text-white"
          : "border-rule bg-sheet text-soft hover:border-navy hover:text-navy",
      )}
    >
      {children}
    </button>
  );
}

function ToolRow({
  toolKey,
  name,
  categoryKey,
  isOther,
  checked,
  customName,
  ranked,
  locked,
  onToggle,
  onCustomName,
}: {
  toolKey: string;
  name: string;
  categoryKey: string;
  isOther: boolean;
  checked: boolean;
  customName: string;
  ranked: boolean;
  locked: boolean;
  onToggle: (toolKey: string) => void;
  onCustomName: (value: string) => void;
}) {
  return (
    <div
      data-selected={checked}
      className={cn(
        "ink-flood flex flex-wrap items-center gap-3 border-t border-rule px-4 py-2.5 first:border-t-0",
        checked && "transition-colors duration-150",
      )}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={() => onToggle(toolKey)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "grid size-[17px] shrink-0 place-items-center border transition-colors duration-150",
            checked ? "border-navy bg-navy" : "border-soft/50 bg-sheet",
          )}
        >
          {checked ? <Check /> : null}
        </span>
        <span
          className={cn(
            "truncate text-[14px] transition-colors duration-150",
            checked ? "text-navy-soft" : "text-ink",
          )}
        >
          {name}
        </span>
      </label>

      {isOther && checked ? (
        <input
          value={customName}
          disabled={locked}
          maxLength={120}
          onChange={(event) => onCustomName(event.target.value)}
          placeholder="Name it"
          aria-label={`Specify the ${name}`}
          className="min-w-[160px] flex-1 border-b border-navy-soft/40 bg-transparent pb-0.5 text-[13.5px] text-navy-soft placeholder:text-navy-soft focus:border-ochre focus:outline-none"
        />
      ) : null}

      {ranked ? (
        <span className="mono border border-navy-soft/40 px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-navy-soft uppercase">
          Top three
        </span>
      ) : null}

      <span
        aria-hidden="true"
        className={cn(
          "mono w-4 shrink-0 text-center text-[10px] tracking-[0.1em]",
          checked ? "text-navy-soft/70" : "text-soft",
        )}
      >
        {categoryKey}
      </span>
    </div>
  );
}

function FollowUp({
  index,
  title,
  note,
  children,
}: {
  index: number;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-7">
      <div className="flex items-baseline gap-3">
        <span className="mono text-[11px] tracking-[0.14em] text-soft">
          {String(index).padStart(2, "0")}
        </span>
        <h4 className="max-w-[52ch] text-[15.5px] leading-[1.45] font-semibold text-ink">
          {title}
        </h4>
      </div>
      {note ? (
        <p className="mt-1.5 max-w-[68ch] pl-[30px] text-[12.5px] leading-[1.55] text-soft">
          {note}
        </p>
      ) : null}
      <div className="mt-3.5 pl-0 sm:pl-[30px]">{children}</div>
    </div>
  );
}

function ChoiceRows({
  name,
  options,
  value,
  locked,
  onChange,
}: {
  name: string;
  options: { key: string; label: string }[];
  value: string | null;
  locked: boolean;
  onChange: (key: string) => void;
}) {
  return (
    <div role="radiogroup" className="border border-rule">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <label
            key={option.key}
            data-selected={selected}
            className={cn(
              "ink-flood flex cursor-pointer items-center border-t border-rule px-4 py-3 first:border-t-0",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ochre",
              !selected && "transition-colors duration-150 hover:bg-paper",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.key}
              checked={selected}
              disabled={locked}
              onChange={() => onChange(option.key)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "mr-3.5 grid size-[15px] shrink-0 place-items-center rounded-full border transition-colors duration-150",
                selected ? "border-navy-soft bg-navy-soft" : "border-soft/55 bg-sheet",
              )}
            >
              {selected ? <span className="block size-[5px] rounded-full bg-navy" /> : null}
            </span>
            <span
              className={cn(
                "text-[14px] leading-[1.5] transition-colors duration-150",
                selected ? "text-navy-soft" : "text-ink",
              )}
            >
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Icons are drawn, not borrowed from a font: a stroke weight that matches the 1px rules. */
function Check() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" focusable="false">
      <path
        d="M2 6.4 L4.6 9 L10 3"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true" focusable="false">
      <path
        d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="square"
      />
    </svg>
  );
}
