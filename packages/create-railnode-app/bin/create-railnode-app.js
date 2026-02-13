#!/usr/bin/env node

// Wrapper binary for `npx create-railnode-app <name>`.
// Delegates to the implementation shipped in the `railnode` package.

try {
  await import("railnode/create-app");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    "Failed to run Railnode app generator. Is `railnode` installed?\n" +
      message,
  );
  process.exitCode = 1;
}
