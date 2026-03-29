import { defineConfig } from "vitepress";

export default defineConfig({
  title: "crewbit",
  description: "Give life to an AI agent with a single command.",
  base: "/",
  appearance: "force-dark",

  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Tutorial", link: "/tutorial/getting-started" },
      { text: "GitHub", link: "https://github.com/dukex/crewbit" },
    ],

    sidebar: [
      {
        text: "Tutorial",
        items: [{ text: "Getting Started", link: "/tutorial/getting-started" }],
      },
      {
        text: "How-to Guides",
        items: [
          { text: "Configure a workflow", link: "/how-to/configure-workflow" },
          { text: "Set up GitHub Projects", link: "/how-to/github-projects" },
          { text: "Write a slash command", link: "/how-to/write-slash-commands" },
          { text: "Run multiple personas", link: "/how-to/multiple-personas" },
          { text: "Debug issues not picked up", link: "/how-to/debug" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Workflow YAML", link: "/reference/workflow-yaml" },
          { text: "CLI", link: "/reference/cli" },
          { text: "IssueProvider interface", link: "/reference/issue-provider" },
        ],
      },
      {
        text: "Explanation",
        items: [
          { text: "How crewbit works", link: "/explanation/how-it-works" },
          { text: "Personas", link: "/explanation/personas" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/dukex/crewbit" }],
  },
});
