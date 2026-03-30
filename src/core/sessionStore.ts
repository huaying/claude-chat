import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Persists threadId → { claudeSessionId, cwd } so sessions
 * survive process restarts. Single JSON file, synchronous I/O
 * to keep it simple.
 */

const STORE_DIR = join(homedir(), ".claude");
const STORE_FILE = join(STORE_DIR, "chat-sessions.json");

interface Entry {
  claudeSessionId: string;
  cwd: string;
}

type Store = Record<string, Entry>;

function load(): Store {
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function save(store: Store): void {
  try {
    mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(store), "utf-8");
  } catch (err) {
    console.error("[sessionStore] Failed to save:", err);
  }
}

export function getSessionEntry(threadKey: string): Entry | undefined {
  return load()[threadKey];
}

export function setSessionEntry(threadKey: string, entry: Entry): void {
  const store = load();
  store[threadKey] = entry;
  save(store);
}
