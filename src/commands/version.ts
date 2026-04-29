import packageJson from "../../package.json" with { type: "json" };

export const CREWBIT_VERSION: string = packageJson.version;

export function runVersionCommand(): void {
  if (!CREWBIT_VERSION) {
    throw new Error("Unable to read crewbit version from package.json");
  }
  console.log(CREWBIT_VERSION);
}
