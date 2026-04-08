export class Execution {
  readonly type: "command" | "message";
  readonly name: string;
  readonly arguments: string;

  constructor(action: { command?: string; prompt: string }) {
    const commandName = normalizeCommand(action.command);
    if (!commandName) {
      this.type = "message";
      this.name = "";
      this.arguments = "";
      return;
    }

    this.type = "command";
    this.name = commandName;
    this.arguments = removeLeadingCommand(action.prompt, commandName);
  }
}

function normalizeCommand(command?: string): string {
  return (command ?? "").trim().replace(/^\//, "");
}

function removeLeadingCommand(prompt: string, command: string): string {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return "";
  }

  const [firstToken = "", ...rest] = trimmedPrompt.split(/\s+/);
  const normalizedFirstToken = normalizeCommand(firstToken);
  if (normalizedFirstToken === command) {
    return rest.join(" ");
  }
  return trimmedPrompt;
}
