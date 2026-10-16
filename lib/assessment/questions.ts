/**
 * The candidate-facing question bank: prompts and option text only.
 *
 * This module is deliberately free of scoring metadata, proficiency levels, section mapping and
 * evaluation notes. Those live in `./rubric`, which is server-only. Keeping the two apart means a
 * public API response built from this module cannot leak the rubric by accident.
 *
 * The best answer is not always the same letter: the option order below is the randomized order
 * the candidate sees, and the internal scoring key in `./rubric` maps each letter to its
 * proficiency level.
 */

export type OptionLetter = "A" | "B" | "C" | "D";

export type QuestionOption = {
  key: string;
  letter: OptionLetter;
  label: string;
};

export type Question = {
  key: string;
  position: number;
  prompt: string;
  options: QuestionOption[];
};

type AuthoredQuestion = {
  key: string;
  prompt: string;
  options: [string, string, string, string];
};

const LETTERS: OptionLetter[] = ["A", "B", "C", "D"];

const AUTHORED: AuthoredQuestion[] = [
  {
    key: "q01",
    prompt:
      "When working with an AI coding agent on a new feature, how do you usually approach the task?",
    options: [
      "I provide the requirements and relevant project context, then review the generated implementation.",
      "I generally use AI to explore the problem and guide me as I implement it.",
      "I review the proposed approach, establish checkpoints, and verify implementation against requirements.",
      "I describe the feature and ask the agent to implement it, then inspect the result.",
    ],
  },
  {
    key: "q02",
    prompt:
      "How do you handle a task that requires changes across multiple files and modules?",
    options: [
      "I let AI make the related changes and inspect the files afterward.",
      "I map dependencies, plan the changes, identify risks, and validate each stage.",
      "I work through the files individually and ask AI for help when needed.",
      "I divide the task into smaller steps and review each implementation.",
    ],
  },
  {
    key: "q03",
    prompt: "How do you maintain project-specific instructions for AI tools?",
    options: [
      "I usually rely on default tool behavior and add instructions when necessary.",
      "I use project instruction files or tool-specific rules to communicate conventions.",
      "I reuse prompts or remind AI of important conventions for each task.",
      "I maintain project rules, reusable instructions, and validation practices and update them as needed.",
    ],
  },
  {
    key: "q04",
    prompt: "How do you use skills in AI development tools?",
    options: [
      "I create and maintain task-specific skills with instructions, resources, usage conditions, and validation.",
      "I use existing skills when available and adjust my prompts as needed.",
      "I configure or adapt existing skills for recurring tasks and verify their behavior.",
      "I mostly write instructions directly in chat and am exploring reusable skills.",
    ],
  },
  {
    key: "q05",
    prompt:
      "If you wanted to introduce a custom skill for code reviews, what would you do?",
    options: [
      "Save a detailed code-review prompt and reuse it.",
      "Ask AI to review code directly and explore reusable skill configuration later.",
      "Define review criteria, inputs, outputs, supporting resources, and test cases, then refine the skill using real reviews.",
      "Write reusable review instructions, configure them in the supported format, and test them on actual code changes.",
    ],
  },
  {
    key: "q06",
    prompt: "How do you decide when an AI skill should be used?",
    options: [
      "I select skills based on the task and follow their documented usage instructions.",
      "I define when the skill applies, what context it needs, its limitations, and how to verify its output.",
      "I usually start with a normal prompt and explore skills when I need a reusable approach.",
      "I try relevant skills when I notice they could help with a task.",
    ],
  },
  {
    key: "q07",
    prompt: "What best describes your experience with MCP (Model Context Protocol)?",
    options: [
      "I understand the purpose of MCP and have explored examples or existing configurations.",
      "I have heard about MCP but am still exploring how it works.",
      "I have connected an MCP server to a compatible AI client and used its tools.",
      "I have configured MCP servers, managed tools and permissions, and troubleshot integration issues.",
    ],
  },
  {
    key: "q08",
    prompt:
      "Suppose you want an AI coding tool to access GitHub issues and project documentation through MCP. How would you approach it?",
    options: [
      "Select a suitable server, configure authentication and least-privilege access, test its tools, and validate the returned data.",
      "Find an existing configuration and adapt it to the project.",
      "Search for an available integration and learn the setup process while trying it.",
      "Follow setup instructions, connect the server to the AI client, and test issue and documentation retrieval.",
    ],
  },
  {
    key: "q09",
    prompt:
      "How do you manage permissions and security when AI tools can access external services?",
    options: [
      "Follow the tool's recommended setup and avoid sharing credentials directly in prompts.",
      "Use approved integrations, limit access to what is needed, and review actions that modify external resources.",
      "Apply least privilege, protect credentials, separate read and write access, and review sensitive actions and audit information.",
      "Use the available integrations and learn their security settings as needed.",
    ],
  },
  {
    key: "q10",
    prompt:
      "What is your understanding of LSP (Language Server Protocol) in AI-assisted development?",
    options: [
      "I understand how language servers provide code intelligence and have configured or troubleshot LSP integrations.",
      "I understand that LSP enables diagnostics, go-to-definition, and symbol references, and I have used these features.",
      "I am still learning how language servers and LSP relate to development tools.",
      "I use editor features such as autocomplete and diagnostics but have not explored the protocol much.",
    ],
  },
  {
    key: "q11",
    prompt:
      "When AI gives an incorrect answer about a function or type in your codebase, how do you investigate it?",
    options: [
      "I trace definitions and references, inspect diagnostics and types, and verify the relevant code paths.",
      "I search for the function or type in the codebase and compare the results with AI's answer.",
      "I ask AI for clarification and explore the relevant code until I understand the issue.",
      "I inspect source files, use editor navigation and type information, and ask AI to reassess its answer.",
    ],
  },
  {
    key: "q12",
    prompt: "How do you plan tests for a feature implemented with AI assistance?",
    options: [
      "I test the main use case and add tests when problems appear.",
      "I ask AI to generate test cases covering normal scenarios, invalid inputs, and likely edge cases.",
      "I test the feature manually to confirm that it works as expected.",
      "I define expected behavior, edge cases, failure paths, regression risks, and appropriate automated checks.",
    ],
  },
  {
    key: "q13",
    prompt:
      "An AI agent modifies an API used by several frontend components. How would you verify the changes?",
    options: [
      "Test the modified endpoint and check the main frontend flow manually.",
      "Verify API contracts, validation, error responses, automated tests, and downstream regression scenarios.",
      "Run the application and confirm that the feature works in the usual scenario.",
      "Run relevant tests, test the API, and check the frontend components that depend on it.",
    ],
  },
  {
    key: "q14",
    prompt:
      "What do you do when AI-generated tests pass, but you are unsure whether they cover the feature properly?",
    options: [
      "Ask AI for additional edge cases and independently review the missing scenarios.",
      "Perform additional manual checks to increase confidence.",
      "Compare the tests against requirements, add boundary and failure scenarios, and verify that the tests can detect incorrect behavior.",
      "Add more tests for scenarios I think might cause problems.",
    ],
  },
  {
    key: "q15",
    prompt: "How do you use GitHub when working with AI-generated code?",
    options: [
      "Commit the changes and open a pull request when the feature is ready.",
      "Use feature branches, inspect diffs, review pull requests, and run required checks before merging.",
      "Use GitHub mainly to push code and collaborate with other developers.",
      "Commit changes to a feature branch, inspect the diff, and use pull requests for review.",
    ],
  },
  {
    key: "q16",
    prompt:
      "How do you handle an AI-generated change that causes a regression after being merged into a shared branch?",
    options: [
      "Identify the regression, isolate the cause using diffs and tests, apply a safe fix or revert, and add regression coverage.",
      "Ask AI to investigate the regression and help prepare a fix.",
      "Reproduce the issue, inspect the changes, fix the cause, and run relevant tests.",
      "Try to restore the previous working code and ask a teammate for guidance if necessary.",
    ],
  },
  {
    key: "q17",
    prompt:
      "How do you approach pull requests when AI has contributed a substantial portion of the code?",
    options: [
      "Review modified files and confirm that the feature works before opening the PR.",
      "Check the diff, verify the implementation, run tests, and provide a clear PR description.",
      "Review the diff, design implications, security, test evidence, and maintainability; explain changes and risks in the PR.",
      "Open the PR and rely on the normal review process to identify issues.",
    ],
  },
  {
    key: "q18",
    prompt: "How do you provide context to an AI agent working in an existing repository?",
    options: [
      "Share relevant files, explain dependencies and requirements, and specify expected behavior.",
      "Start with a short prompt and add details as the conversation progresses.",
      "Describe the task and provide code snippets when the agent needs more information.",
      "Establish repository guidance, architecture constraints, relevant files, requirements, and explicit completion criteria.",
    ],
  },
  {
    key: "q19",
    prompt:
      "How do you evaluate whether an AI-assisted workflow is improving your productivity?",
    options: [
      "Judge whether tasks feel easier and whether I complete them faster.",
      "Compare delivery time, defect rates, review effort, maintainability, and rework across comparable tasks.",
      "Explore different tools and workflows and use whichever feels most helpful.",
      "Track time saved and check whether code quality remains consistent.",
    ],
  },
  {
    key: "q20",
    prompt:
      "When an AI-assisted implementation repeatedly fails, how do you decide what to do next?",
    options: [
      "Reassess assumptions, isolate the failure, gather evidence, revise the plan, and verify the next attempt against explicit criteria.",
      "Try alternative prompts or approaches until I find a working solution.",
      "Provide AI with the latest error and relevant context, then test a revised solution.",
      "Switch to manual debugging or ask a teammate for help if AI is not making progress.",
    ],
  },
];

