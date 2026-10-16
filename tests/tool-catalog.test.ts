import { describe, expect, it } from "vitest";

import {
  TOOL_CATALOG,
  TOOL_CATALOG_VERSION,
  TOOL_CATEGORIES,
} from "@/lib/assessment/tool-catalog";
import {
  MAX_PRODUCTIVITY_TOOLS,
  PRIMARY_AGENT_OPTIONS,
  USAGE_DEPTH_OPTIONS,
  isKnownPrimaryAgentKey,
  isKnownUsageDepthKey,
  primaryAgentOption,
  usageDepthOption,
} from "@/lib/assessment/tool-inventory";
import { MAX_TOOL_SELECTIONS } from "@/lib/validation";

describe("tool catalog", () => {
  it("holds the full inventory the brief specifies: 319 tools in 13 categories", () => {
    expect(TOOL_CATALOG).toHaveLength(319);
    expect(TOOL_CATEGORIES.map((c) => c.key)).toEqual([
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    ]);
  });

  it("files every tool under a declared category", () => {
    const categoryKeys = new Set(TOOL_CATEGORIES.map((c) => c.key));
    for (const tool of TOOL_CATALOG) {
      expect(categoryKeys.has(tool.categoryKey), tool.key).toBe(true);
    }
    for (const category of TOOL_CATEGORIES) {
      const count = TOOL_CATALOG.filter((t) => t.categoryKey === category.key).length;
      expect(count, category.key).toBeGreaterThan(0);
    }
  });

  it("uses stable lowercase keys with no duplicates", () => {
    const keys = TOOL_CATALOG.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    }
  });

  it("shows every candidate a distinct, non-empty tool name", () => {
    const names = TOOL_CATALOG.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("gives each category exactly one free-text 'Other' entry", () => {
    for (const category of TOOL_CATEGORIES) {
      const others = TOOL_CATALOG.filter(
        (t) => t.categoryKey === category.key && t.isOther,
      );
      expect(others.length, category.key).toBe(1);
      expect(others[0]!.name, category.key).toMatch(/\(specify\)/i);
    }
  });

  it("versions the catalog so stored selections keep their revision", () => {
    expect(Number.isInteger(TOOL_CATALOG_VERSION)).toBe(true);
    expect(TOOL_CATALOG_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("keeps the acceptance ceiling above the catalog size", () => {
    expect(MAX_TOOL_SELECTIONS).toBeGreaterThan(TOOL_CATALOG.length);
  });
});

describe("follow-up option lists", () => {
  it("offers exactly one custom-named primary agent, and a no-agent option", () => {
    const custom = PRIMARY_AGENT_OPTIONS.filter((o) => o.allowsCustomName);
    expect(custom).toHaveLength(1);
    expect(custom[0]!.key).toBe("other");
    expect(PRIMARY_AGENT_OPTIONS.some((o) => o.key === "none")).toBe(true);
  });

  it("keys every option uniquely in both lists", () => {
    for (const list of [PRIMARY_AGENT_OPTIONS, USAGE_DEPTH_OPTIONS]) {
      const keys = list.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const option of list) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
    expect(USAGE_DEPTH_OPTIONS).toHaveLength(5);
  });

  it("recognizes known keys and rejects unknown ones", () => {
    expect(isKnownPrimaryAgentKey("claude-code")).toBe(true);
    expect(isKnownPrimaryAgentKey("invented-agent")).toBe(false);
    expect(isKnownUsageDepthKey("structured-workflow")).toBe(true);
    expect(isKnownUsageDepthKey("none")).toBe(false);

    expect(primaryAgentOption("claude-code")?.label).toBe("Claude Code");
    expect(primaryAgentOption(null)).toBeUndefined();
    expect(primaryAgentOption("invented-agent")).toBeUndefined();
    expect(usageDepthOption("authored-workflows")?.key).toBe("authored-workflows");
    expect(usageDepthOption(undefined)).toBeUndefined();
  });

  it("caps credited productivity tools at three", () => {
    expect(MAX_PRODUCTIVITY_TOOLS).toBe(3);
  });
});
