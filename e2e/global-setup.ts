import { clearRateLimits } from "./clear-rate-limits";

/**
 * Every run starts with empty rate-limit buckets. The suite registers several fresh candidates per
 * run and the per-client session-start budget (5 / 600s) outlives a single run, so back-to-back
 * reruns would hit the limit before any test logic does. Specs that need more than one window also
 * call the helper themselves.
 */
export default async function globalSetup(): Promise<void> {
  await clearRateLimits();
}
