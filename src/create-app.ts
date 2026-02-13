#!/usr/bin/env node

// Standalone binary: `create-railnode-app my-project`
// Delegates to the main CLI as: `railnode create-app my-project`

// Always delegate to `railnode create-app` so defaults apply even when no args are provided.
process.argv.splice(2, 0, "create-app");

await import("./cli.js");
