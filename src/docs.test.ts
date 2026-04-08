import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const docPath = join(currentDir, "..", "docs/reference/workflow-yaml.md");
const docContent = readFileSync(docPath, "utf8");

describe("docs/reference/workflow-yaml.md", () => {
  describe("top-level fields completeness", () => {
    it("documents provider field with required and type", () => {
      assert.match(docContent, /\|\s*`provider`\s*\|[^|]*\|\s*yes\b/);
    });

    it("documents runner field", () => {
      assert.match(docContent, /`runner`/);
    });

    it("documents providers field", () => {
      assert.match(docContent, /`providers`/);
    });

    it("documents transitions field", () => {
      assert.match(docContent, /`transitions`/);
    });

    it("documents agent field as not required", () => {
      assert.match(docContent, /\|\s*`agent`\s*\|[^|]*\|\s*no\b/);
    });

    it("documents daemon field as optional with defaults", () => {
      assert.match(docContent, /`daemon`/);
      assert.match(docContent, /`waitSeconds`/);
      assert.match(docContent, /`maxSessionSeconds`/);
      assert.match(docContent, /`worktreePrefix`/);
    });

    it("documents opencode field", () => {
      assert.match(docContent, /`opencode`/);
    });

    it("documents git field as optional with defaults", () => {
      assert.match(docContent, /`defaultBranch`/);
      assert.match(docContent, /`slugMaxLength`/);
    });
  });

  describe("providers.jira fields completeness", () => {
    it("documents baseUrl with required marker", () => {
      assert.match(docContent, /`baseUrl`/);
    });

    it("documents projectKey with required marker", () => {
      assert.match(docContent, /`projectKey`/);
    });

    it("documents transitionIds with logical name and numeric ID semantics", () => {
      assert.match(docContent, /`transitionIds`/);
      assert.match(docContent, /logical name|logical-name/i);
      assert.match(docContent, /numeric/i);
    });

    it("documents issueTypes field", () => {
      assert.match(docContent, /`issueTypes`/);
    });
  });

  describe("opencode fields completeness", () => {
    it("documents top-level opencode baseUrl", () => {
      assert.match(docContent, /## `opencode`/);
      assert.doesNotMatch(docContent, /## `providers\.opencode`/);
      assert.match(docContent, /`baseUrl`/);
    });
  });

  describe("git.branchPattern token documentation", () => {
    it("documents {issueKey} interpolation token", () => {
      assert.match(docContent, /\{issueKey\}/);
    });

    it("documents {slug} interpolation token", () => {
      assert.match(docContent, /\{slug\}/);
    });
  });

  describe("agent.planCommentMarker explanation", () => {
    it("explains how Claude Code slash commands use planCommentMarker", () => {
      const agentSectionMatch = docContent.match(/## `agent`[\s\S]*?(?=^## |\Z)/m);
      assert.ok(agentSectionMatch, "Expected an '## `agent`' section in the workflow-yaml docs");
      const agentSection = agentSectionMatch[0];
      assert.match(agentSection, /`planCommentMarker`/);
      assert.match(agentSection, /slash command|\/develop|Claude Code command/i);
    });
  });

  describe("environment variable overrides", () => {
    it("documents WAIT_SECONDS", () => {
      assert.match(docContent, /`WAIT_SECONDS`|WAIT_SECONDS/);
    });

    it("documents MAX_SESSION_SECONDS", () => {
      assert.match(docContent, /`MAX_SESSION_SECONDS`|MAX_SESSION_SECONDS/);
    });

    it("documents JIRA_EMAIL", () => {
      assert.match(docContent, /`JIRA_EMAIL`|JIRA_EMAIL/);
    });

    it("documents JIRA_API_TOKEN", () => {
      assert.match(docContent, /`JIRA_API_TOKEN`|JIRA_API_TOKEN/);
    });

    it("documents GITHUB_TOKEN", () => {
      assert.match(docContent, /`GITHUB_TOKEN`|GITHUB_TOKEN/);
    });

    it("documents OPENCODE_SERVER_PASSWORD", () => {
      assert.match(docContent, /`OPENCODE_SERVER_PASSWORD`|OPENCODE_SERVER_PASSWORD/);
    });
  });
});
