import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // The real `server-only` package throws unless resolved under the react-server condition,
      // which would make the scoring modules untestable here. The guard is a build-time boundary;
      // tests/isolation.test.ts asserts the boundary itself from source.
      {
        find: /^server-only$/,
        replacement: path.join(root, "tests/stubs/server-only.ts"),
      },
      { find: "@", replacement: root },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
