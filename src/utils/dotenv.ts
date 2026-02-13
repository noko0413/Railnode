import fs from "node:fs/promises";
import path from "node:path";

function stripQuotes(value: string) {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function parseEnvLine(line: string): { key: string; value: string } | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return null;

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
    const eqIndex = withoutExport.indexOf("=");
    if (eqIndex <= 0) return null;

    const key = withoutExport.slice(0, eqIndex).trim();
    if (!key) return null;

    // Value can contain '=' so take the rest.
    const rawValue = withoutExport.slice(eqIndex + 1);
    return { key, value: stripQuotes(rawValue) };
}

export async function loadDotEnvIfPresent(projectRoot: string) {
    const envPath = path.join(projectRoot, ".env");

    let raw: string;
    try {
        raw = await fs.readFile(envPath, "utf8");
    } catch {
        return;
    }

    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
        const parsed = parseEnvLine(line);
        if (!parsed) continue;

        // Don't override existing env vars.
        process.env[parsed.key] ??= parsed.value;
    }
}
