import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { acquireLock, getLockedKeys, isLocked, releaseLock } from "./lock.js";

const TEST_LOCKS_DIR = join(process.cwd(), ".crewbit/test.locks");

function cleanTestDir() {
  if (existsSync(TEST_LOCKS_DIR)) {
    rmSync(TEST_LOCKS_DIR, { recursive: true, force: true });
  }
}

beforeEach(() => {
  cleanTestDir();
});

describe("acquireLock", () => {
  it("creates a lock file and returns true", () => {
    const result = acquireLock(TEST_LOCKS_DIR, "JIR-1");
    assert.equal(result, true);
    assert.equal(isLocked(TEST_LOCKS_DIR, "JIR-1"), true);
  });

  it("returns false if lock already exists", () => {
    acquireLock(TEST_LOCKS_DIR, "JIR-1");
    const result = acquireLock(TEST_LOCKS_DIR, "JIR-1");
    assert.equal(result, false);
  });

  it("creates the lock directory if it does not exist", () => {
    assert.equal(existsSync(TEST_LOCKS_DIR), false);
    acquireLock(TEST_LOCKS_DIR, "JIR-1");
    assert.equal(existsSync(TEST_LOCKS_DIR), true);
  });

  it("writes metadata (pid, timestamp) to the lock file", () => {
    acquireLock(TEST_LOCKS_DIR, "JIR-1");
    const lockPath = join(TEST_LOCKS_DIR, "JIR-1.lock");
    assert.equal(existsSync(lockPath), true);
    const content = JSON.parse(readFileSync(lockPath, "utf8"));
    assert.equal(typeof content.pid, "number");
    assert.equal(typeof content.timestamp, "string");
  });
});

describe("releaseLock", () => {
  it("removes the lock file", () => {
    acquireLock(TEST_LOCKS_DIR, "JIR-1");
    releaseLock(TEST_LOCKS_DIR, "JIR-1");
    assert.equal(isLocked(TEST_LOCKS_DIR, "JIR-1"), false);
  });

  it("does not throw if lock does not exist", () => {
    assert.doesNotThrow(() => releaseLock(TEST_LOCKS_DIR, "NONEXISTENT"));
  });
});

describe("isLocked", () => {
  it("returns true when lock file exists", () => {
    acquireLock(TEST_LOCKS_DIR, "JIR-1");
    assert.equal(isLocked(TEST_LOCKS_DIR, "JIR-1"), true);
  });

  it("returns false when lock file does not exist", () => {
    assert.equal(isLocked(TEST_LOCKS_DIR, "JIR-999"), false);
  });

  it("returns false when lock directory does not exist", () => {
    assert.equal(isLocked("/nonexistent/path/locks", "JIR-1"), false);
  });
});

describe("getLockedKeys", () => {
  it("returns empty array when no locks exist", () => {
    const keys = getLockedKeys(TEST_LOCKS_DIR);
    assert.deepEqual(keys, []);
  });

  it("returns all locked issue keys", () => {
    acquireLock(TEST_LOCKS_DIR, "JIR-1");
    acquireLock(TEST_LOCKS_DIR, "JIR-2");
    acquireLock(TEST_LOCKS_DIR, "PROJ-42");
    const keys = getLockedKeys(TEST_LOCKS_DIR);
    assert.equal(keys.length, 3);
    assert.ok(keys.includes("JIR-1"));
    assert.ok(keys.includes("JIR-2"));
    assert.ok(keys.includes("PROJ-42"));
  });
});
