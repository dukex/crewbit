import { join } from "node:path";
import { LOCK_DIR, acquireLock, getLockedKeys, releaseLock } from "../lock.js";
import { createRunner } from "../runner/index.js";
import type { QueueAction, WorkflowConfig } from "../types.js";
import { createProvider, loadConfig, resolveNextActions } from "../workflow.js";

const REPO_ROOT = process.cwd();

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

async function sleep(seconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, seconds * 1000));
}

type ActiveSession = {
  issueKey: string;
  promise: Promise<boolean>;
  done: boolean;
  result: boolean | null;
};

async function runSession(
  action: QueueAction & { type: "run" },
  config: WorkflowConfig,
  dryRun: boolean,
  lockDir: string,
): Promise<boolean> {
  const logPrefix = `[${action.issueKey}]`;
  const prefixedLog = (message: string) => {
    log(`${logPrefix} ${message}`);
  };
  const runner = createRunner(config, REPO_ROOT, prefixedLog);
  try {
    return await runner.run(action, config, dryRun);
  } finally {
    releaseLock(lockDir, action.issueKey);
  }
}

export async function runDaemonCommand(args: {
  configPath: string;
  dryRun: boolean;
}): Promise<void> {
  const { configPath, dryRun } = args;
  let emptyBackoffExp = 1;
  let failureBackoffExp = 1;
  const lockDir = join(REPO_ROOT, LOCK_DIR);

  log(`crewbit starting${dryRun ? " (dry-run)" : ""}`);
  log(`Config: ${configPath}`);

  const sessions = new Map<string, ActiveSession>();

  process.on("SIGINT", () => {
    log("Stopping... waiting for in-flight sessions to finish.");
    Promise.allSettled([...sessions.values()].map((session) => session.promise)).then(() => {
      log("Stopped.");
      process.exit(0);
    });
  });
  process.on("SIGTERM", () => {
    log("Stopping... waiting for in-flight sessions to finish.");
    Promise.allSettled([...sessions.values()].map((session) => session.promise)).then(() => {
      log("Stopped.");
      process.exit(0);
    });
  });

  while (true) {
    try {
      const config = loadConfig(configPath);
      const maxConcurrent = config.daemon?.maxConcurrent ?? 1;
      const waitSeconds = Number(process.env.WAIT_SECONDS ?? config.daemon?.waitSeconds ?? 60);
      const pollSeconds = 2;

      let hadFailure = false;
      for (const [issueKey, session] of sessions.entries()) {
        if (!session.done) continue;
        if (session.result) {
          log(`[${issueKey}] Session succeeded`);
        } else {
          log(`[${issueKey}] Session failed`);
          hadFailure = true;
        }
        sessions.delete(issueKey);
      }

      const lockedKeys = new Set(getLockedKeys(lockDir));
      for (const issueKey of sessions.keys()) {
        lockedKeys.add(issueKey);
      }

      const slotsAvailable = Math.max(0, maxConcurrent - sessions.size);
      let startedCount = 0;

      if (slotsAvailable > 0) {
        const provider = createProvider(config);
        const actions = await resolveNextActions(config, provider, slotsAvailable, lockedKeys);

        for (const action of actions) {
          if (!acquireLock(lockDir, action.issueKey)) continue;

          const tracked: ActiveSession = {
            issueKey: action.issueKey,
            promise: Promise.resolve(false),
            done: false,
            result: null,
          };

          const sessionPromise = runSession(action, config, dryRun, lockDir)
            .then((ok) => {
              tracked.done = true;
              tracked.result = ok;
              return ok;
            })
            .catch((error) => {
              tracked.done = true;
              tracked.result = false;
              log(
                `[${action.issueKey}] Session crashed: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
              return false;
            });

          tracked.promise = sessionPromise;
          sessions.set(action.issueKey, tracked);
          startedCount += 1;
        }
      }

      if (startedCount > 0) {
        emptyBackoffExp = 1;
        failureBackoffExp = 1;
        await sleep(pollSeconds);
        continue;
      }

      if (sessions.size > 0) {
        await sleep(pollSeconds);
        continue;
      }

      if (hadFailure) {
        const backoff = waitSeconds * failureBackoffExp;
        log(`Session failed. Backing off ${backoff}s before retry.`);
        await sleep(backoff);
        failureBackoffExp = Math.min(failureBackoffExp * 2, 32);
        emptyBackoffExp = 1;
      } else {
        emptyBackoffExp = Math.min(emptyBackoffExp, 10);
        log(`Queue empty. Next check in ${waitSeconds * emptyBackoffExp}s. (Ctrl+C to stop)`);
        await sleep(waitSeconds * emptyBackoffExp);
        emptyBackoffExp *= 2;
        failureBackoffExp = 1;
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      log("Retrying in 60s...");
      await sleep(60);
    }
  }
}
