import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const LOCK_DIR = ".crewbit.locks";

export function acquireLock(lockDir: string, issueKey: string): boolean {
  const lockPath = join(lockDir, `${issueKey}.lock`);
  if (existsSync(lockPath)) return false;
  if (!existsSync(lockDir)) mkdirSync(lockDir, { recursive: true });
  const metadata = JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
  writeFileSync(lockPath, metadata);
  return true;
}

export function releaseLock(lockDir: string, issueKey: string): void {
  const lockPath = join(lockDir, `${issueKey}.lock`);
  if (existsSync(lockPath)) rmSync(lockPath, { force: true });
}

export function isLocked(lockDir: string, issueKey: string): boolean {
  const lockPath = join(lockDir, `${issueKey}.lock`);
  return existsSync(lockPath);
}

export function getLockedKeys(lockDir: string): string[] {
  if (!existsSync(lockDir)) return [];
  const files = readdirSync(lockDir);
  return files.filter((f) => f.endsWith(".lock")).map((f) => f.replace(/\.lock$/, ""));
}