export const QUESTIONS: Question[] = AUTHORED.map((q, index) => ({
  key: q.key,
  position: index + 1,
  prompt: q.prompt,
  options: q.options.map((label, optionIndex) => ({
    key: `${q.key}-${LETTERS[optionIndex]!.toLowerCase()}`,
    letter: LETTERS[optionIndex]!,
    label,
  })),
}));

export const SCORED_QUESTION_COUNT = QUESTIONS.length;

/** Question 21 is the unscored tool-experience inventory and is always the final screen. */
export const TOOL_INVENTORY_KEY = "q21";

export const TOTAL_SCREEN_COUNT = SCORED_QUESTION_COUNT + 1;

const BY_KEY = new Map(QUESTIONS.map((q) => [q.key, q]));

export function questionByKey(key: string): Question | undefined {
  return BY_KEY.get(key);
}

const OPTIONS_BY_KEY = new Map(
  QUESTIONS.flatMap((q) => q.options.map((o) => [o.key, o] as const)),
);

export function optionByKey(key: string): QuestionOption | undefined {
  return OPTIONS_BY_KEY.get(key);
}

export function optionKeyToQuestionKey(optionKey: string): string | undefined {
  return OPTIONS_BY_KEY.get(optionKey) ? optionKey.slice(0, 3) : undefined;
}
