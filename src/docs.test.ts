import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const docPath = join(import.meta.dirname, "..", "docs/reference/workflow-yaml.md");
const docContent = readFileSync(docPath, "utf8");

describe("docs/reference/workflow-yaml.md", () => {
  describe("top-level fields completeness", () => {
    it("documents provider field with required and type", () => {
      assert.match(docContent, /`provider`/);
      assert.match(docContent, /Required|required/);
    });

    it("documents providers field", () => {
      assert.match(docContent, /`providers`/);
    });

    it("documents transitions field", () => {
      assert.match(docContent, /`transitions`/);
    });

    it("documents agent field as optional", () => {
      assert.match(docContent, /`agent`/);
      assert.match(docContent, /[Oo]ptional/);
    });

    it("documents daemon field as optional with defaults", () => {
      assert.match(docContent, /`daemon`/);
      assert.match(docContent, /`waitSeconds`/);
      assert.match(docContent, /`maxSessionSeconds`/);
      assert.match(docContent, /`worktreePrefix`/);
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
      assert.match(docContent, /`planCommentMarker`/);
      assert.match(docContent, /slash command|\/develop|Claude Code command/i);
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
  });
});
