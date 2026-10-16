import "server-only";

/**
 * The seven scored sections of the assessment; each one is an axis of the admin radar graph.
 *
 * This module names the sections and fixes their order. Which question belongs to which section is
 * authored in `./rubric` — the seed derives the label on each question row from there, so the two
 * cannot drift. The radar normalizes every section to 0-100 from its own earned/available points,
 * so the two-question LSP section compares fairly with the three-question sections.
 */
export const SECTIONS = [
  {
    id: "ai-agents",
    name: "AI Agents and Working Methodology",
    shortName: "Agents",
  },
  {
    id: "ai-skills",
    name: "AI Skills and Reusable Workflows",
    shortName: "Skills",
  },
  {
    id: "mcp-integrations",
    name: "MCP Servers and Integrations",
    shortName: "MCP",
  },
  {
    id: "dev-environment",
    name: "LSP and Development Environment",
    shortName: "LSP & env",
  },
  {
    id: "testing-validation",
    name: "Testing and Validation",
    shortName: "Testing",
  },
  {
    id: "github-collaboration",
    name: "GitHub and Collaboration",
    shortName: "GitHub",
  },
  {
    id: "context-problem-solving",
    name: "Context, Productivity, and Problem-Solving",
    shortName: "Context",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  shortName: string;
}[];

export type SectionId = (typeof SECTIONS)[number]["id"];

export type Section = (typeof SECTIONS)[number];

export function sectionById(id: SectionId): Section {
  const found = SECTIONS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown section: ${id}`);
  return found;
}
