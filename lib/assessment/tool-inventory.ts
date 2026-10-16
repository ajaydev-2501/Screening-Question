/**
 * Question 21 follow-up fields. Public-safe: no scoring, no evaluation notes.
 *
 * The inventory itself is unscored, so unlike the 20 scored questions nothing here is hidden
 * behind `server-only`. Keys are stable identifiers — the labels may be reworded without
 * invalidating stored records, the keys may not.
 */

export type ToolInventoryOption = {
  key: string;
  label: string;
  /** True when choosing this option reveals a free-text field for a custom name. */
  allowsCustomName?: boolean;
};

export const PRIMARY_AGENT_OPTIONS: ToolInventoryOption[] = [
  { key: "claude-code", label: "Claude Code" },
  { key: "opencode", label: "OpenCode" },
  { key: "cursor", label: "Cursor" },
  { key: "windsurf", label: "Windsurf" },
  { key: "openai-codex", label: "OpenAI Codex" },
  { key: "github-copilot", label: "GitHub Copilot" },
  { key: "google-antigravity", label: "Google Antigravity" },
  { key: "gemini-cli", label: "Gemini CLI" },
  { key: "aider", label: "Aider" },
  { key: "cline-roo", label: "Cline / Roo Code" },
  { key: "other", label: "Other", allowsCustomName: true },
  { key: "none", label: "I do not regularly use an AI coding agent" },
];

/**
 * Ordered shallowest to deepest. The order is the candidate-facing reading order from the brief;
 * it is deliberately not a numeric scale, because the inventory must not be read as a score.
 */
export const USAGE_DEPTH_OPTIONS: ToolInventoryOption[] = [
  { key: "completion", label: "Mostly for code completion and quick suggestions." },
  { key: "components", label: "For generating functions or individual components." },
  {
    key: "full-cycle",
    label: "For requirement analysis, planning, implementation, and debugging.",
  },
  {
    key: "structured-workflow",
    label:
      "For a structured workflow including planning, bounded agent execution, testing, independent review, and verification.",
  },
  {
    key: "authored-workflows",
    label:
      "I have built reusable project-specific skills, hooks, or multi-agent workflows.",
  },
];

export const INVENTORY_TITLES = {
  question:
    "Which development tools, AI coding tools, and engineering platforms have you personally used?",
  questionNote:
    "Select only the tools you have hands-on experience with. This inventory is not scored — it tells your interviewer what to ask you about, so an honest list is worth more than a long one.",
  productivity: "Which three tools have contributed most to your development productivity?",
  productivityNote: "Select up to three from the tools you chose above.",
  primaryAgent: "Which AI coding agent do you use most frequently?",
  usageDepth: "How do you typically use your primary AI coding tool?",
  realWorldExample: "Describe one real development task where you used an AI agent.",
  realWorldExampleNote:
    "Explain the requirement, the tools you used, your planning approach, the tests you performed, and how you verified the result.",
  realWorldExamplePlaceholder:
    "The task was… I planned it by… I used… I tested… I verified the result by…",
} as const;

/** The most a candidate may credit as top productivity tools. */
export const MAX_PRODUCTIVITY_TOOLS = 3;

export const REAL_WORLD_EXAMPLE_MIN_LENGTH = 40;
export const REAL_WORLD_EXAMPLE_MAX_LENGTH = 2000;

const PRIMARY_AGENT_KEYS = new Set(PRIMARY_AGENT_OPTIONS.map((o) => o.key));
const USAGE_DEPTH_KEYS = new Set(USAGE_DEPTH_OPTIONS.map((o) => o.key));

export function isKnownPrimaryAgentKey(key: string): boolean {
  return PRIMARY_AGENT_KEYS.has(key);
}

export function isKnownUsageDepthKey(key: string): boolean {
  return USAGE_DEPTH_KEYS.has(key);
}

export function primaryAgentOption(key: string | null | undefined) {
  return key ? PRIMARY_AGENT_OPTIONS.find((o) => o.key === key) : undefined;
}

export function usageDepthOption(key: string | null | undefined) {
  return key ? USAGE_DEPTH_OPTIONS.find((o) => o.key === key) : undefined;
}
