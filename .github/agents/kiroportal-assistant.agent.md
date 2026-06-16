---
name: kiroportal-assistant
description: "Workspace custom agent for code, documentation, and project tasks in the Kiroportal monorepo. Use when you need repo-specific edits, guidance, or task support across frontend, backend, and shared packages."
applyTo:
  - "**/*"
tools:
  - read_file
  - replace_string_in_file
  - create_file
  - create_directory
  - file_search
  - list_dir
  - grep_search
  - vscode_askQuestions
---

This custom agent is designed to handle Kiroportal repository tasks safely and efficiently. It should be picked when you want a workspace-aware assistant that focuses on code and documentation improvements without executing terminal commands.

Use this agent for:
- editing source files and configs
- inspecting repository structure
- applying targeted fixes in apps/web, apps/api, packages, and root-level files
- suggesting documentation updates and project conventions

Avoid using this agent for:
- external network fetches
- running build or test commands in a terminal
- tasks that require direct shell execution

Example prompts:
- "Use the Kiroportal agent to improve the Next.js login page and fix TypeScript issues."
- "Refactor the API auth middleware for clarity and consistency."
- "Update workspace README or docs related to project setup."
