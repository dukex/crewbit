import type { WorkflowConfig } from "../../types.js";

type RequestFn = (input: string | URL, init?: RequestInit) => Promise<Response>;

type ClientAuth = {
  username: string;
  password?: string;
};

export class Client {
  private readonly headers: Record<string, string>;

  constructor(
    private readonly options: {
      baseUrl: string;
      directory: string;
      auth: ClientAuth;
      request: RequestFn;
    },
  ) {
    const auth = this.options.auth;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!auth?.password) {
      this.headers = headers;
    }
    const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
    headers.Authorization = `Basic ${encoded}`;
    this.headers = headers;
  }

  static fromConfig(options: {
    config: WorkflowConfig;
    baseUrl: string;
    directory: string;
    request: RequestFn;
  }): Client {
    return new Client({
      baseUrl: options.baseUrl,
      directory: options.directory,
      auth: {
        username: options.config.opencode?.username ?? "opencode",
        password: options.config.opencode?.password ?? process.env.OPENCODE_SERVER_PASSWORD,
      },
      request: options.request,
    });
  }

  get auth(): ClientAuth {
    return this.options.auth;
  }

  request(input: string | URL, init?: RequestInit): Promise<Response> {
    return this.options.request(input, init);
  }

  buildSessionUrl(): string {
    return this.url("/session");
  }

  buildUrl(path: string): string {
    return this.url(path);
  }

  async health(signal: AbortSignal): Promise<boolean> {
    try {
      const response = await this.request(this.url("/global/health"), {
        headers: this.headers,
        signal,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async newSession(issueKey: string, signal: AbortSignal): Promise<Response> {
    return this.request(this.url("/session"), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ title: issueKey }),
      signal,
    });
  }

  async runCommand(
    sessionId: string,
    command: string,
    argumentsText: string,
    signal: AbortSignal,
  ): Promise<Response> {
    return this.request(this.url(`/session/${sessionId}/command`), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ command, arguments: argumentsText }),
      signal,
    });
  }

  async sendMessage(sessionId: string, prompt: string, signal: AbortSignal): Promise<Response> {
    return this.request(this.url(`/session/${sessionId}/message`), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        parts: [{ type: "text", text: prompt }],
      }),
      signal,
    });
  }

  private url(path: string): string {
    const url = new URL(this.options.baseUrl);
    url.pathname = path.startsWith("/") ? path : `/${path}`;
    if (this.options.directory) {
      url.searchParams.set("directory", this.options.directory);
    }
    return url.toString();
  }
}
