import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function runVersionCommand(): void {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(currentDir, "..", "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };

  if (!packageJson.version) {
    throw new Error("Unable to read crewbit version from package.json");
  }

  console.log(packageJson.version);
}
