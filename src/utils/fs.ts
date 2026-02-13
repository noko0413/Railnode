import fs from "node:fs/promises";
import path from "node:path";

export async function pathExists(p: string) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

export async function ensureDir(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
}

export async function writeFileIfAbsent(filePath: string, content: string) {
    if (await pathExists(filePath)) return false;
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, "utf8");
    return true;
}

export async function readTextFile(filePath: string) {
    return fs.readFile(filePath, "utf8");
}

export async function readJsonFile(filePath: string): Promise<unknown> {
    const raw = await readTextFile(filePath);
    return JSON.parse(raw) as unknown;
}

export async function isDirectory(dirPath: string) {
    try {
        const stat = await fs.stat(dirPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

export async function readDirSorted(dirPath: string) {
    const entries = await fs.readdir(dirPath);
    return entries.slice().sort();
}
