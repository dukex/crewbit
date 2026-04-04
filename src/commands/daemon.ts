import { createRunner } from "../runner/index.js";
import { createProvider, loadConfig, resolveNextAction } from "../workflow.js";

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

export async function runDaemonCommand(args: {
  configPath: string;
  dryRun: boolean;
}): Promise<void> {
  const { configPath, dryRun } = args;
  let exp = 1;

  log(`crewbit starting${dryRun ? " (dry-run)" : ""}`);
  log(`Config: ${configPath}`);

  process.on("SIGINT", () => {
    log("Stopped.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    log("Stopped.");
    process.exit(0);
  });

  while (true) {
    try {
      exp = Math.min(exp, 10);

      const config = loadConfig(configPath);
      const waitSeconds = Number(process.env.WAIT_SECONDS ?? config.daemon?.waitSeconds ?? 60);

      const provider = createProvider(config);
      const action = await resolveNextAction(config, provider);

      if (action.type === "idle") {
        log(`Queue empty. Next check in ${waitSeconds * exp}s. (Ctrl+C to stop)`);
        await sleep(waitSeconds * exp);
        exp *= 2;
      } else {
        const runner = createRunner(config, REPO_ROOT, log);
        const ok = await runner.run(action, config, dryRun);
        if (ok) {
          exp = 1;
        } else {
          const backoff = waitSeconds * exp;
          log(`Session failed. Backing off ${backoff}s before retry.`);
          await sleep(backoff);
          exp = Math.min(exp * 2, 32);
        }
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      log("Retrying in 60s...");
      await sleep(60);
    }
  }
}
